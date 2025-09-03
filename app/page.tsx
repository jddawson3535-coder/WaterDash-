"use client";

import React, { useMemo, useState } from "react";

type PwsResult = {
  systems: any[];
  violations: any[];
  meta?: { source?: string; fetchedAt?: string; upstreamUrl?: string };
  cap?: { score?: number | null; updated?: string | null } | null;
};

type AdvisorInput = {
  tankLevelPct?: number;
  pressurePsi?: number;
  flowGpm?: number;
  chlorineMgL?: number;
  turbidityNTU?: number;
  callsLastHour?: number;
};

export default function HomePage() {
  const [stateCode, setStateCode] = useState("OK");
  const [pwsid, setPwsid] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PwsResult | null>(null);

  // SCADA inputs
  const [tankLevelPct, setTankLevelPct] = useState("");
  const [pressurePsi, setPressurePsi] = useState("");
  const [flowGpm, setFlowGpm] = useState("");
  const [chlorineMgL, setChlorineMgL] = useState("");
  const [turbidityNTU, setTurbidityNTU] = useState("");
  const [callsLastHour, setCallsLastHour] = useState("");

  const advisorIn: AdvisorInput = useMemo(
    () => ({
      tankLevelPct: toNum(tankLevelPct),
      pressurePsi: toNum(pressurePsi),
      flowGpm: toNum(flowGpm),
      chlorineMgL: toNum(chlorineMgL),
      turbidityNTU: toNum(turbidityNTU),
      callsLastHour: toNum(callsLastHour),
    }),
    [tankLevelPct, pressurePsi, flowGpm, chlorineMgL, turbidityNTU, callsLastHour]
  );

  const recommendations = useMemo(() => makeRecommendations(advisorIn), [advisorIn]);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      if (!pwsid || pwsid.length < 5) throw new Error("Enter a valid PWSID (e.g., OK1020304)");

      // ECHO/SDWIS data
      const u = new URL("/api/pws", window.location.origin);
      u.searchParams.set("state", stateCode.trim().toUpperCase());
      u.searchParams.set("pwsid", pwsid.trim());
      const r = await fetch(u.toString(), { method: "GET" });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`Fetch failed (HTTP ${r.status}). ${text.slice(0, 200)}`);
      }
      const base: PwsResult = await r.json();

      // CAP score (optional)
      let cap: PwsResult["cap"] = null;
      try {
        const capU = new URL("/api/deq-cap", window.location.origin);
        capU.searchParams.set("pwsid", pwsid.trim());
        const cr = await fetch(capU.toString());
        if (cr.ok) cap = await cr.json();
      } catch {
        /* ignore */
      }

      setData({ ...base, cap });
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const speak = () => {
    const text = recommendations.join(" \n");
    try {
      const u = new SpeechSynthesisUtterance(text || "No recommendation at this time.");
      u.rate = 1.0;
      u.pitch = 1.0;
      u.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  };

  return (
    <main style={page}>
      <div style={container}>
        <header style={headerRow}>
          <h1 style={{ margin: 0 }}>Water Dash</h1>
          <a href="/admin/diagnostics" style={link}>Diagnostics</a>
        </header>

        <div style={card}>
          <div style={grid3}>
            <div>
              <label style={label}>State</label>
              <input style={input} maxLength={2} value={stateCode} onChange={(e) => setStateCode(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label style={label}>PWSID</label>
              <input style={input} placeholder="OK1020304" value={pwsid} onChange={(e) => setPwsid(e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={handleFetch} disabled={loading} style={button(loading)}>
                {loading ? "Fetching…" : "Apply & Reload"}
              </button>
            </div>
          </div>
          {(pwsid || stateCode) && (
            <div style={banner}>Running query: {`STATE=${stateCode.toUpperCase()}${pwsid ? " • PWSID=" + pwsid : ""}`}</div>
          )}
        </div>

        {error && (
          <div style={errorBox}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{error}</div>
            <div style={mutedSmall}>Tip: Ensure <code>DATA_GOV_API_KEY</code> is set and the PWSID is valid.</div>
          </div>
        )}

        {data && (
          <section style={grid2}>
            <div style={card}>
              <div style={sectionTitle}>System</div>
              <ul style={ul}>
                {(data.systems || []).slice(0, 10).map((s: any, i: number) => (
                  <li key={i} style={li}>
                    <div style={{ fontWeight: 600 }}>{s.PWS_NAME || s.name || "(unknown)"}</div>
                    <div style={mutedSmall}>PWSID: {s.PWSID || s.pwsid || "—"}</div>
                    {s.CITY && <div style={mutedSmall}>City: {s.CITY}</div>}
                    {s.STATUS && <div style={mutedSmall}>Status: {s.STATUS}</div>}
                  </li>
                ))}
                {(!data.systems || data.systems.length === 0) && <li style={empty}>No systems returned.</li>}
              </ul>
            </div>

            <div style={card}>
              <div style={sectionTitle}>Violations</div>
              <ul style={ul}>
                {(data.violations || []).slice(0, 10).map((v: any, i: number) => (
                  <li key={i} style={li}>
                    <div style={{ fontWeight: 600 }}>{v.VIOLATION_ID || v.code || "Violation"}</div>
                    <div style={mutedSmall}>Type: {v.VIOLATION_TYPE || v.type || "—"}</div>
                    <div style={mutedSmall}>Status: {v.STATUS || v.status || "—"}</div>
                  </li>
                ))}
                {(!data.violations || data.violations.length === 0) && <li style={empty}>No violations returned.</li>}
              </ul>
            </div>

            <div style={card}>
              <div style={sectionTitle}>Capacity Development (DEQ)</div>
              {data.cap?.score != null ? (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{data.cap.score}</div>
                  <div style={mutedSmall}>Last updated: {data.cap.updated || "—"}</div>
                </div>
              ) : (
                <div style={mutedSmall}>No CAP score available for this PWSID yet.</div>
              )}
            </div>

            <div style={card}>
              <div style={sectionTitle}>SCADA Advisor</div>
              <div style={scadaGrid}>
                <Field label="Tank Level %" val={tankLevelPct} setVal={setTankLevelPct} placeholder="e.g., 35" />
                <Field label="Pressure (psi)" val={pressurePsi} setVal={setPressurePsi} placeholder="e.g., 38" />
                <Field label="Flow (gpm)" val={flowGpm} setVal={setFlowGpm} placeholder="e.g., 420" />
                <Field label="Free Chlorine (mg/L)" val={chlorineMgL} setVal={setChlorineMgL} placeholder="e.g., 0.2" />
                <Field label="Turbidity (NTU)" val={turbidityNTU} setVal={setTurbidityNTU} placeholder="e.g., 0.4" />
                <Field label="Customer Calls (1h)" val={callsLastHour} setVal={setCallsLastHour} placeholder="e.g., 9" />
              </div>
              <div style={{ marginTop: 10 }}>
                <button onClick={speak} style={button(false)}>🔊 Speak Recommendation</button>
              </div>
              <ul style={{ marginTop: 8 }}>
                {recommendations.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
                {recommendations.length === 0 && <li style={mutedSmall}>Enter SCADA points to get guidance.</li>}
              </ul>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({ label, val, setVal, placeholder }: any) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={input} value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// styles
const page: React.CSSProperties = { background: "#F7FAFC", minHeight: "100vh", color: "#0E2033", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto" };
const container: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: 24 };
const headerRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 };
const link: React.CSSProperties = { color: "#2389DA", textDecoration: "none" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5eef7", borderRadius: 16, padding: 16, boxShadow: "0 2px 6px rgba(15,94,156,.06),0 1px 2px rgba(14,32,51,.06)" };
const grid3: React.CSSProperties = { display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0,1fr))" };
const grid2: React.CSSProperties = { display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0,1fr))", marginTop: 16 };
const label: React.CSSProperties = { fontSize: 12, color: "#6B7A8C" };
const labelStyle = label;
const input: React.CSSProperties = { width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cfd9e6", marginTop: 6 };
const banner: React.CSSProperties = { marginTop: 10, background: "#E7EEF5", border: "1px solid "#B7D3EA", padding: "8px 12px", borderRadius: 12, fontSize: 14 };
const errorBox: React.CSSProperties = { marginTop: 12, background: "#fdeaea", border: "1px solid #f2c7c7", color: "#4b1f1f", borderRadius: 12, padding: 10 };
const sectionTitle: React.CSSProperties = { fontWeight: 600, marginBottom: 8 };
const mutedSmall: React.CSSProperties = { color: "#6B7A8C", fontSize: 12 };
const ul: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0 };
const li: React.CSSProperties = { border: "1px solid #e5eef7", borderRadius: 12, padding: 10, marginBottom: 8 };
const empty: React.CSSProperties = { border: "1px dashed #d7e3ef", borderRadius: 16, padding: 18, textAlign: "center", background: "#fff", marginTop: 8 };
const scadaGrid: React.CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0,1fr))" };
const button = (disabled: boolean): React.CSSProperties => ({ background: disabled ? "#2389DA99" : "#0F5E9C", cursor: disabled ? "not-allowed" : "pointer", color: "#fff", border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 600 });

// utils
function toNum(v?: string): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function makeRecommendations(inp: AdvisorInput): string[] {
  const out: string[] = [];
  const lvl = inp.tankLevelPct ?? NaN;
  const psi = inp.pressurePsi ?? NaN;
  const flow = inp.flowGpm ?? NaN;
  const cl = inp.chlorineMgL ?? NaN;
  const turb = inp.turbidityNTU ?? NaN;
  const calls = inp.callsLastHour ?? NaN;

  if (!Number.isNaN(lvl) && lvl < 30) out.push("Tank level is low (<30%). Start/verify wells/boosters; check VFD setpoints.");
  if (!Number.isNaN(psi) && psi < 35) out.push("Distribution pressure <35 psi. Investigate booster operation and possible main break.");
  if (!Number.isNaN(flow) && flow > 500) out.push("High flow >500 gpm. Confirm demand spike or suspected leak; review district meters.");
  if (!Number.isNaN(cl) && cl < 0.2) out.push("Free chlorine <0.2 mg/L. Increase residual (adjust dose or flush dead-ends) and resample.");
  if (!Number.isNaN(turb) && turb > 1) out.push("Turbidity >1 NTU. Check filters/clarification; investigate source water.");
  if (!Number.isNaN(calls) && calls >= 5) out.push("Multiple customer calls. Activate incident comms and dispatch field check.");

  if (out.length === 0) out.push("All inputs within nominal ranges. Continue routine operations; monitor trends.");
  out.push("Log actions in ops log and note any public notification requirements if thresholds persist.");
  return out;
}
