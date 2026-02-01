import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NumberImage {
  number: number;
  imageUrl: string | null;
  pageUrl: string;
  cached?: boolean;
  error?: string;
}

interface CacheEntry {
  number: number;
  storage_path: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { startNumber = 1, endNumber = 20 } = await req.json();
    
    console.log(`Processing Numberblocks images from ${startNumber} to ${endNumber}`);
    
    // Check which numbers are already cached
    const { data: cachedEntries } = await supabase
      .from('numberblocks_cache')
      .select('number, storage_path')
      .gte('number', startNumber)
      .lte('number', endNumber);
    
    const cachedMap = new Map<number, string>();
    if (cachedEntries) {
      for (const entry of cachedEntries) {
        cachedMap.set(entry.number, entry.storage_path);
      }
    }
    
    console.log(`Found ${cachedMap.size} cached images`);
    
    const results: NumberImage[] = [];
    const numbersToScrape: number[] = [];
    
    // Build list of numbers to scrape vs return from cache
    for (let num = startNumber; num <= endNumber; num++) {
      if (cachedMap.has(num)) {
        const storagePath = cachedMap.get(num)!;
        const { data: { publicUrl } } = supabase.storage
          .from('numberblocks-images')
          .getPublicUrl(storagePath);
        
        results.push({
          number: num,
          imageUrl: publicUrl,
          pageUrl: `https://numberblocks.fandom.com/wiki/${numberToWord(num)}`,
          cached: true,
        });
      } else {
        numbersToScrape.push(num);
      }
    }
    
    console.log(`Need to scrape ${numbersToScrape.length} new images`);
    
