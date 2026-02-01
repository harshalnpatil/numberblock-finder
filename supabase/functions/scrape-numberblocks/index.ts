const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NumberImage {
  number: number;
  imageUrl: string | null;
  pageUrl: string;
  error?: string;
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

    const { startNumber = 1, endNumber = 20 } = await req.json();
    
    console.log(`Scraping Numberblocks images from ${startNumber} to ${endNumber}`);
    
    const results: NumberImage[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = startNumber; i <= endNumber; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, endNumber + 1); j++) {
        batch.push(scrapeNumberPage(j, apiKey));
      }
      
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      // Small delay between batches to be respectful
      if (i + batchSize <= endNumber) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Scraped ${results.length} pages, found ${results.filter(r => r.imageUrl).length} images`);

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scrapeNumberPage(num: number, apiKey: string): Promise<NumberImage> {
  // Convert number to word for wiki page URL
  const numberWord = numberToWord(num);
  const pageUrl = `https://numberblocks.fandom.com/wiki/${encodeURIComponent(numberWord)}`;
  
  console.log(`Scraping: ${pageUrl}`);
  
  try {
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

    // Extract infobox image from HTML
    const html = data.data?.html || data.html || '';
    const imageUrl = extractInfoboxImage(html, num);
    
    return { number: num, imageUrl, pageUrl };
  } catch (error) {
    console.error(`Error scraping ${num}:`, error);
    return { 
      number: num, 
      imageUrl: null, 
      pageUrl, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function extractInfoboxImage(html: string, num: number): string | null {
  // Look for the main character image in the infobox
  // Fandom wikis typically have the main image in a specific pattern
  
  // Pattern 1: Look for image in infobox/aside with data-image-key or src
  const patterns = [
    // Portable infobox image
    /class="pi-image"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>/is,
    // Standard infobox image
    /class="image image-thumbnail"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>/is,
    // Any image with the number name in it
    new RegExp(`<img[^>]*src="([^"]+${numberToWord(num)}[^"]*\\.png)"[^>]*>`, 'i'),
    // Fallback: first substantial image in article
    /<img[^>]*src="(https:\/\/static\.wikia\.nocookie\.net\/numberblocks[^"]+)"[^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let imageUrl = match[1];
      
      // Clean up the URL - remove thumbnail sizing to get full resolution
      imageUrl = imageUrl.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest');
      imageUrl = imageUrl.replace(/\/revision\/latest\/smart\/width\/\d+\/height\/\d+/, '/revision/latest');
      
      // Skip placeholder or icon images
      if (imageUrl.includes('placeholder') || imageUrl.includes('icon') || imageUrl.includes('favicon')) {
        continue;
      }
      
      return imageUrl;
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
  
  // For very large numbers, just use the numeral
  return num.toString();
}
