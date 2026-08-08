// Shared verification helper.
//
// Given an image and a target number, ask a vision model whether the picture
// really shows ONE Numberblocks character built from exactly that many blocks.
// Used on cache-miss writes only, so cache hits stay free.

export interface VerificationResult {
  verified: boolean;
  note: string;
  /** true when we could not run the check at all (no key, network error). */
  skipped?: boolean;
}

const VISION_MODEL = "gpt-4o-mini";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function buildPrompt(num: number): string {
  return `This image is supposed to show the Numberblocks character for the number ${num.toLocaleString()}.

Answer strictly as JSON with these keys:
{
  "single_character": true|false,   // exactly one Numberblocks character, not a group scene, not a logo, not fan-art collage
  "block_count": number|null,       // how many cube blocks the character is made of, null if you cannot count reliably
  "shown_number": number|null,      // the number written on/near the character (the Numberling), null if none
  "correct": true|false,            // does this picture correctly represent Numberblock ${num}?
  "note": "short reason, max 15 words"
}

Be strict: if it is a different Numberblock, a group of characters, a title card, or the block count clearly disagrees with ${num}, set correct to false.
${num > 100 ? `For large numbers exact counting is impossible - judge by the written number and the structure instead.` : ""}`;
}

async function callVision(
  apiKey: string,
  dataUrl: string,
  num: number,
): Promise<VerificationResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(num) },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Verification model error:", response.status, errorText);
    return { verified: false, note: "verifier unavailable", skipped: true };
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return { verified: false, note: "verifier returned nothing", skipped: true };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { verified: false, note: "verifier returned bad JSON", skipped: true };
  }

  const single = parsed.single_character !== false;
  const correct = parsed.correct === true;
  const note = typeof parsed.note === "string" ? parsed.note.slice(0, 200) : "";
  const blockCount = typeof parsed.block_count === "number" ? parsed.block_count : null;

  // For small numbers we also enforce the reported block count, since a model
  // that says "correct" while counting 3 blocks for 5 is contradicting itself.
  if (num <= 20 && blockCount !== null && blockCount !== num) {
    return { verified: false, note: note || `counted ${blockCount} blocks, expected ${num}` };
  }

  return {
    verified: single && correct,
    note: note || (single && correct ? "verified" : "rejected by verifier"),
  };
}

/** Verify raw image bytes already in memory. */
export async function verifyImageBytes(
  bytes: Uint8Array,
  contentType: string,
  num: number,
): Promise<VerificationResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { verified: false, note: "no verifier configured", skipped: true };

  // SVG is not accepted by vision models; our renders are correct by construction.
  if (contentType.includes("svg")) {
    return { verified: true, note: "deterministic render" };
  }

  try {
    const dataUrl = `data:${contentType};base64,${bytesToBase64(bytes)}`;
    return await callVision(apiKey, dataUrl, num);
  } catch (error) {
    console.error("Verification error:", error);
    return { verified: false, note: "verifier error", skipped: true };
  }
}

/** Verify an image that lives at a public URL. */
export async function verifyImageUrl(imageUrl: string, num: number): Promise<VerificationResult> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://numberblocks.fandom.com/",
      },
    });
    if (!res.ok) return { verified: false, note: "image not reachable", skipped: true };
    const contentType = res.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await verifyImageBytes(bytes, contentType, num);
  } catch (error) {
    console.error("Verification fetch error:", error);
    return { verified: false, note: "verifier error", skipped: true };
  }
}
