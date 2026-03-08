import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function numberToWord(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (num === 0) return "Zero";
  if (num < 20) return ones[num];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    return tens[t] + (o > 0 ? "-" + ones[o].toLowerCase() : "");
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const r = num % 100;
    return ones[h] + " Hundred" + (r > 0 ? " " + numberToWord(r) : "");
  }
  if (num < 1000000) {
    const th = Math.floor(num / 1000);
    const r = num % 1000;
    return numberToWord(th) + " Thousand" + (r > 0 ? " " + numberToWord(r) : "");
  }
  return num.toLocaleString();
}

function getNumberblockColor(num: number): string {
  const colors: Record<number, string> = {
    1: "red", 2: "orange", 3: "yellow", 4: "green", 5: "blue",
    6: "purple", 7: "indigo", 8: "pink", 9: "teal", 10: "light gray or white",
  };
  return colors[num] ?? "single color";
}

function getStructureGuide(num: number): string {
  if (num <= 9) {
    const arrangements: Record<number, string> = {
      1: "Exactly one cube",
      2: "Stack of 2 cubes (vertical)",
      3: "Stack of 3 cubes (vertical)",
      4: "2×2 square of 4 cubes",
      5: "Stack of 5 cubes (vertical)",
      6: "2×3 vertical rectangle of 6 cubes",
      7: "Stack of 7 cubes (vertical)",
      8: "2×4 vertical rectangle of 8 cubes",
      9: "3×3 square of 9 cubes",
    };
    return `- Exactly ${num} cube(s). ${arrangements[num] || `${num} cubes`}.
- Each block is a small cube; draw so every block is clearly visible and countable.`;
  }
  if (num === 10) return "- Exactly 10 cubes in a 2×5 rectangle. All 10 cubes visible and countable.";
  if (num <= 99) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    return `- ${t} vertical columns of 10 blocks each${o > 0 ? ` plus ${o} extra cube${o > 1 ? "s" : ""}` : ""}.
- Total: ${num} blocks exactly.`;
  }
  if (num === 100) return "- 10×10 square grid of 100 blocks.";
  if (num <= 999) {
    const h = Math.floor(num / 100);
    const r = num % 100;
    return `- ${h} stacked 10×10 hundred-slabs${r > 0 ? ` plus ${r} extra blocks` : ""}. Total: ${num}.`;
  }
  return `- Structural representation of ${num} blocks using mega-block units.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { number } = await req.json();

    if (!number || typeof number !== "number" || number < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid positive number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating Gemini image for Numberblock ${number}`);

    const numberWord = numberToWord(number);
    const bodyColor = getNumberblockColor(number);
    const structureGuide = getStructureGuide(number);

    const prompt = `Draw a Numberblocks character (BBC show) made of exactly ${number} cube blocks. Black and white coloring page, line art only.

CRITICAL: EXACTLY ${number} (${numberWord}) blocks. Count carefully.

LAYOUT:
${structureGuide}

CHARACTER:
- Body is cube blocks in the arrangement above
- ONE face on front: simple eyes + smile
- Digit "${number.toLocaleString()}" on top (Numberling)
- Simple rounded limbs or none
- Color: ${bodyColor} (draw as outline only)

RULES:
- Exactly ${number} blocks, no more, no less
- No background, no extra characters
- Black outline only, coloring page style`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Gemini gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate image with Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error("No image in Gemini response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "No image generated by Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract base64 data (strip data:image/png;base64, prefix)
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid image format from Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageType = base64Match[1]; // png, jpeg, etc.
    const base64Data = base64Match[2];

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const paddedNum = number.toString().padStart(3, "0");
    const storagePath = `gem-${paddedNum}.${imageType === "jpeg" ? "jpg" : imageType}`;

    const { error: uploadError } = await supabase.storage
      .from("numberblocks-images")
      .upload(storagePath, bytes, {
        contentType: `image/${imageType}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save Gemini image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("numberblocks_cache").upsert(
      {
        number: number,
        storage_path: storagePath,
        original_url: "gemini-generated",
      },
      { onConflict: "number" }
    );

    const { data: { publicUrl } } = supabase.storage
      .from("numberblocks-images")
      .getPublicUrl(storagePath);

    console.log(`Gemini image for ${number} saved at ${storagePath}`);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl, aiGenerated: true, generationMethod: 'gemini' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gemini generation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
