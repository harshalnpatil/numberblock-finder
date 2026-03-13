import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
 * Fetches an image from a URL and returns it as base64 data URI.
 * Works with any format the browser supports (PNG, JPEG, WebP, etc.)
 */
async function fetchImageAsDataUri(url: string): Promise<{ dataUri: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = new Uint8Array(await response.arrayBuffer());

    // Convert to base64
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    const base64 = btoa(binary);
    return { dataUri: `data:${contentType};base64,${base64}` };
  } catch (error) {
    console.error("Failed to fetch image:", url, error);
    return null;
  }
}

/**
 * Creates an SVG that composites multiple images side-by-side.
 * This avoids needing to decode WebP or other formats server-side —
 * images are embedded as data URIs and the browser handles rendering.
 */
function compositeAsSvg(images: { dataUri: string }[], componentSize: number): string {
  const gap = 10;
  const totalWidth = images.length * componentSize + (images.length - 1) * gap;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${componentSize}" viewBox="0 0 ${totalWidth} ${componentSize}">`;

  let x = 0;
  for (const img of images) {
    svg += `<image href="${img.dataUri}" x="${x}" y="0" width="${componentSize}" height="${componentSize}" preserveAspectRatio="xMidYMid meet"/>`;
    x += componentSize + gap;
  }
  svg += `</svg>`;

  return svg;
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

    // Fetch all component images as data URIs (handles any format including WebP)
    const componentImages: { dataUri: string }[] = [];
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

      const imgData = await fetchImageAsDataUri(publicUrl);
      if (!imgData) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to load component image for ${comp}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      componentImages.push(imgData);
    }

    console.log(`All ${componentImages.length} component images loaded, compositing as SVG...`);

    // Create SVG composite
    const svgContent = compositeAsSvg(componentImages, 400);

    // Upload SVG to storage
    const paddedNum = number.toString().padStart(3, "0");
    const storagePath = `comp-${paddedNum}.svg`;

    const { error: uploadError } = await supabase.storage
      .from("numberblocks-images")
      .upload(storagePath, new TextEncoder().encode(svgContent), {
        contentType: "image/svg+xml",
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

    console.log(`Composite SVG for ${number} saved at ${storagePath}`);

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
