import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSVG } from "./renderer.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { number } = await req.json();

    if (!Number.isInteger(number) || number < 1 || number > 1000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "A whole number from 1 to 1000 is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Generating programmatic SVG v2 for Numberblock ${number}`);
    const svgBytes = new TextEncoder().encode(buildSVG(number));
    const paddedNum = number.toString().padStart(3, "0");
    const storagePath = `svg-${paddedNum}.svg`;
    const { error: uploadError } = await supabase.storage
      .from("numberblocks-images")
      .upload(storagePath, svgBytes, {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save SVG image" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: cacheError } = await supabase.from("numberblocks_cache")
      .upsert(
        {
          number,
          storage_path: storagePath,
          original_url: "svg-generated",
          source: "render",
          model: "svg-v2",
          verified: true,
          verification_note: "deterministic render",
          verified_at: new Date().toISOString(),
        },
        { onConflict: "number" },
      );

    if (cacheError) console.error("Cache upsert error:", cacheError);

    const { data: { publicUrl } } = supabase.storage
      .from("numberblocks-images")
      .getPublicUrl(storagePath);

    console.log(`SVG v2 image for ${number} saved at ${storagePath}`);
    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        svgGenerated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("SVG generation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
