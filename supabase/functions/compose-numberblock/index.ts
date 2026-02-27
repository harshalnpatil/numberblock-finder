import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image, decode, encode } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Decomposes a number into place-value components.
 * e.g. 123 → [100, 20, 3], 45 → [40, 5], 7 → [7]
 */
function decomposeNumber(num: number): number[] {
  if (num <= 0) return [];
  if (num <= 10) return [num];

  const components: number[] = [];
  const str = num.toString();
  const digits = str.length;

  for (let i = 0; i < digits; i++) {
    const digit = parseInt(str[i]);
    if (digit === 0) continue;
    const placeValue = digit * Math.pow(10, digits - 1 - i);
    components.push(placeValue);
  }

  return components;
}

/**
 * Fetches an image from a URL and returns it as an imagescript Image.
 */
async function fetchImage(url: string): Promise<Image | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    
    // Try decoding as PNG first, then JPEG
    try {
      return await Image.decode(buffer);
    } catch {
      console.error("Failed to decode image from:", url);
      return null;
    }
  } catch (error) {
    console.error("Failed to fetch image:", url, error);
    return null;
  }
}

/**
 * Composites multiple images side-by-side, scaling them to the same height.
 */
function compositeImages(images: Image[]): Image {
  if (images.length === 1) return images[0];

  const targetHeight = 512; // Standardize height
  
  // Scale all images to target height
  const scaled: Image[] = images.map(img => {
    const scale = targetHeight / img.height;
    const newWidth = Math.round(img.width * scale);
    return img.resize(newWidth, targetHeight);
  });

  // Calculate total width with gaps
  const gap = 8;
  const totalWidth = scaled.reduce((sum, img) => sum + img.width, 0) + gap * (scaled.length - 1);

  // Create composite canvas
  const composite = new Image(totalWidth, targetHeight);

  // Draw each image side-by-side
  let x = 0;
  for (const img of scaled) {
    composite.composite(img, x, 0);
    x += img.width + gap;
  }

  return composite;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { number } = await req.json();

    if (!number || typeof number !== "number" || number <= 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Number must be > 10 for composition" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Composing Numberblock ${number}`);

    const components = decomposeNumber(number);
    console.log(`Decomposed ${number} into components: [${components.join(", ")}]`);

    if (components.length <= 1) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot decompose into multiple components" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache for each component
    const { data: cachedEntries } = await supabase
      .from("numberblocks_cache")
      .select("number, storage_path")
      .in("number", components);

    const cachedMap = new Map<number, string>();
    if (cachedEntries) {
      for (const entry of cachedEntries) {
        cachedMap.set(entry.number, entry.storage_path);
      }
    }

    console.log(`Found ${cachedMap.size}/${components.length} components cached`);

    // For missing components, try scraping them
    const missingComponents = components.filter(c => !cachedMap.has(c));
    if (missingComponents.length > 0) {
      console.log(`Scraping missing components: [${missingComponents.join(", ")}]`);
      
      // Call scrape-numberblocks for each missing component
      for (const comp of missingComponents) {
        try {
          const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-numberblocks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ startNumber: comp, endNumber: comp, isSingleNumber: true }),
          });
          
          const scrapeData = await scrapeResponse.json();
          if (scrapeData.success && scrapeData.data?.[0]?.imageUrl) {
            // Re-check cache after scrape
            const { data: newEntry } = await supabase
              .from("numberblocks_cache")
              .select("number, storage_path")
              .eq("number", comp)
              .single();
            
            if (newEntry) {
              cachedMap.set(newEntry.number, newEntry.storage_path);
            }
          }
        } catch (error) {
          console.error(`Failed to scrape component ${comp}:`, error);
        }
      }
    }

    // Now fetch all component images
    const componentImages: Image[] = [];
    for (const comp of components) {
      const storagePath = cachedMap.get(comp);
      if (!storagePath) {
        console.error(`Component ${comp} still not cached, skipping composition`);
        return new Response(
          JSON.stringify({ success: false, error: `Missing component image for ${comp}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { publicUrl } } = supabase.storage
        .from("numberblocks-images")
        .getPublicUrl(storagePath);

      const img = await fetchImage(publicUrl);
      if (!img) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to load component image for ${comp}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      componentImages.push(img);
    }

    console.log(`All ${componentImages.length} component images loaded, compositing...`);

    // Composite images
    const composite = compositeImages(componentImages);
    const pngData = await composite.encode();

    // Upload to storage
    const paddedNum = number.toString().padStart(3, "0");
    const storagePath = `comp-${paddedNum}.png`;

    const { error: uploadError } = await supabase.storage
      .from("numberblocks-images")
      .upload(storagePath, pngData, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save composite image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache entry
    await supabase.from("numberblocks_cache").upsert(
      {
        number: number,
        storage_path: storagePath,
        original_url: "composed",
      },
      { onConflict: "number" }
    );

    const { data: { publicUrl } } = supabase.storage
      .from("numberblocks-images")
      .getPublicUrl(storagePath);

    console.log(`Composite image for ${number} saved at ${storagePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        composed: true,
        components,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Composition error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
