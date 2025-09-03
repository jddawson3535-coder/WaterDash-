// app/api/deq-cap/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PWS_FIELD = (process.env.DEQ_CAP_PWSID_FIELD || "PWSID").toUpperCase();
const SCORE_FIELD = (process.env.DEQ_CAP_SCORE_FIELD || "SCORE").toUpperCase();
const UPDATED_FIELD = (process.env.DEQ_CAP_UPDATED_FIELD || "UPDATED").toUpperCase();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pwsid = (searchParams.get("pwsid") || "").trim();
  const src = (process.env.DEQ_CAP_SCORE_URL || "").trim();

  if (!pwsid || !src) return NextResponse.json({ score: null, updated: null });

  try {
    const r = await fetch(src, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ score: null, updated: null });

    const ctype = (r.headers.get("content-type") || "").toLowerCase();

    // ---------- JSON ----------
    if (ctype.includes("application/json") || src.endsWith(".json")) {
      const data = await r.json();

      // Accept either an array, or an object with a top-level array property.
      const arr: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).rows)
        ? (data as any).rows
        : Array.isArray((data as any).data)
        ? (data as any).data
        : [];

      const row =
        arr.find(
          (x) =>
            String(x[PWS_FIELD] ?? x.pwsid ?? x.PWSID ?? "").toUpperCase() ===
            pwsid.toUpperCase()
        ) || null;

      return NextResponse.json({
        score:
          row?.[SCORE_FIELD] ??
          row?.score ??
          (Number.isFinite(Number(row?.SCORE)) ? Number(row?.SCORE) : null) ??
          null,
        updated: row?.[UPDATED_FIELD] ?? row?.updated ?? row?.UPDATED ?? null,
      });
    }

    // ---------- CSV ----------
    // Read text and normalize BOM/CRLF
    let text = await r.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    const lines = text.split(/\r?\n/).filter((ln) => ln.trim() !== "");
    if (lines.length === 0) return NextResponse.json({ score: null, updated: null });

    // Simple CSV split (no embedded commas/quotes). If you need full CSV parsing later, we can swap in a parser.
    const split = (s: string) =>
      s
        .split(",")
        .map((v) => v.trim().replace(/^"(.*)"$/, "$1"));

    const header = split(lines.shift()!).map((h) => h.toUpperCase());
    const iP = header.indexOf(PWS_FIELD) >= 0 ? header.indexOf(PWS_FIELD) : header.indexOf("PWSID");
    const iS = header.indexOf(SCORE_FIELD) >= 0 ? header.indexOf(SCORE_FIELD) : header.indexOf("SCORE");
    const iU = header.indexOf(UPDATED_FIELD) >= 0 ? header.indexOf(UPDATED_FIELD) : header.indexOf("UPDATED");

    for (const line of lines) {
      const parts = split(line);
      if (iP < 0 || !parts[iP]) continue;
      if (String(parts[iP]).toUpperCase() === pwsid.toUpperCase()) {
        const n = Number(parts[iS]);
        const score = Number.isFinite(n) ? n : null;
        const updated = iU >= 0 ? parts[iU] || null : null;
        return NextResponse.json({ score, updated });
      }
    }

    return NextResponse.json({ score: null, updated: null });
  } catch {
    return NextResponse.json({ score: null, updated: null });
  }
}
