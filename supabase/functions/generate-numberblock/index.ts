import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "OPENAI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { number } = await req.json();

    if (!number || typeof number !== "number") {
      return new Response(JSON.stringify({ success: false, error: "Number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating AI image for Numberblock ${number}`);

    // Build a rule-based prompt so the model follows Numberblocks design strictly
    const numberWord = numberToWord(number);
    const structureGuide = getStructureGuide(number);
    const bodyColor = getNumberblockColor(number);

    // Log for debugging
    console.log(`Number: ${number} | Word: ${numberWord} | Color: ${bodyColor}`);
    console.log(`Structure Guide:\n${structureGuide}`);

    const prompt = `You are drawing a Numberblocks character: a figure made of cube blocks from the BBC show. The TOTAL number of visible blocks must EXACTLY equal ${number}. One face on the front only. The number (Numberling) appears on top. Black and white line art only, for a coloring page.

CRITICAL: The NUMBER OF BLOCKS MUST BE EXACTLY ${number} (${numberWord}).
Count carefully: ${number} blocks total, no more, no less.

BLOCK LAYOUT (MUST be clearly visible and countable):
${structureGuide}

VERIFICATION INSTRUCTION:
After drawing, verify that the TOTAL number of blocks visible equals EXACTLY ${number}.
If you draw ${number <= 100 ? "each cube" : "the structural units"}, count them to ensure correctness.

CHARACTER DESIGN:
- The entire body is made of visible cube blocks in the arrangement above; each block is a small cube.
- Exactly ONE face on the front of the block structure: two simple eyes and a smile. No faces on side blocks.
- Draw the digit "${number.toLocaleString()}" on top of the character (above the blocks), bold and clear, like the show's Numberling.
- No arms or legs, OR very simple rounded limbs only (no stick figures).
- Use a single body color: ${bodyColor}. Draw as black outline only for coloring.

STRICT RULES:
- TOTAL block count MUST be ${number} - verify by counting
- Add NO extra blocks, NO missing blocks
- NO scenery, backgrounds, rainbows, or extra characters
- Number "${number.toLocaleString()}" must be on TOP of the blocks, not on the side or corner
- Only ONE face on the front, NO multiple faces
- Black outline ONLY - no shading, gradients, or detailed texture
- Static image - NO animation, NO GIF effects, NO motion

Result: one Numberblocks character, black and white line art, coloring page style, no background, EXACTLY ${number} blocks.`;

    // Call OpenAI Images API for image generation
    // Note: Explicitly request static PNG image, no animation
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        quality: "standard", // Explicit quality setting
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ success: false, error: "Failed to generate image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract the generated image from OpenAI response
    const base64Data = data.data?.[0]?.b64_json;

    if (!base64Data) {
      console.error("No image in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DALL-E returns PNG images
    const imageType = "png";

    // Convert base64 to Uint8Array for storage
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage with "ai-" prefix to indicate it's AI-generated
    const paddedNum = number.toString().padStart(3, "0");
    const storagePath = `ai-${paddedNum}.${imageType}`;

    const { error: uploadError } = await supabase.storage.from("numberblocks-images").upload(storagePath, bytes, {
      contentType: `image/${imageType}`,
      upsert: true,
    });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ success: false, error: "Failed to save image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save cache entry with ai_generated flag in original_url
    await supabase.from("numberblocks_cache").upsert(
      {
        number: number,
        storage_path: storagePath,
        original_url: "ai-generated",
      },
      { onConflict: "number" },
    );

    // Return public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("numberblocks-images").getPublicUrl(storagePath);

    console.log(`AI-generated image for ${number} saved at ${storagePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        aiGenerated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function numberToWord(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (num === 0) return "Zero";
  if (num < 20) return ones[num];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? "-" + ones[one].toLowerCase() : "");
  }
  if (num === 100) return "One Hundred";
  if (num > 100 && num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) {
      return ones[hundred] + " Hundred";
    }
    return ones[hundred] + " Hundred " + numberToWord(remainder);
  }
  if (num === 1000) return "One Thousand";
  if (num >= 1000 && num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    if (remainder === 0) {
      return numberToWord(thousands) + " Thousand";
    }
    return numberToWord(thousands) + " Thousand " + numberToWord(remainder);
  }
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    if (remainder === 0) {
      return numberToWord(millions) + " Million";
    }
    return numberToWord(millions) + " Million " + numberToWord(remainder);
  }

  return num.toLocaleString();
}

// Canonical Numberblocks character colors (1-10 from the show); 11+ use single color.
function getNumberblockColor(num: number): string {
  const colors: Record<number, string> = {
    1: "red",
    2: "orange",
    3: "yellow",
    4: "green",
    5: "blue",
    6: "purple",
    7: "indigo",
    8: "pink",
    9: "teal",
    10: "light gray or white",
  };
  return colors[num] ?? "single color";
}

// Returns structural guidance based on the number's scale
function getStructureGuide(num: number): string {
  if (num <= 9) {
    // Small numbers: show every cube; be explicit so the model does not invent shapes
    const arrangement = getSmallNumberArrangement(num);
    return `- Exactly ${num} cube(s). ${arrangement}.
- Each block is a small cube; draw so every block is clearly visible and countable.
- The reader must be able to count every single block.`;
  }

  if (num === 10) {
    // Ten: first grouped unit
    return `- Exactly 10 cubes in a clean rectangle (e.g. 2 columns of 5, or 1 row of 10).
- Ten is the first "grouped unit"; all 10 cubes visible and countable in a unified shape.
- Draw so every block is clearly visible.`;
  }

  if (num <= 99) {
    // Two-digit: tens + ones
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    const onesText =
      ones > 0
        ? ` PLUS exactly ${ones} individual single block${ones > 1 ? "s" : ""} attached separately on the side or top`
        : "";
    return `- Build from EXACTLY ${tens} RECTANGULAR groups of ten blocks each (each group is a 2×5 or 5×2 rectangle showing 10 blocks)${onesText}
- TOTAL COUNT: ${tens} rectangles × 10 blocks each = ${tens * 10} blocks, PLUS ${ones} individual blocks = ${num} blocks total
- Each "ten-group" MUST be a clear RECTANGLE of 10 visible cubes (arranged as 2 rows of 5, or 5 rows of 2)
- The ${tens} ten-rectangles form the main body (stacked or side-by-side)
- The ${ones} individual blocks attach clearly and separately (not merged into the ten-groups)
- Visual math: the viewer should clearly SEE ${tens} ten-rectangles + ${ones} singles = ${num}
- All ${num} blocks must be individually visible and countable`;
  }

  if (num === 100) {
    // Hundred: grid structure
    return `- Show as a large 10×10 square grid (100 blocks total)
- This is the first number where counting is impractical
- The structure should signal "hundred" through its grid pattern
- Individual cubes can be implied but the 10×10 structure must be clear`;
  }

  if (num <= 999) {
    // Hundreds: multiple slabs
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    const remainderText =
      remainder > 0
        ? ` PLUS exactly ${remainder} additional visible blocks for the remaining ${remainder} (this adds to the total)`
        : "";
    return `- Show as EXACTLY ${hundreds} stacked or side-by-side 10×10 hundred-slabs (that's ${hundreds * 100} blocks)${remainderText}
- TOTAL COUNT: ${hundreds * 100} + ${remainder} = ${num} blocks
- Each hundred-slab keeps its 10×10 grid identity
- Extra ${remainder} blocks must be clearly visible and separate from the hundred-slabs
- Structure is architectural - the count is implied by the pattern
- Think of it as ${hundreds} "hundred-blocks"${remainder > 0 ? ` combined with ${remainder} individual blocks` : " combined"}`;
  }

  if (num <= 9999) {
    // Thousands: stacked hundreds
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return `- Conceptualize as ${thousands} "thousand-blocks" (each is a cube of 10 hundred-slabs)
- Individual cubes cannot all be drawn - use structural representation
- Show the magnitude through HEIGHT and SCALE, not individual blocks
- ${remainder > 0 ? `Include visual indication of the extra ${remainder}` : "Clean thousand-block structure"}
- Use mega-blocks arranged in clean grids and balanced rectangles`;
  }

  if (num <= 999999) {
    // Ten-thousands to hundreds of thousands
    const mainUnit = Math.floor(num / 1000);
    return `- SYMBOLIC STRUCTURE: Impossible to show every cube
- Represent as ${mainUnit.toLocaleString()} thousand-blocks in a massive grid/tower
- Use repeating patterns of known shapes (tens, hundreds) to signal scale
- WIDTH and HEIGHT show magnitude, not literal cube count
- Think architectural monument, not countable blocks
- Clear visual hierarchy: the number is understood by STRUCTURE, not detail`;
  }

  // Million+
  return `- PURE STRUCTURE AND SCALE representation
- Show as a monumental tower or massive cube made of implied thousand-layers
- Individual blocks are completely abstracted into mega-structures
- Use labels, perspective, and sheer size to convey magnitude
- The character should feel MASSIVE and architectural
- Think skyscraper or mountain-sized, with structure implying the count`;
}

function getSmallNumberArrangement(num: number): string {
  switch (num) {
    case 1:
      return "Exactly one cube";
    case 2:
      return "Stack of 2 cubes (vertical)";
    case 3:
      return "Stack of 3 cubes (vertical)";
    case 4:
      return "2×2 square of 4 cubes";
    case 5:
      return "Stack of 5 cubes (vertical)";
    case 6:
      return "2×3 vertical rectangle of 6 cubes";
    case 7:
      return "Stack of 7 cubes (vertical)";
    case 8:
      return "2×4 vertical rectangle or 2×2×2 cube of 8 cubes";
    case 9:
      return "3×3 square of 9 cubes";
    default:
      return `${num} cubes in a compact arrangement`;
  }
}
