"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Calendar, CheckCircle2, ChevronRight, ClipboardList, Clock, Database, DollarSign, Info, MapPin, RefreshCw } from "lucide-react";
const ThemeStyles = () => (<style>{`
  .tw120{--primary:#0F5E9C;--primary-600:#2389DA;--primary-foreground:#fff;--bg:#F7FAFC;--card:#fff;--muted:#E7EEF5;--ring:#B7D3EA;--text:#0E2033;--text-muted:#6B7A8C;--danger:#C62828;--shadow:0 2px 6px rgba(15,94,156,.06),0 1px 2px rgba(14,32,51,.06);--shadow-lg:0 8px 24px rgba(15,94,156,.12),0 2px 6px rgba(14,32,51,.06)}
  .tw120 .card{background:var(--card);border:1px solid var(--muted);border-radius:12px;box-shadow:var(--shadow)}
  .tw120 .btn{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:8px;font-weight:600}
  .tw120 .btn-primary{background:var(--primary);color:var(--primary-foreground)} .tw120 .btn-primary:hover{background:var(--primary-600)}
  .tw120 .btn-outline{border:1px solid var(--ring);background:#fff}.tw120 .badge{display:inline-flex;align-items:center;gap:.25rem;padding:.125rem .5rem;border-radius:9999px;font-size:.75rem;font-weight:600}
  .tw120 .chip{background:var(--muted);color:var(--text-muted);border-radius:9999px;padding:2px 8px;font-size:12px;font-weight:500}
  .tw120 .crit{background:#FFE5E5;color:#8A1F1F}.tw120 .hi{background:#FFF1DB;color:#8A4B00}.tw120 .med{background:#EAF5FF;color:#0F5E9C}.tw120 .lo{background:#EAF7EA;color:#1F6A1F}
  .tw120 .input{border:1px solid var(--muted);border-radius:8px;padding:.5rem .75rem;background:#fff}.tw120 .row{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
`}</style>);
type DataType = "scada" | "water";
type ActionPriority = "Critical" | "High" | "Medium" | "Low";
type ActionCategory = "Compliance" | "Sampling" | "Inventory" | "SCADA" | "Funding";
type EchoSystem = { PWSID?:string; PWSName?:string; City?:string; County?:string; PopulationServed?:string; OwnerType?:string };
type EchoViolation = { PWSID?:string; ViolationCode?:string; ViolationType?:string; Contaminant?:string; BeginDate?:string; EndDate?:string; IsSignificant?:string };
type NextAction = { id:string; title:string; category:ActionCategory; priority:ActionPriority; dueDate?:string; description:string; steps:string[]; status:"Open"|"Completed"|"Snoozed" };
const formatDate=(iso?:string)=> iso? new Date(iso+(iso.length===10?"T00:00:00":"")).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}):"";
const priorityClass=(p:ActionPriority)=> p==="Critical"?"crit":p==="High"?"hi":p==="Medium"?"med":"lo";
function useLocalStorage<T>(key:string, initial:T){ const [state,setState]=useState<T>(()=>{ try{ const raw=localStorage.getItem(key); return raw? JSON.parse(raw): initial }catch{return initial}}); useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)) }catch{}},[key,state]); return [state,setState] as const }
async function fetchJSON(url:string, signal?:AbortSignal){ const r=await fetch(url,{signal}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }
function useInterval(cb:()=>void,ms:number|null){ const ref=useRef(cb); useEffect(()=>{ref.current=cb},[cb]); useEffect(()=>{ if(ms===null) return; const id=setInterval(()=>ref.current(),ms); return ()=>clearInterval(id)},[ms]) }
function buildNextActions(violations:EchoViolation[], currentData:any, currentType:DataType|null):NextAction[]{ const today=new Date(), inDays=(n:number)=>{const d=new Date(today); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10)}; const out:NextAction[]=[]; const significant=violations.filter(v=>(v.IsSignificant??"").toUpperCase()==="Y"); if(significant.length){ out.push({ id:"vio-sig", title:`Resolve ${significant.length} significant violations`, category:"Compliance", priority:"Critical", dueDate:inDays(7), description:"Review ECHO details, notify primacy if required, and document corrective actions.", steps:["Open ECHO facility report","Draft corrective action plan","Schedule follow-up sampling/ops changes"], status:"Open" }) } const p=Number(currentData?.pressure_psi??0); if(currentType==="scada" && p && p<45){ out.push({ id:"scada-low-pressure", title:"Investigate low pressure trend", category:"SCADA", priority:"High", dueDate:inDays(1), description:"Sustained pressure <45 psi—check PRVs/valves and inspect for leaks.", steps:["Check PRV setpoints","Inspect for main breaks","Document remediation"], status:"Open" }) } out.push({ id:"fund-1", title:"Prepare SRF set-aside application draft", category:"Funding", priority:"Medium", dueDate:inDays(21), description:"Draft scope & costs for LSLR or treatment improvements.", steps:["Export inventory counts","Draft phases & costs","Gather letters of support"], status:"Open" }); const weight:Record<ActionPriority,number>={Critical:0,High:1,Medium:2,Low:3}; return out.sort((a,b)=> (weight[a.priority]-weight[b.priority]) || ((a.dueDate?+new Date(a.dueDate):Infinity)-(b.dueDate?+new Date(b.dueDate):Infinity))) }
export function Dashboard(){
  const [auto,setAuto]=useLocalStorage("autorefresh",true); const loadedAt=useMemo(()=> new Date().toLocaleTimeString(),[]);
  const [state,setState]=useLocalStorage("state","OK"); const [county,setCounty]=useLocalStorage("county",""); const [pwsid,setPwsid]=useLocalStorage("pwsid",""); const [apiKey,setApiKey]=useLocalStorage("echo_api_key",""); const [useProxy,setUseProxy]=useLocalStorage("use_proxy",true);
  const [currentData,setCurrentData]=useState<any>(null); const [currentType,setCurrentType]=useState<DataType|null>(null);
  const [systems,setSystems]=useState<EchoSystem[]>([]); const [violations,setViolations]=useState<EchoViolation[]>([]); const [sysLoading,setSysLoading]=useState(false); const [vioLoading,setVioLoading]=useState(false); const [sysErr,setSysErr]=useState<string|null>(null); const [vioErr,setVioErr]=useState<string|null>(null);
  const controllerRef=useRef<AbortController|null>(null);
  const buildEchoUrl=(path:string,qs:Record<string,string|undefined>)=>{ const base=useProxy?"/api/echo":"https://echodata.epa.gov/echo"; const params=new URLSearchParams({output:"JSON",state_abbr:state}); if(!useProxy && apiKey) params.set("api_key",apiKey); if(county) params.set("county",county); if(pwsid) params.set("p_pwsid",pwsid); for(const [k,v] of Object.entries(qs)) if(v) params.set(k,v); return `${base}${path}?${params.toString()}` };
  const loadSystems=async()=>{ setSysErr(null); setSysLoading(true); controllerRef.current?.abort(); const ctrl=new AbortController(); controllerRef.current=ctrl; try{ const url=buildEchoUrl("/sdw_rest_services.get_systems",{}); const data=await fetchJSON(url, ctrl.signal); setSystems(Array.isArray(data?.Results?.Systems)? data.Results.Systems:[]) }catch(e:any){ setSysErr(e?.message||"Failed to load systems") } finally{ setSysLoading(false) } }
  const loadViolations=async()=>{ setVioErr(null); setVioLoading(true); const ctrl=new AbortController(); controllerRef.current=ctrl; try{ const url=buildEchoUrl("/sdw_rest_services.get_violations",{}); const data=await fetchJSON(url, ctrl.signal); setViolations(Array.isArray(data?.Results?.Violations)? data.Results.Violations:[]) }catch(e:any){ setVioErr(e?.message||"Failed to load violations") } finally{ setVioLoading(false) } }
  useEffect(()=>{ loadSystems(); loadViolations() },[]); useInterval(()=>{ if(auto){ loadSystems(); loadViolations() } }, auto?60000:null);
  return (<div className="tw120 min-h-screen bg-[var(--bg)]"><ThemeStyles/><div className="max-w-7xl mx-auto p-6 space-y-8">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-[var(--text)]">PWS Dashboard</h1><p className="text-[var(--text-muted)]">Live SDWIS via EPA ECHO • Oklahoma-focused</p></div>
      <div className="row text-sm text-[var(--text-muted)]"><Clock className="w-4 h-4"/><span>Last loaded: {loadedAt}</span>
        <button className="btn btn-outline" onClick={()=>{loadSystems();loadViolations()}}><RefreshCw className="w-4 h-4"/> Refresh</button>
        <label className="row text-sm"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Auto</label>
        <a href="/plans" className="btn btn-outline">Planning & Evaluations</a>
        <a href="/planner" className="btn btn-outline">Comm & Energy Planner</a>
      </div></div>
    <div className="card p-4"><div className="mb-2 row"><Info className="w-4 h-4 text-[var(--primary)]"/><h3 className="font-semibold">Data Source</h3></div>
      <p className="text-sm text-[var(--text-muted)] mb-3">This pulls directly from EPA ECHO (SDWIS). Add an API key from <a href="https://api.data.gov/signup/" target="_blank" rel="noreferrer" className="underline">api.data.gov</a> for higher limits (optional).</p>
      <div className="grid md:grid-cols-4 gap-3">
        <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Use Server Proxy</span><label className="row text-sm"><input type="checkbox" checked={useProxy} onChange={e=>setUseProxy(e.target.checked)} /><span>{useProxy?"On (recommended)":"Off"}</span></label></label>
        <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">State</span><input className="input" value={state} onChange={e=>setState(e.target.value.toUpperCase())}/></label>
        <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">County (optional)</span><input className="input" value={county} onChange={e=>setCounty(e.target.value)}/></label>
        <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">PWSID (optional)</span><input className="input" value={pwsid} onChange={e=>setPwsid(e.target.value)}/></label>
        <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">EPA API Key (optional)</span><input className="input" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="api.data.gov key"/></label>
      </div>
      <div className="mt-3 row"><button className="btn btn-primary" onClick={()=>{loadSystems();loadViolations()}}><RefreshCw className="w-4 h-4"/> Apply & Reload</button></div>
    </div>
  </div></div>);
}
