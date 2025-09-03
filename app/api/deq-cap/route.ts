// app/api/echo/[...slug]/route.ts
import { NextRequest } from "next/server";

// If you see env-var issues on Edge, swap to nodejs:
// export const runtime = "nodejs";
export const runtime = "edge";
export const dynamic = "force-dynamic"; // no caching of API responses

// Allow-list of ECHO service prefixes we expect to proxy
const ALLOWED_PREFIXES = [
  "dsdw_rest_services.",  // SDWIS (drinking water)
  "eff_rest_services.",   // Effluent/ICIS
  "echo_rest_services.",  // General ECHO
];

function isAllowedSlug(slug: string) {
  return ALLOWED_PREFIXES.some((p) => slug.startsWith(p));
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  try {
    const parts = params.slug || [];
    const slug = parts.join("/").trim();

    if (!slug || !isAllowedSlug(slug)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing ECHO service path." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const qs = url.searchParams;

    // Attach API key
    const apiKey = process.env.DATA_GOV_API_KEY || "";
    if (apiKey && !qs.get("api_key")) qs.set("api_key", apiKey);

    // Default to JSON output
    if (!qs.get("output")) qs.set("output", "JSON");

    // Recommended host for ECHO web services
    const upstream = `https://api.epa.gov/echo/${slug}?${qs.toString()}`;

    const res = await fetch(upstream, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { "X-Api-Key": apiKey } : {}),
      },
      cache: "no-store",
    });

    // Pass-through body and content-type
    const body = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";

    return new Response(body, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Proxy error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
