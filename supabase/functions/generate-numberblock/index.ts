import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'OPENAI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { number } = await req.json();
    
    if (!number || typeof number !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating AI image for Numberblock ${number}`);

    // Create a kid-friendly prompt for generating a Numberblocks-style coloring page
    const numberWord = numberToWord(number);
    const structureGuide = getStructureGuide(number);
    
    const prompt = `Create a simple, kid-friendly coloring page sketch of a Numberblocks character representing the number ${number} (${numberWord}).

CRITICAL STRUCTURE RULES - One block always equals one unit:
${structureGuide}

CHARACTER DESIGN:
- Single friendly face on the FRONT of the structure, centered and readable
- Simple stick arms and legs that scale proportionally but stay thin
- Cute cartoon eyes and a warm smile
- One solid body color (shown as outline for coloring)

STYLE:
- Black and white line drawing suitable for children to color
- Simple, cute, cartoon-like, similar to BBC Numberblocks show
- Clean outlines, no shading
- Include the number "${number.toLocaleString()}" displayed clearly near the character

Ultra high resolution coloring page illustration.`;

    // Call OpenAI DALL-E for image generation
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract the generated image from DALL-E response
    const base64Data = data.data?.[0]?.b64_json;
    
    if (!base64Data) {
      console.error('No image in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DALL-E returns PNG images
    const imageType = 'png';
        
    // Convert base64 to Uint8Array for storage
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage with "ai-" prefix to indicate it's AI-generated
    const paddedNum = number.toString().padStart(3, '0');
    const storagePath = `ai-${paddedNum}.${imageType}`;
    
    const { error: uploadError } = await supabase.storage
      .from('numberblocks-images')
      .upload(storagePath, bytes, {
        contentType: `image/${imageType}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save cache entry with ai_generated flag in original_url
    await supabase
      .from('numberblocks_cache')
      .upsert({
        number: number,
        storage_path: storagePath,
        original_url: 'ai-generated',
      }, { onConflict: 'number' });

    // Return public URL
    const { data: { publicUrl } } = supabase.storage
      .from('numberblocks-images')
      .getPublicUrl(storagePath);

    console.log(`AI-generated image for ${number} saved at ${storagePath}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        aiGenerated: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
  if (num === 100) return 'One Hundred';
  if (num > 100 && num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) {
      return ones[hundred] + ' Hundred';
    }
    return ones[hundred] + ' Hundred ' + numberToWord(remainder);
  }
  if (num === 1000) return 'One Thousand';
  if (num >= 1000 && num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    if (remainder === 0) {
      return numberToWord(thousands) + ' Thousand';
    }
    return numberToWord(thousands) + ' Thousand ' + numberToWord(remainder);
  }
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    if (remainder === 0) {
      return numberToWord(millions) + ' Million';
    }
    return numberToWord(millions) + ' Million ' + numberToWord(remainder);
  }
  
  return num.toLocaleString();
}

// Returns structural guidance based on the number's scale
function getStructureGuide(num: number): string {
  if (num <= 9) {
    // Small numbers: show every cube
    return `- Build as a simple stack or rectangle of exactly ${num} visible, countable cubes
- Each individual cube should be clearly visible and countable
- Arrange in a compact shape (e.g., ${getSmallNumberArrangement(num)})
- The child should be able to count every single block`;
  }
  
  if (num === 10) {
    // Ten: first grouped unit
    return `- Show as a clean rectangle of 10 blocks (2 columns of 5, or 1 row of 10)
- Ten is the first "grouped unit" - make it look like a building block itself
- All 10 cubes should be visible but arranged as a unified shape`;
  }
  
  if (num <= 99) {
    // Two-digit: tens + ones
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    const onesText = ones > 0 ? ` with ${ones} extra single block${ones > 1 ? 's' : ''} attached on the side or top` : '';
    return `- Build from ${tens} groups of ten${onesText}
- The tens form the main rectangular body
- Extra ones attach clearly and separately
- The viewer should "see" addition: ${tens}×10 + ${ones} = ${num}
- All blocks should still be individually visible`;
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
    const remainderText = remainder > 0 ? ` plus visible extra blocks for the remaining ${remainder}` : '';
    return `- Show as ${hundreds} stacked or side-by-side 10×10 hundred-slabs${remainderText}
- Each hundred-slab keeps its 10×10 identity
- Structure is architectural - the count is implied by the pattern
- Think of it as ${hundreds} "hundred-blocks" combined`;
  }
  
  if (num <= 9999) {
    // Thousands: stacked hundreds
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return `- Conceptualize as ${thousands} "thousand-blocks" (each is a cube of 10 hundred-slabs)
- Individual cubes cannot all be drawn - use structural representation
- Show the magnitude through HEIGHT and SCALE, not individual blocks
- ${remainder > 0 ? `Include visual indication of the extra ${remainder}` : 'Clean thousand-block structure'}
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
    case 1: return '1 single cube';
    case 2: return '2 cubes stacked vertically or side-by-side';
    case 3: return '3 cubes in a triangle or row';
    case 4: return '2×2 square';
    case 5: return '5 cubes in a plus shape or row';
    case 6: return '2×3 rectangle';
    case 7: return '2×3 + 1 on top';
    case 8: return '2×4 rectangle or 2×2×2 cube';
    case 9: return '3×3 square';
    default: return `${num} cubes arranged compactly`;
  }
}
