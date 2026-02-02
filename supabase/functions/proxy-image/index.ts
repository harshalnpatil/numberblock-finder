// Allowed origins that can call this endpoint
const ALLOWED_ORIGINS = [
  'https://numberblock-finder.lovable.app',
  'https://preview--numberblock-finder.lovable.app',
  'https://id-preview--1453795c-5967-4468-a516-fa70db7eb752.lovable.app',
  'http://localhost:5173', // Local development
  'http://localhost:8080',
];

// Allowed domains to fetch images from
const ALLOWED_IMAGE_DOMAINS = [
  'static.wikia.nocookie.net',      // Fandom wiki images
  'hfiasynirtqtbbqoviol.supabase.co', // Our Supabase storage
];

// Max image size (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function getCorsHeaders(origin: string | null): Record<string, string> {
  // Only allow specific origins
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith('.lovable.app')
  ) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  // Allow any lovable.app subdomain (for preview URLs)
  if (origin.endsWith('.lovable.app')) return true;
  
  // Check explicit allowed origins (localhost for dev)
  return ALLOWED_ORIGINS.includes(origin);
}

function isDomainAllowed(imageUrl: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(imageUrl);
    const isAllowed = ALLOWED_IMAGE_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowed) {
      return { valid: false, error: `Domain '${url.hostname}' is not allowed` };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate origin
    if (!isOriginAllowed(origin)) {
      console.error(`Blocked request from unauthorized origin: ${origin}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized origin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the image URL domain
    const domainCheck = isDomainAllowed(imageUrl);
    if (!domainCheck.valid) {
      console.error(`Blocked request for disallowed domain: ${imageUrl}`);
      return new Response(
        JSON.stringify({ success: false, error: domainCheck.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying image:', imageUrl);

    // Add timeout control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    // Fetch the image from the server side (bypasses CORS/hotlink protection)
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://numberblocks.fandom.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch image: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check content length before downloading
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      console.error(`Image too large: ${contentLength} bytes`);
      return new Response(
        JSON.stringify({ success: false, error: 'Image too large (max 10MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const imageData = await response.arrayBuffer();

    // Double-check actual size after download
    if (imageData.byteLength > MAX_IMAGE_SIZE) {
      console.error(`Image too large after download: ${imageData.byteLength} bytes`);
      return new Response(
        JSON.stringify({ success: false, error: 'Image too large (max 10MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
    
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ success: false, error: 'Request timed out' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
