// app/api/pws/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // disable caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = (searchParams.get("state") || "").toUpperCase();
  const pwsid = searchParams.get("pwsid") || "";
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

  const upstream = new URL(
    "https://api.data.gov/echo/dsdw_rest_services.get_systems"
  );
  if (state) upstream.searchParams.set("state", state);
  upstream.searchParams.set("pwsid", pwsid);

  try {
    const resp = await fetch(upstream.toString(), {
      method: "GET",
      headers: { "X-Api-Key": apiKey },
      cache: "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new NextResponse(text.slice(0, 4000), {
        status: resp.status,
        headers: {
          "content-type": resp.headers.get("content-type") || "text/plain",
        },
      });
    }

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
        },
        { status: 502 }
      );
    }

    const systems = Array.isArray(payload?.Results)
      ? payload.Results
      : payload?.systems || [];
    const violations = Array.isArray(payload?.Violations)
      ? payload.Violations
      : payload?.violations || [];

    return NextResponse.json({
      systems,
      violations,
      meta: { source: "api.data.gov", fetchedAt: new Date().toISOString() },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: true, status: 502, message: "Upstream unreachable", detail: e?.message },
      { status: 502 }
    );
  }
}
