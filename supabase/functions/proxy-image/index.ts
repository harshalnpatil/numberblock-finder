const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying image:', imageUrl);

    // Fetch the image from the server side (bypasses CORS/hotlink protection)
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://numberblocks.fandom.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch image: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const imageData = await response.arrayBuffer();
    
    // Convert to base64 for easy transfer
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imageData)));

    console.log(`Successfully proxied image, size: ${imageData.byteLength} bytes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: base64,
        contentType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error proxying image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to proxy image';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
