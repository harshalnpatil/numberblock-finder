export function getRequestCountry(request: Request): string {
  // Use the country supplied by the Supabase Cloudflare gateway.
  return request.headers.get("cf-ipcountry")?.trim().toUpperCase() ?? "";
}

export function countryBlockResponse(
  country: string,
  corsHeaders: HeadersInit,
  { alsoBlockVietnam = false }: { alsoBlockVietnam?: boolean } = {},
): Response | undefined {
  if (
    country !== "CN" && country !== "RU" &&
    !(alsoBlockVietnam && country === "VN")
  ) {
    return;
  }

  const headers = new Headers(corsHeaders);
  headers.set("Cache-Control", "no-store");
  return Response.json(
    { success: false, error: "Service unavailable in your region" },
    { status: 403, headers },
  );
}
