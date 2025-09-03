"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw, FileText, ClipboardList, Download } from "lucide-react";
function useLocalStorage<T>(key:string, initial:T){ const [state,setState]=useState<T>(()=>{ try{ const raw=localStorage.getItem(key); return raw? JSON.parse(raw): initial }catch{return initial}}); useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)) }catch{}},[key,state]); return [state,setState] as const }
type EchoSystem={ PWSID?:string; PWSName?:string; City?:string; County?:string; PopulationServed?:string; OwnerType?:string }
type EchoViolation={ PWSID?:string; ViolationCode?:string; ViolationType?:string; Contaminant?:string; BeginDate?:string; EndDate?:string; IsSignificant?:string }
async function fetchJSON(url:string, signal?:AbortSignal){ const r=await fetch(url,{signal}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }
const fmtDate=(iso?:string)=> iso? new Date(iso+(iso.length===10?"T00:00:00":"")).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}) : "";
const esc=(s:string)=> String(s||"").replace(/[<>]/g, m=> m=="<"?"&lt;":">");
export function PlanBuilder(){
  const [useProxy]=useLocalStorage("use_proxy",true); const [apiKey]=useLocalStorage("echo_api_key",""); const [state]=useLocalStorage("state","OK"); const [county]=useLocalStorage("county",""); const [pwsid]=useLocalStorage("pwsid","");
  const [horizon,setHorizon]=useLocalStorage("plan_horizon",5); const [growth,setGrowth]=useLocalStorage("plan_growth_pct",1.5); const [budget,setBudget]=useLocalStorage("plan_budget",250000);
  const [assets,setAssets]=useLocalStorage("plan_assets","Well 1 (1985) | condition: Fair | est. cost: 120000\nElevated Tank (1998) | condition: Good | est. cost: 300000\nSCADA Panel (2006) | condition: Poor | est. cost: 45000");
  const [hazards,setHazards]=useLocalStorage("plan_hazards","Power outage, Drought, Extreme cold, Flooding");
  const [objectives,setObjectives]=useLocalStorage("plan_objectives","Reduce water loss to <10%\nMaintain chlorine 0.5–1.5 mg/L\nReplace 100% LSLs by 2029");
  const [systems,setSystems]=useState<EchoSystem[]>([]); const [violations,setViolations]=useState<EchoViolation[]>([]); const [loading,setLoading]=useState(false); const [err,setErr]=useState<string|null>(null);
  const buildEchoUrl=(path:string, qs:Record<string,string|undefined>)=>{ const base=useProxy?"/api/echo":"https://echodata.epa.gov/echo"; const params=new URLSearchParams({output:"JSON", state_abbr: state}); if(!useProxy&&apiKey) params.set("api_key", apiKey); if(county) params.set("county", county); if(pwsid) params.set("p_pwsid", pwsid); for(const [k,v] of Object.entries(qs)) if(v) params.set(k,v); return `${base}${path}?${params.toString()}` }
  const load=async()=>{ setErr(null); setLoading(true); try{ const [sys,vio]=await Promise.all([fetchJSON(buildEchoUrl("/sdw_rest_services.get_systems",{})), fetchJSON(buildEchoUrl("/sdw_rest_services.get_violations",{}))]); setSystems(Array.isArray(sys?.Results?.Systems)? sys.Results.Systems:[]); setViolations(Array.isArray(vio?.Results?.Violations)? vio.Results.Violations:[]) }catch(e:any){ setErr(e?.message||"Failed to load") } finally{ setLoading(false) } }
  React.useEffect(()=>{ load() },[]);
  const sys = useMemo(()=> (pwsid? systems.find(s=> (s.PWSID||"")===pwsid): systems?.[0]), [systems, pwsid]);
  function parseAssets(lines:string){ return lines.split("\n").map(raw=>{ const nameMatch=raw.match(/^(.+?)(?:\s*\(|\|)/i); const yearMatch=raw.match(/\((\d{4})\)/); const condMatch=raw.match(/condition:\s*(Good|Fair|Poor)/i); const costMatch=raw.match(/est\.?\s*cost:\s*([\d,]+)/i); const name=nameMatch? nameMatch[1].trim():raw.trim(); const year=yearMatch? parseInt(yearMatch[1],10):undefined; const cond=(condMatch? condMatch[1]:"fair").toLowerCase(); const cost=costMatch? parseInt(costMatch[1].replace(/[^\d]/g,""),10):undefined; const age=year? (new Date().getFullYear()-year):20; const condScore=cond==="poor"?3:cond==="fair"?2:1; const ageScore=age>=30?3:age>=15?2:1; const risk=condScore+ageScore; return { name,year,cond,age,cost,risk } }) }
  const significant=(violations||[]).filter(v=> (v.IsSignificant||"").toUpperCase()==="Y");
  const capSorted=[...parseAssets(assets)].sort((a,b)=> (b.risk-a.risk)||((b.cost||0)-(a.cost||0)));
  const totalCap=capSorted.reduce((s,a)=> s+(a.cost||0),0); const yearsToFund = budget>0? Math.ceil(totalCap/budget): horizon;
  const md = `# Sustainability & Capital Plan – ${esc(sys?.PWSName||"Selected System")} (${esc(sys?.PWSID||"N/A")})

**Jurisdiction:** ${esc(sys?.City||"—")}, ${esc(sys?.County||"—")}  
**Population Served:** ${esc(sys?.PopulationServed||"—")}  
**Owner Type:** ${esc(sys?.OwnerType||"—")}

## 1) Current Compliance & Risks
- **Significant Violations (past window):** ${significant.length}
${significant.slice(0,10).map(v=> `  - ${(v.ViolationType||v.ViolationCode||"Violation")} – ${(v.Contaminant||"")} (${fmtDate(v.BeginDate)} to ${fmtDate(v.EndDate)})`).join("\n") || "  - None observed in current pull"}

## 2) Objectives (Next ${horizon} Years)
${objectives.split("\n").map(x=> `- ${x}`).join("\n")}

## 3) System Capacity & Growth Planning
- **Assumed growth:** ${growth}%/year  
- **Planning horizon:** ${horizon} years  
- **Budget target:** $${budget.toLocaleString()} per year
- **Key hazards:** ${hazards}

## 4) Capital Improvement Evaluation (Prioritized)
| Priority | Asset | Year | Condition | Age | Est. Cost |
|---:|---|---:|---|---:|---:|
${capSorted.map((a,i)=> `| ${i+1} | ${a.name} | ${a.year||""} | ${a.cond} | ${a.age} | $${(a.cost||0).toLocaleString()} |`).join("\n")}

**Total Estimated Capital:** $${totalCap.toLocaleString()}  
**Funding Time at Current Budget:** ~${yearsToFund} years

## 5) Implementation Schedule (Draft)
${capSorted.map((a,i)=> `- Year ${Math.min(horizon, i+1)}: ${a.name} (est. $${(a.cost||0).toLocaleString()})`).join("\n")}

## 6) Monitoring & Reporting Plan (Outline)
- Maintain sampling schedule (lead/copper, DBPs, bacteriological)
- Track pressure logs and chlorine residuals; alert on thresholds
- Quarterly review of violation status via EPA ECHO

## 7) Funding Strategy
- Pursue SRF set-asides and principal forgiveness where eligible
- Bundle small assets into single contracts to reduce mobilization costs
- Align major work with regulatory deadlines to maximize scoring

## 8) Appendices & Links
${sys?.PWSID ? `- ECHO Facility Report: https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(sys.PWSID)}\n` : ""}- Envirofacts SDW Systems: https://data.epa.gov/efservice
`;
  function download(filename:string, content:string){ const blob=new Blob([content],{type:"text/markdown;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url) }
  return (<div className="tw120 min-h-screen bg-[var(--bg)]">
    <style>{`.tw120{--primary:#0F5E9C;--primary-foreground:#fff;--bg:#F7FAFC;--card:#fff;--muted:#E7EEF5;--ring:#B7D3EA;--text:#0E2033;--text-muted:#6B7A8C}.card{background:var(--card);border:1px solid var(--muted);border-radius:12px;box-shadow:0 2px 6px rgba(15,94,156,.06),0 1px 2px rgba(14,32,51,.06)}.input{border:1px solid var(--muted);border-radius:8px;padding:.5rem .75rem;background:#fff}.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:8px;font-weight:600}.btn-primary{background:var(--primary);color:var(--primary-foreground)}.btn-outline{border:1px solid var(--ring);background:#fff}.row{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}`}</style>
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-[var(--text)]">Planning & Evaluations</h1><a href="/" className="btn btn-outline"><RefreshCw className="w-4 h-4"/> Back</a></div>
      <div className="grid" style={{gridTemplateColumns:"minmax(280px,420px) 1fr", gap:"1rem"}}>
        <div className="card p-4">
          <div className="row mb-2"><Info className="w-4 h-4"/><h3 className="font-semibold">Plan Settings</h3></div>
          <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Horizon (years)</span><input className="input" type="number" value={horizon} onChange={e=>setHorizon(Math.max(1,+e.target.value||1))}/></label>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap: ".75rem"}}>
            <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Growth (%/yr)</span><input className="input" type="number" value={growth} onChange={e=>setGrowth(Math.max(0,+e.target.value||0))}/></label>
            <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Budget ($/yr)</span><input className="input" type="number" value={budget} onChange={e=>setBudget(Math.max(0,+e.target.value||0))}/></label>
          </div>
          <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Objectives (one per line)</span><textarea className="input" style={{minHeight:100}} value={objectives} onChange={e=>setObjectives(e.target.value)}/></label>
          <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Key Hazards (comma-separated)</span><input className="input" value={hazards} onChange={e=>setHazards(e.target.value)}/></label>
          <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Assets (one per line)</span><textarea className="input" style={{minHeight:140}} value={assets} onChange={e=>setAssets(e.target.value)}/><span className="text-xs text-[var(--text-muted)]">Format: Name (Year) | condition: Good/Fair/Poor | est. cost: 123456</span></label>
          <div className="row mt-3"><button className="btn btn-primary" onClick={()=>window.location.reload()}><RefreshCw className="w-4 h-4"/> Reload Live Data</button>{loading && <span className="text-sm text-[var(--text-muted)]">Loading…</span>}{err && <span className="text-sm" style={{color:"var(--danger)"}}>Error: {err}</span>}</div>
        </div>
        <div className="card p-4">
          <div className="row mb-2"><FileText className="w-4 h-4"/><h3 className="font-semibold">Generated Plan (Markdown)</h3></div>
          <div className="row mb-3"><button className="btn btn-outline" onClick={()=>navigator.clipboard.writeText(md)}><ClipboardList className="w-4 h-4"/> Copy</button><button className="btn btn-primary" onClick={()=> (function(){ const a=document.createElement('a'); const blob=new Blob([md],{type:'text/markdown;charset=utf-8'}); const url=URL.createObjectURL(blob); a.href=url; a.download=`SustainabilityPlan_${pwsid||'Plan'}.md`; a.click(); URL.revokeObjectURL(url) })()}><Download className="w-4 h-4"/> Download .md</button></div>
          <textarea className="input" style={{minHeight:480,width:"100%",fontFamily:"ui-monospace,Menlo,Consolas,monospace"}} readOnly value={md} />
        </div>
      </div>
    </div>
  </div>)
}
