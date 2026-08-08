import { verifyImageUrl } from "../_shared/verify.ts";

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
    const { number, imageUrl } = await req.json();

    if (typeof number !== "number" || !Number.isInteger(number) || number < 0) {
      return new Response(
        JSON.stringify({ success: false, error: "A valid whole number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (typeof imageUrl !== "string" || !/^https?:\/\//i.test(imageUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: "A valid imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await verifyImageUrl(imageUrl, number);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("verify-numberblock error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
