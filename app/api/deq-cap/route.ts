// app/api/deq-cap/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // disable caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pwsid = String(searchParams.get("pwsid") || "");
  const src = process.env.DEQ_CAP_SCORE_URL || "";

  if (!pwsid) return NextResponse.json({ score: null, updated: null });
  if (!src) return NextResponse.json({ score: null, updated: null });

  try {
    const r = await fetch(src, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ score: null, updated: null });

    const ctype = (r.headers.get("content-type") || "").toLowerCase();

    // JSON source
    if (ctype.includes("application/json") || src.endsWith(".json")) {
      const arr = await r.json();
      const row = Array.isArray(arr)
        ? arr.find(
            (x: any) =>
              String(x.PWSID || x.pwsid).toUpperCase() === pwsid.toUpperCase()
          )
        : null;
      return NextResponse.json({
        score: row?.SCORE ?? row?.score ?? null,
        updated: row?.UPDATED ?? row?.updated ?? null,
      });
    }

    // CSV source
    const text = await r.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0)
      return NextResponse.json({ score: null, updated: null });

    const header = lines
      .shift()!
      .split(",")
      .map((s) => s.trim().toUpperCase());
    const iP = header.indexOf("PWSID");
    const iS = header.indexOf("SCORE");
    const iU = header.indexOf("UPDATED");

    for (const line of lines) {
      const parts = line.split(",");
      if (!parts[iP]) continue;
      if (String(parts[iP]).toUpperCase() === pwsid.toUpperCase()) {
        const scoreNum = Number(parts[iS]);
        const score = Number.isFinite(scoreNum) ? scoreNum : null;
        const updated = parts[iU] || null;
        return NextResponse.json({ score, updated });
      }
    }

    return NextResponse.json({ score: null, updated: null });
  } catch {
    return NextResponse.json({ score: null, updated: null });
  }
}
