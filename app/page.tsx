"use client";
export const config = {
api: {
bodyParser: false,
},
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
const { state, pwsid, health } = req.query as Record<string, string>;
const apiKey = process.env.DATA_GOV_API_KEY || "";


// Health probe
if (health) {
const probeURL = new URL("https://api.data.gov/echo/eff_rest_services.get_facility_info");
if (apiKey) {
probeURL.searchParams.set("p_uc", "Y");
}


let proxyOK = false;
let probeStatus = 0;
try {
const r = await fetch(probeURL.toString(), {
method: "GET",
headers: apiKey ? { "X-Api-Key": apiKey } : undefined,
cache: "no-store",
});
proxyOK = r.ok;
probeStatus = r.status;
} catch (e) {
proxyOK = false;
probeStatus = 0;
}
return res.status(200).json({ hasKey: !!apiKey, proxyOK, probeStatus });
}


// Build upstream URL – ECHO SDWIS endpoint
// NOTE: ECHO often expects API keys via the X-Api-Key header. We still append the query param for compatibility, but header is authoritative.
const upstream = new URL("https://api.data.gov/echo/dsdw_rest_services.get_systems");
if (state) upstream.searchParams.set("state", state);
if (pwsid) upstream.searchParams.set("pwsid", pwsid);


try {
const upstreamRes = await fetch(upstream.toString(), {
method: "GET",
headers: apiKey ? { "X-Api-Key": apiKey } : undefined,
cache: "no-store",
});


// Basic logging (redact key)
const safeURL = new URL(upstream.toString());
console.log(`[echo-proxy] GET ${safeURL.toString()} -> ${upstreamRes.status}`);


if (!upstreamRes.ok) {
const text = await upstreamRes.text();
// Pass through upstream status and body to help debugging
return res.status(upstreamRes.status).json({ error: true, status: upstreamRes.status, body: text.slice(0, 4000) });
}


// Normalize shape into { systems: [], violations: [] }
let payload: any = null;
try {
payload = await upstreamRes.json();
} catch (e) {
const text = await upstreamRes.text();
return res.status(502).json({ error: true, status: 502, body: text.slice(0, 4000), message: "Non-JSON response from upstream." });
}


const systems = Array.isArray(payload?.Results) ? payload.Results : payload?.systems || [];
const violations = Array.isArray(payload?.Violations) ? payload.Violations : payload?.violations || [];


return res.status(200).json({ systems, violations, meta: { source: "api.data.gov", fetchedAt: new Date().toISOString() } });
} catch (e: any) {
console.error("[echo-proxy] upstream fetch failed:", e?.message || e);
return res.status(502).json({ error: true, status: 502, message: "Upstream unreachable from server." });
}
}
