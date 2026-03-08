import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============= Shared Rate Limiting (same bucket as OpenAI) =============

const AI_RATE_LIMITS = {
  perIp: { threshold: 10, windowMs: 10 * 60 * 1000, delayPerExcess: 15000 },
  global: { threshold: 50, windowMs: 10 * 60 * 1000, delayPerExcess: 10000 },
  maxDelay: 60000,
};

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
}

async function checkAIRateLimits(supabase: any, ip: string): Promise<{ delay: number; ipTotal: number; globalTotal: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - AI_RATE_LIMITS.perIp.windowMs);

  // Use same endpoint key 'generate-numberblock' so OpenAI + Gemini share one budget
  const { data: ipCalls } = await supabase
    .from('rate_limit_log')
    .select('api_calls_count')
    .eq('ip_address', ip)
    .eq('endpoint', 'generate-numberblock')
    .gte('created_at', windowStart.toISOString());

  const ipTotal = ipCalls?.reduce((sum: number, r: { api_calls_count: number }) => sum + r.api_calls_count, 0) || 0;

  const { data: globalCalls } = await supabase
    .from('rate_limit_log')
    .select('api_calls_count')
    .eq('endpoint', 'generate-numberblock')
    .gte('created_at', windowStart.toISOString());

  const globalTotal = globalCalls?.reduce((sum: number, r: { api_calls_count: number }) => sum + r.api_calls_count, 0) || 0;

  let delay = 0;
  if (ipTotal > AI_RATE_LIMITS.perIp.threshold) {
    delay += (ipTotal - AI_RATE_LIMITS.perIp.threshold) * AI_RATE_LIMITS.perIp.delayPerExcess;
  }
  if (globalTotal > AI_RATE_LIMITS.global.threshold) {
    delay += (globalTotal - AI_RATE_LIMITS.global.threshold) * AI_RATE_LIMITS.global.delayPerExcess;
  }

  return { delay: Math.min(delay, AI_RATE_LIMITS.maxDelay), ipTotal, globalTotal };
}

async function logAICall(supabase: any, ip: string): Promise<void> {
  const { error } = await supabase.from('rate_limit_log').insert({
    ip_address: ip,
    endpoint: 'generate-numberblock',
    api_calls_count: 1,
  });
  if (error) {
    console.error('Failed to log AI call:', error);
  }
}

// ============= Helpers =============

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

// ============= Main Handler =============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientIP = getClientIP(req);
    const { number } = await req.json();

    if (!number || typeof number !== "number" || number < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid positive number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check shared rate limits (same bucket as OpenAI)
    const { delay, ipTotal, globalTotal } = await checkAIRateLimits(supabase, clientIP);

    if (delay > 0) {
      console.log(`Gemini rate limited: IP=${clientIP}, ipTotal=${ipTotal}, globalTotal=${globalTotal}, delay=${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
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

    // Call Gemini API directly using generateContent with image generation
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Gemini rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate image with Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract image from Gemini response (inline_data format)
    let base64Data: string | null = null;
    let mimeType = "image/png";

    const parts = data.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
    }

    if (!base64Data) {
      console.error("No image in Gemini response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "No image generated by Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageType = mimeType.split("/")[1] || "png";

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
        contentType: mimeType,
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

    // Log the AI generation call for shared rate limiting
    await logAICall(supabase, clientIP);

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
