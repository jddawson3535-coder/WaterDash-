import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  try {
    const slug = (params.slug || []).join("/");
    const url = new URL(req.url);
    const qs = url.searchParams;

    // Attach API key if not already provided
    const apiKey = process.env.DATA_GOV_API_KEY;
    if (apiKey && !qs.get("api_key")) qs.set("api_key", apiKey);

    // Default to JSON output
    if (!qs.get("output")) qs.set("output", "JSON");

    const upstream = `https://echodata.epa.gov/echo/${slug}?${qs.toString()}`;

    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const body = await res.text();

    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Proxy error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
