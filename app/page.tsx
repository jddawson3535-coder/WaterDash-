// app/api/pws/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // disable caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Inputs
  const state = (searchParams.get("state") || "").toUpperCase();
  const pwsid = searchParams.get("pwsid") || "";
  const health = searchParams.get("health") === "1"; // optional health probe
  const apiKey = process.env.DATA_GOV_API_KEY || "";

  // ---- Health probe ----
  if (health) {
    const probeURL = new URL("https://api.epa.gov/echo/eff_rest_services.get_facility_info");
    probeURL.searchParams.set("p_uc", "Y");
    if (apiKey) probeURL.searchParams.set("api_key", apiKey);

    let proxyOK = false;
    let probeStatus = 0;
    try {
      const r = await fetch(probeURL.toString(), {
        method: "GET",
        headers: apiKey ? { "X-Api-Key": apiKey, Accept: "application/json" } : { Accept: "application/json" },
        cache: "no-store",
      });
      proxyOK = r.ok;
      probeStatus = r.status;
    } catch {
      proxyOK = false;
      probeStatus = 0;
    }
    return NextResponse.json({ hasKey: !!apiKey, proxyOK, probeStatus });
  }

  // ---- Input validation ----
  if (!apiKey) {
    return NextResponse.json({ error: true, message: "DATA_GOV_API_KEY missing" }, { status: 403 });
  }
  if (!pwsid) {
    return NextResponse.json({ error: true, message: "pwsid required" }, { status: 400 });
  }

  // ---- Upstream (✅ correct host) ----
  // ECHO SDWIS systems endpoint
  const upstream = new URL("https://api.epa.gov/echo/dsdw_rest_services.get_systems");
  if (state) upstream.searchParams.set("state", state);
  upstream.searchParams.set("pwsid", pwsid);
  upstream.searchParams.set("output", "JSON");
  upstream.searchParams.set("api_key", apiKey); // also send as query for compatibility

  const upstreamUrl = upstream.toString();
  console.log("[/api/pws] ->", upstreamUrl);

  try {
    const resp = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,      // header auth (belt + suspenders)
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new NextResponse(text.slice(0, 4000), {
        status: resp.status,
        headers: { "content-type": resp.headers.get("content-type") || "text/plain" },
      });
    }

    // Try to parse JSON
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

    // Normalize
    const systems = Array.isArray(payload?.Results) ? payload.Results : payload?.systems || [];
    const violations = Array.isArray(payload?.Violations) ? payload.Violations : payload?.violations || [];

    return NextResponse.json({
      systems,
      violations,
      meta: { source: "api.epa.gov", fetchedAt: new Date().toISOString(), upstreamUrl },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: true, status: 502, message: "Upstream unreachable", detail: e?.message },
      { status: 502 }
    );
  }
}
