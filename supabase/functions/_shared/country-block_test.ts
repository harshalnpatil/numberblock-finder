import { countryBlockResponse, getRequestCountry } from "./country-block.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("China and Russia return a non-cacheable CORS 403", async () => {
  for (const country of ["cn", " RU "]) {
    const request = new Request("https://example.test", {
      headers: { "cf-ipcountry": country, "x-country-code": "IE" },
    });
    const response = countryBlockResponse(getRequestCountry(request), {
      "Access-Control-Allow-Origin": "https://example.test",
    });
    assert(response?.status === 403, `${country} should be blocked`);
    assert(
      response?.headers.get("Cache-Control") === "no-store",
      "403 is cacheable",
    );
    assert(
      response?.headers.get("Access-Control-Allow-Origin") ===
        "https://example.test",
      "403 lost the CORS response header",
    );
    assert(
      (await response?.json()).success === false,
      "403 body is missing the error result",
    );
  }
});

Deno.test("Vietnam remains blocked on the original routes only", () => {
  assert(
    countryBlockResponse("VN", {}) === undefined,
    "Vietnam was blocked on a new route",
  );
  assert(
    countryBlockResponse("VN", {}, { alsoBlockVietnam: true })?.status === 403,
    "Vietnam was unblocked on an original route",
  );
});

Deno.test("Allowed and unknown countries pass without trusting fallback headers", () => {
  for (const country of ["IE", "US", "XX", ""]) {
    const request = new Request("https://example.test", {
      headers: {
        "cf-ipcountry": country,
        "x-country-code": "RU",
        "x-vercel-ip-country": "CN",
      },
    });
    assert(
      countryBlockResponse(getRequestCountry(request), {}) === undefined,
      `${country || "Unknown country"} should pass`,
    );
  }
});
