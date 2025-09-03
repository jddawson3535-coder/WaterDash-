// app/api/pws/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // no caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = (searchParams.get("state") || "").toUpperCase().trim();
  const pwsid = (searchParams.get("pwsid") || "").trim();
  const debug = searchParams.get("debug") === "1";
  const apiKey = (process.env.DATA_GOV_API_KEY || "").trim();

  // ---- Input & env checks ----
  if (!apiKey) {
    return NextResponse.json(
      { error: true, message: "DATA_GOV_API_KEY missing" },
      { status: 403 }
    );
  }

  // Allow PWSID OR State (must have at least one)
  if (!pwsid && !state) {
    return NextResponse.json(
      { error: true, message: "Provide at least a PWSID or a State (2-letter)." },
      { status: 400 }
    );
  }

  // ---- Upstream request (api.epa.gov) ----
  const upstream = new URL("https://api.epa.gov/echo/dsdw_rest_services.get_systems");
  if (state) upstream.searchParams.set("state", state);
  if (pwsid) upstream.searchParams.set("pwsid", pwsid);
  upstream.searchParams.set("output", "JSON");     // request JSON
  upstream.searchParams.set("api_key", apiKey);    // query param

  const upstreamUrl = upstream.toString();
  console.log("[/api/pws] GET ->", upstreamUrl);

  try {
    const resp = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,         // header auth too
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (debug) {
      // Quick probe to confirm which URL/host was called
      return NextResponse.json({ upstreamUrl, status: resp.status });
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const friendly =
        resp.status === 429
          ? "We hit api.epa.gov rate limits — try again in ~60s."
          : resp.status === 400
          ? "Upstream says the request is invalid — double-check the PWSID/state."
          : undefined;

      return new NextResponse(text.slice(0, 4000) || friendly || "Upstream error", {
        status: resp.status,
        headers: { "content-type": resp.headers.get("content-type") || "text/plain" },
      });
    }

    // Parse JSON
    let payload: any;
    try {
      payload = await resp.json();
    } catch {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        {
          error: true,
          status: 502,
          message: "Non-JSON response from upstream.",
          body: text.slice(0, 4000),
          upstreamUrl,
        },
        { status: 502 }
      );
    }

    // Normalize to { systems: [], violations: [] }
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
