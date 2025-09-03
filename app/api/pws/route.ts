// app/api/pws/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // no caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = (searchParams.get("state") || "").toUpperCase();
  const pwsid = searchParams.get("pwsid") || "";
  const debug = searchParams.get("debug") === "1"; // optional ?debug=1 to echo upstream URL
  const apiKey = process.env.DATA_GOV_API_KEY || "";

  if (!apiKey) {
    return NextResponse.json(
      { error: true, message: "DATA_GOV_API_KEY missing" },
      { status: 403 }
    );
  }
  if (!pwsid) {
    return NextResponse.json(
      { error: true, message: "pwsid required" },
      { status: 400 }
    );
  }

  // ✅ Correct base: api.epa.gov (NOT api.data.gov)
  const upstream = new URL("https://api.epa.gov/echo/dsdw_rest_services.get_systems");
  if (state) upstream.searchParams.set("state", state);
  upstream.searchParams.set("pwsid", pwsid);
  upstream.searchParams.set("output", "JSON");    // request JSON payload
  upstream.searchParams.set("api_key", apiKey);   // add as param for compatibility

  const upstreamUrl = upstream.toString();
  console.log("[/api/pws] GET ->", upstreamUrl);

  try {
    const resp = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,          // header auth (belt + suspenders)
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (debug) {
      // helpful for verifying which host/path is actually being called
      return NextResponse.json({ upstreamUrl, status: resp.status });
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new NextResponse(text.slice(0, 4000), {
        status: resp.status,
        headers: { "content-type": resp.headers.get("content-type") || "text/plain" },
      });
    }

    let payload: any;
    try {
      payload = await resp.json();
    } catch {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: true, status: 502, message: "Non-JSON response from upstream.", body: text.slice(0, 4000), upstreamUrl },
        { status: 502 }
      );
    }

    // ECHO typically returns arrays under Results/Violations
    const systems = Array.isArray(payload?.Results) ? payload.Results : payload?.systems || [];
    const violations = Array.isArray(payload?.Violations) ? payload.Violations : payload?.violations || [];

    return NextResponse.json({
      systems,
      violations,
      meta: { source: "api.epa.gov", fetchedAt: new Date().toISOString(), upstreamUrl },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: true, status: 502, message: "Upstream unreachable", detail: e?.message, upstreamUrl },
      { status: 502 }
    );
  }
}