    // Scrape uncached numbers in batches
    const batchSize = 5;
    for (let i = 0; i < numbersToScrape.length; i += batchSize) {
      const batch = numbersToScrape.slice(i, i + batchSize);
      const batchPromises = batch.map(num => scrapeAndCacheNumber(num, apiKey, supabase, supabaseUrl));
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < numbersToScrape.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Sort results by number
    results.sort((a, b) => a.number - b.number);

    const successCount = results.filter(r => r.imageUrl).length;
    const cachedCount = results.filter(r => r.cached).length;
    console.log(`Returning ${results.length} images (${cachedCount} cached, ${successCount - cachedCount} newly scraped)`);

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scrapeAndCacheNumber(num: number, apiKey: string, supabase: any, supabaseUrl: string): Promise<NumberImage> {
  const numberWord = numberToWord(num);
  const pageUrl = `https://numberblocks.fandom.com/wiki/${encodeURIComponent(numberWord)}`;
  
  console.log(`Scraping: ${pageUrl}`);
  
  try {
    // Scrape the page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pageUrl,
        formats: ['html', 'links'],
        onlyMainContent: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Firecrawl error for ${num}:`, data);
      return { number: num, imageUrl: null, pageUrl, error: data.error || 'Request failed' };
    }

    const html = data.data?.html || data.html || '';
    const originalImageUrl = extractInfoboxImage(html, num);
    
    if (!originalImageUrl) {
      return { number: num, imageUrl: null, pageUrl, error: 'No image found' };
    }
    
    // Download the image
    const imageResponse = await fetch(originalImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://numberblocks.fandom.com/',
      },
    });
    
    if (!imageResponse.ok) {
      console.error(`Failed to download image for ${num}: ${imageResponse.status}`);
      return { number: num, imageUrl: originalImageUrl, pageUrl };
    }
    
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const imageData = await imageResponse.arrayBuffer();
    
    // Determine file extension
    let extension = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
    else if (contentType.includes('gif')) extension = 'gif';
    else if (contentType.includes('webp')) extension = 'webp';
    
    const paddedNum = num.toString().padStart(3, '0');
    const storagePath = `${paddedNum}.${extension}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('numberblocks-images')
      .upload(storagePath, imageData, {
        contentType,
        upsert: true,
      });
    
    if (uploadError) {
      console.error(`Failed to cache image ${num}:`, uploadError);
      return { number: num, imageUrl: originalImageUrl, pageUrl };
    }
    
    // Save cache entry
    await supabase
      .from('numberblocks_cache')
      .upsert({
        number: num,
        storage_path: storagePath,
        original_url: originalImageUrl,
      }, { onConflict: 'number' });
    
    // Return public URL
    const { data: { publicUrl } } = supabase.storage
      .from('numberblocks-images')
      .getPublicUrl(storagePath);
    
    console.log(`Cached image ${num} at ${storagePath}`);
    
    return { number: num, imageUrl: publicUrl, pageUrl, cached: true };
  } catch (error) {
    console.error(`Error processing ${num}:`, error);
    return { 
      number: num, 
      imageUrl: null, 
      pageUrl, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function isValidCharacterImage(imageUrl: string): boolean {
  // Reject common non-character images
  const invalidPatterns = [
    /placeholder/i,
    /icon/i,
    /favicon/i,
    /logo/i,
    /banner/i,
    /Site-logo/i,
    /Wiki-wordmark/i,
    /Community-header/i,
    /avatar/i,
    /badge/i,
    /button/i,
    /sprite/i,
    /Blocks_Universe/i,
    /BLOCKS.*UNIVERSE/i,
    /community/i,
    /wiki.*wordmark/i,
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(imageUrl)) {
      return false;
    }
  }
  
  // Must be from the numberblocks static content
  if (!imageUrl.includes('static.wikia.nocookie.net/numberblocks/images')) {
    return false;
  }
  
  return true;
}

function extractInfoboxImage(html: string, num: number): string | null {
  const numStr = num.toString();
  const numberName = numberToWord(num).toLowerCase().replace(/[_-]/g, '');
  
  // First, try to find images that explicitly contain our number in the filename
  // This is the most reliable method for large numbers
  const allImgMatches = [...html.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)];
  
  // Priority 1: Look for images with the exact number in the URL
  for (const match of allImgMatches) {
    let imageUrl = match[1];
    
    if (!isValidCharacterImage(imageUrl)) {
      continue;
    }
    
    // Extract the filename from the URL
    const urlPath = imageUrl.split('/').pop()?.split('?')[0] || '';
    const urlLower = urlPath.toLowerCase();
    
    // Check if the filename explicitly contains our number
    // For large numbers like 2000000, the filename should contain "2000000" or "2,000,000"
    const numWithCommas = num.toLocaleString();
    if (urlLower.includes(numStr) || urlLower.includes(numWithCommas.replace(/,/g, ''))) {
      imageUrl = imageUrl.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest');
      imageUrl = imageUrl.replace(/\/revision\/latest\/smart\/width\/\d+\/height\/\d+/, '/revision/latest');
      return imageUrl;
    }
  }
  
  // Priority 2: For small numbers, try the infobox patterns
  if (num <= 1000) {
    const infoboxPatterns = [
      // Portable infobox image (most reliable)
      /class="pi-image[^"]*"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>/is,
      // Image in aside infobox
      /<aside[^>]*class="[^"]*infobox[^"]*"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>/is,
    ];

    for (const pattern of infoboxPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];
        imageUrl = imageUrl.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest');
        imageUrl = imageUrl.replace(/\/revision\/latest\/smart\/width\/\d+\/height\/\d+/, '/revision/latest');
        
        if (isValidCharacterImage(imageUrl)) {
          return imageUrl;
        }
      }
    }
    
    // Priority 3: Fallback for small numbers - check if filename contains number word
    for (const match of allImgMatches) {
      let imageUrl = match[1];
      
      if (!isValidCharacterImage(imageUrl)) {
        continue;
      }
      
      const urlLower = imageUrl.toLowerCase();
      if (urlLower.includes(numberName)) {
        imageUrl = imageUrl.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest');
        imageUrl = imageUrl.replace(/\/revision\/latest\/smart\/width\/\d+\/height\/\d+/, '/revision/latest');
        return imageUrl;
      }
    }
  }

  return null;
}

function numberToWord(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 
                'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? '-' + ones[one].toLowerCase() : '');
  }
  if (num === 100) return 'One_Hundred';
  if (num > 100 && num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) {
      return ones[hundred] + '_Hundred';
    }
    return ones[hundred] + '_Hundred_' + numberToWord(remainder).replace('-', '_');
  }
  if (num === 1000) return 'One_Thousand';
  
  return num.toString();
}
