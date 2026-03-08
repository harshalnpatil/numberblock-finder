import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Canonical Numberblocks colors (HSL values for SVG)
const COLORS: Record<number, { fill: string; stroke: string; name: string }> = {
  1: { fill: "#E53935", stroke: "#B71C1C", name: "red" },
  2: { fill: "#FB8C00", stroke: "#E65100", name: "orange" },
  3: { fill: "#FDD835", stroke: "#F9A825", name: "yellow" },
  4: { fill: "#43A047", stroke: "#2E7D32", name: "green" },
  5: { fill: "#1E88E5", stroke: "#1565C0", name: "blue" },
  6: { fill: "#8E24AA", stroke: "#6A1B9A", name: "purple" },
  7: { fill: "#3949AB", stroke: "#283593", name: "indigo" },
  8: { fill: "#EC407A", stroke: "#C2185B", name: "pink" },
  9: { fill: "#00897B", stroke: "#00695C", name: "teal" },
  0: { fill: "#BDBDBD", stroke: "#757575", name: "gray" },
};

function getColorForDigit(digit: number): { fill: string; stroke: string } {
  return COLORS[digit] || COLORS[0];
}

// Get the primary color for a number (based on ones digit or special rules)
function getPrimaryColor(num: number): { fill: string; stroke: string } {
  if (num <= 10) return COLORS[num] || COLORS[0];
  // For multi-digit, use the number's ones digit color, or tens digit if ones is 0
  const onesDigit = num % 10;
  if (onesDigit !== 0) return getColorForDigit(onesDigit);
  const tensDigit = Math.floor(num / 10) % 10;
  return getColorForDigit(tensDigit);
}

// Determine block arrangement: returns { cols, rows, extras }
function getArrangement(num: number): { cols: number; rows: number; extras: number } {
  if (num <= 0) return { cols: 1, rows: 1, extras: 0 };
  if (num === 1) return { cols: 1, rows: 1, extras: 0 };
  if (num === 2) return { cols: 1, rows: 2, extras: 0 };
  if (num === 3) return { cols: 1, rows: 3, extras: 0 };
  if (num === 4) return { cols: 2, rows: 2, extras: 0 };
  if (num === 5) return { cols: 1, rows: 5, extras: 0 };
  if (num === 6) return { cols: 2, rows: 3, extras: 0 };
  if (num === 7) return { cols: 1, rows: 7, extras: 0 };
  if (num === 8) return { cols: 2, rows: 4, extras: 0 };
  if (num === 9) return { cols: 3, rows: 3, extras: 0 };
  if (num === 10) return { cols: 2, rows: 5, extras: 0 };

  // 11-99: tens columns of 10 + extras
  if (num <= 99) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return { cols: tens, rows: 10, extras: ones };
  }

  // 100: 10x10
  if (num === 100) return { cols: 10, rows: 10, extras: 0 };

  // 101-999: hundreds as 10x10 slabs side-by-side + remainder
  if (num <= 999) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    // Main grid: hundreds * 10 cols × 10 rows
    return { cols: hundreds * 10, rows: 10, extras: remainder };
  }

  // 1000+: cap at reasonable visual
  const side = Math.ceil(Math.sqrt(Math.min(num, 400)));
  return { cols: side, rows: side, extras: 0 };
}

function buildSVG(num: number): string {
  const BLOCK_SIZE = 40;
  const BLOCK_GAP = 2;
  const PADDING = 20;
  const FACE_AREA_HEIGHT = 60; // space for face on top block
  const NUMBERLING_HEIGHT = 50;

  const color = getPrimaryColor(num);
  const { cols, rows, extras } = getArrangement(num);

  const cellSize = BLOCK_SIZE + BLOCK_GAP;
  const gridWidth = cols * cellSize - BLOCK_GAP;
  const gridHeight = rows * cellSize - BLOCK_GAP;

  // Extra blocks go on top-right
  const extrasRow = extras > 0 ? 1 : 0;
  const extrasWidth = extras > 0 ? extras * cellSize - BLOCK_GAP : 0;

  const totalWidth = Math.max(gridWidth, extrasWidth) + PADDING * 2;
  const totalGridHeight = gridHeight + (extrasRow > 0 ? cellSize : 0);
  const totalHeight = NUMBERLING_HEIGHT + totalGridHeight + FACE_AREA_HEIGHT / 2 + PADDING * 2;

  const startY = NUMBERLING_HEIGHT + PADDING;
  const startX = PADDING + (totalWidth - PADDING * 2 - gridWidth) / 2;

  let blocks = "";

  // Draw main grid (bottom-up visually: row 0 = top of grid)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * cellSize;
      const y = startY + (extrasRow > 0 ? cellSize : 0) + r * cellSize;
      blocks += `<rect x="${x}" y="${y}" width="${BLOCK_SIZE}" height="${BLOCK_SIZE}" rx="4" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/>`;
    }
  }

  // Draw extra blocks on top
  if (extras > 0) {
    const extrasStartX = startX;
    for (let e = 0; e < extras; e++) {
      const x = extrasStartX + e * cellSize;
      const y = startY;
      blocks += `<rect x="${x}" y="${y}" width="${BLOCK_SIZE}" height="${BLOCK_SIZE}" rx="4" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/>`;
    }
  }

  // Face on the top-left block
  const faceBlockX = startX;
  const faceBlockY = startY + (extrasRow > 0 ? 0 : 0);
  const faceCenterX = faceBlockX + BLOCK_SIZE / 2;
  const faceCenterY = faceBlockY + BLOCK_SIZE / 2;

  const eyeOffsetX = 7;
  const eyeY = faceCenterY - 4;
  const eyeRadius = 4;
  const pupilRadius = 2;

  const face = `
    <!-- Left eye -->
    <circle cx="${faceCenterX - eyeOffsetX}" cy="${eyeY}" r="${eyeRadius}" fill="white" stroke="#333" stroke-width="1.5"/>
    <circle cx="${faceCenterX - eyeOffsetX}" cy="${eyeY}" r="${pupilRadius}" fill="#333"/>
    <!-- Right eye -->
    <circle cx="${faceCenterX + eyeOffsetX}" cy="${eyeY}" r="${eyeRadius}" fill="white" stroke="#333" stroke-width="1.5"/>
    <circle cx="${faceCenterX + eyeOffsetX}" cy="${eyeY}" r="${pupilRadius}" fill="#333"/>
    <!-- Smile -->
    <path d="M ${faceCenterX - 6} ${faceCenterY + 4} Q ${faceCenterX} ${faceCenterY + 12} ${faceCenterX + 6} ${faceCenterY + 4}" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round"/>
  `;

  // Arms (simple lines from sides of the body)
  const armY = startY + (extrasRow > 0 ? cellSize : 0) + Math.min(2, rows - 1) * cellSize + BLOCK_SIZE / 2;
  const leftArmX = startX - 5;
  const rightArmX = startX + gridWidth + 5;
  const arms = `
    <!-- Left arm -->
    <line x1="${leftArmX}" y1="${armY}" x2="${leftArmX - 20}" y2="${armY + 15}" stroke="${color.stroke}" stroke-width="4" stroke-linecap="round"/>
    <!-- Right arm -->
    <line x1="${rightArmX}" y1="${armY}" x2="${rightArmX + 20}" y2="${armY + 15}" stroke="${color.stroke}" stroke-width="4" stroke-linecap="round"/>
  `;

  // Legs (from bottom of body)
  const legY = startY + (extrasRow > 0 ? cellSize : 0) + gridHeight;
  const legLeftX = startX + Math.floor(cols / 3) * cellSize + BLOCK_SIZE / 2;
  const legRightX = startX + Math.floor((cols * 2) / 3) * cellSize + BLOCK_SIZE / 2;
  const legs = `
    <!-- Left leg -->
    <line x1="${legLeftX}" y1="${legY}" x2="${legLeftX - 5}" y2="${legY + 25}" stroke="${color.stroke}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${legLeftX - 7}" cy="${legY + 28}" r="5" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/>
    <!-- Right leg -->
    <line x1="${legRightX}" y1="${legY}" x2="${legRightX + 5}" y2="${legY + 25}" stroke="${color.stroke}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${legRightX + 7}" cy="${legY + 28}" r="5" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/>
  `;

  // Numberling (digit on top)
  const numberlingX = totalWidth / 2;
  const numberlingY = PADDING + 10;
  const fontSize = num > 999 ? 18 : num > 99 ? 24 : 30;
  const numberling = `
    <text x="${numberlingX}" y="${numberlingY}" text-anchor="middle" dominant-baseline="hanging" 
          font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" 
          fill="${color.fill}" stroke="${color.stroke}" stroke-width="1">${num.toLocaleString()}</text>
  `;

  const finalHeight = totalHeight + 35; // extra for legs

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${finalHeight}" width="${totalWidth}" height="${finalHeight}">
  <rect width="100%" height="100%" fill="white" rx="12"/>
  ${numberling}
  ${blocks}
  ${face}
  ${arms}
  ${legs}
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log(`Generating programmatic SVG for Numberblock ${number}`);

    const svg = buildSVG(number);
    const svgBytes = new TextEncoder().encode(svg);

    // Upload SVG directly (browsers render SVGs natively)
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache it
    await supabase.from("numberblocks_cache").upsert(
      {
        number: number,
        storage_path: storagePath,
        original_url: "svg-generated",
      },
      { onConflict: "number" }
    );

    const { data: { publicUrl } } = supabase.storage
      .from("numberblocks-images")
      .getPublicUrl(storagePath);

    console.log(`SVG image for ${number} saved at ${storagePath}`);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl, svgGenerated: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SVG generation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
