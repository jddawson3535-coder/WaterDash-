"use client";
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Download, Info, Mail, Megaphone, PlugZap, ShieldAlert } from "lucide-react";
function useLocalStorage<T>(key:string, initial:T){ const [state,setState]=useState<T>(()=>{ try{ const raw=localStorage.getItem(key); return raw? JSON.parse(raw): initial }catch{return initial}}); useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)) }catch{}},[key,state]); return [state,setState] as const }
const fmtCurrency = (n:number)=> n.toLocaleString(undefined,{style:"currency", currency:"USD"});
export function CommEnergyPlanner(){
  const [stateAbbr] = useLocalStorage("state","OK"); const [pwsid] = useLocalStorage("pwsid",""); const [pwsName] = useLocalStorage("pws_name","");
  const [spokesperson, setSpokesperson] = useLocalStorage("comm_spokesperson",""); const [approver, setApprover] = useLocalStorage("comm_approver","");
  const [stakeholders, setStakeholders] = useLocalStorage("comm_stakeholders","Customers, City Council, County EM, Local Media, DEQ District Engineer, Schools");
  const [channels, setChannels] = useLocalStorage("comm_channels","SMS, Email, Website, Facebook, X/Twitter, Door hangers, Radio");
  const [triggers, setTriggers] = useLocalStorage("comm_triggers","Boil Order, Planned Outage, Main Break, Water Quality Advisory, Rate Change");
  const [contacts, setContacts] = useLocalStorage("comm_contacts","Name | Role | Phone | Email\nJane Smith | Operator | (555) 555-1212 | ops@example.org\n...");
  const [kwh, setKwh] = useLocalStorage<number>("energy_kwh", 350000); const [mg, setMg] = useLocalStorage<number>("energy_mg", 120);
  const [rate, setRate] = useLocalStorage<number>("energy_rate", 0.12); const [pumpHP, setPumpHP] = useLocalStorage<number>("energy_pumphp", 75);
  const [pumpHrs, setPumpHrs] = useLocalStorage<number>("energy_pumphrs", 2000); const [leakPct, setLeakPct] = useLocalStorage<number>("energy_leakpct", 12);
  const [hasERP, setHasERP] = useLocalStorage("tmf_has_erp", false); const [hasCommsPolicy, setHasCommsPolicy] = useLocalStorage("tmf_has_commspolicy", false);
  const [hasWaterLossAudit, setHasWaterLossAudit] = useLocalStorage("tmf_has_wla", false); const [hasBackflowPlan, setHasBackflowPlan] = useLocalStorage("tmf_has_backflow", false);
  const [hasAssetMgmt, setHasAssetMgmt] = useLocalStorage("tmf_has_asset", false); const [hasCyberPlan, setHasCyberPlan] = useLocalStorage("tmf_has_cyber", false);
  const [inSoonerWARN, setInSoonerWARN] = useLocalStorage("tmf_in_sw", false);
  const ei = useMemo(()=> (mg>0 ? kwh/mg : 0), [kwh,mg]); const energyCost = useMemo(()=> kwh*rate, [kwh, rate]); const pumpEnergyApprox = useMemo(()=> pumpHP*0.746*pumpHrs, [pumpHP, pumpHrs]);
  const measures = useMemo(()=>{ const out:any[]=[]; if (leakPct>10) out.push({name:"Leak reduction & pressure mgmt", estSavePct: Math.min(20, Math.max(5, (leakPct-10))), notes:"Perform AWWA M36 audit; target <10% losses; prioritize DMAs and night flows."}); out.push({name:"Pump VFD & best efficiency point ops", estSavePct: 5, notes:"Tune pumps near BEP; add VFDs if throttling; optimize setpoints."}); out.push({name:"Off-peak pumping & storage ops", estSavePct: 3, notes:"Shift non-emergency runs to off-peak where tariff supports; confirm disinfection CT."}); if (!hasAssetMgmt) out.push({name:"Asset management & condition-based maintenance", estSavePct:2, notes:"Reduce rework/energy via proactive maintenance and replacements."}); if (!hasWaterLossAudit) out.push({name:"Institutionalize annual AWWA M36 audit", estSavePct:1, notes:"Embed data collection; meter testing; recovery of apparent losses."}); return out; }, [leakPct, hasAssetMgmt, hasWaterLossAudit]);
  const measuresTable = measures.map(m=>`| ${m.name} | ~${m.estSavePct}% | ${m.notes} |`).join("\n"); const estPct = measures.reduce((s,m)=> s+m.estSavePct, 0); const estSaveKwh = Math.round(kwh*estPct/100); const estSave$ = estSaveKwh*rate;
  const commPlan = `# Communication Plan – ${pwsName||pwsid||"PWS"} (${stateAbbr})

## Roles & Authorization
- **Spokesperson:** ${spokesperson||"[Name]"}  
- **Approval/Legal Review:** ${approver||"[Name]"}  
- **Backups:** [Designate]
- **Policies in place:** ${hasCommsPolicy? "Yes" : "No – create/approve written policy template"}

## Stakeholders & Channels
- **Stakeholders:** ${stakeholders}
- **Channels:** ${channels}
- **Notification triggers:** ${triggers}

## Notification Matrix
| Event | Who gets notified | Method | Timeframe |
|---|---|---|---|
| Boil Order | All customers; DEQ District Engineer; Local media | SMS/Email/Website/Radio | Per DEQ/EPA-required timeframes |
| Main Break | Affected customers; City/County | SMS/Door Hanger | Immediate |
| Planned Outage | Affected customers | Email/Website/Door Hanger | 72 hours prior |
| Water Quality Advisory | All customers; DEQ | Email/Website/Press | As required |

## Message Templates
**Boil Order (short):**  
"Due to ${pwsName||"our system"} detecting an issue, a **Boil Water Advisory** is in effect until further notice. Boil tap water for 1 minute before use. Updates at ${"[website]"} or call ${"[phone]"}."

**Outage (planned):**  
"Water service will be interrupted on [date/time] in [area]. We apologize for the inconvenience. Details: ${"[link]"}."

## Contact Roster
${contacts}

## Training & Review
- Annual tabletop drill on communication workflows.
- After-action review after any major event; update templates and contact roster.`;

  const energyAudit = `# Energy Audit – ${pwsName||pwsid||"PWS"}

## Baseline
- **Annual Production:** ${mg.toLocaleString()} MG
- **Annual Electricity:** ${kwh.toLocaleString()} kWh
- **Energy Intensity:** ${ei.toFixed(0)} kWh/MG
- **Average Tariff:** ${fmtCurrency(rate)}/kWh
- **Annual Cost (approx):** ${fmtCurrency(energyCost)}
- **Representative Pump:** ${pumpHP} HP × ${pumpHrs.toLocaleString()} h/yr → ~${Math.round(pumpEnergyApprox).toLocaleString()} kWh/yr

## Observations
- **Unaccounted Water (est.):** ${leakPct}%
- **Asset Mgmt in place:** ${hasAssetMgmt? "Yes" : "No"}
- **Annual AWWA M36 audit:** ${hasWaterLossAudit? "Yes" : "No"}

## Opportunities (screening)
| Measure | Est. kWh savings | Notes |
|---|---:|---|
${measuresTable}

**Portfolio impact:** ~${estPct}% → ~${estSaveKwh.toLocaleString()} kWh/yr (~${fmtCurrency(estSave$)}/yr)  

> Estimates are screening-level only; refine with scada trend review, pump tests, and tariff analysis.

## Actions
- Perform AWWA M36 audit and develop repair plan for highest-loss DMAs.
- Verify pump curves; test wire-to-water efficiency; evaluate VFDs where throttling occurs.
- Implement off-peak operations where feasible; confirm CT and storage turnover.
- Add meter testing policy and schedule.`;

  const requiredActions = (()=>{ const out:any[]=[];
    if (!hasCommsPolicy) out.push("Draft and adopt a written Communication Policy; train staff annually.");
    if (!hasERP) out.push("Update Emergency Response Plan; verify contacts and alternate power procedures.");
    if (!hasBackflowPlan) out.push("Adopt a written Backflow Cross-Connection Control plan; schedule testing.");
    if (!hasWaterLossAudit) out.push("Institutionalize annual AWWA M36 Water Loss Audit; submit results to DEQ if requested.");
    if (!hasAssetMgmt) out.push("Complete Asset Management Plan using DEQ template; set renewal funding strategy.");
    if (!hasCyberPlan) out.push("Adopt Cybersecurity Plan; perform annual tabletop exercise.");
    if (!inSoonerWARN) out.push("Join SoonerWARN or a mutual aid group; document membership and contacts.");
    return out;
  })();

  const actionList = requiredActions.map((a,i)=>`- [ ] ${a}`).join("\\n");
  const bundleMd = `# System Evaluations Package – ${pwsName||pwsid||"PWS"} (${stateAbbr})

${commPlan}

---

${energyAudit}

---

## Required Follow-up Actions (TMF)
${actionList || "- [ ] No critical gaps flagged based on provided inputs."}
`;

  function download(name:string, content:string){
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tw120 min-h-screen bg-[var(--bg)]">
      <style>{`
        .tw120{--primary:#0F5E9C;--primary-foreground:#fff;--bg:#F7FAFC;--card:#fff;--muted:#E7EEF5;--ring:#B7D3EA;--text:#0E2033;--text-muted:#6B7A8C;}
        .card{background:var(--card); border:1px solid var(--muted); border-radius:12px; box-shadow:0 2px 6px rgba(15,94,156,.06),0 1px 2px rgba(14,32,51,.06);}
        .input{border:1px solid var(--muted); border-radius:8px; padding:.5rem .75rem; background:#fff;}
        .btn{display:inline-flex; align-items:center; gap:.5rem; padding:.5rem .75rem; border-radius:8px; font-weight:600;}
        .btn-primary{background:var(--primary); color:var(--primary-foreground);}
        .btn-outline{border:1px solid var(--ring); background:#fff;}
        .row{display:flex; gap:.75rem; align-items:center; flex-wrap:wrap;}
        .grid{display:grid; gap:.75rem;}
      `}</style>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="row" style={{justifyContent:"space-between"}}>
          <h1 className="text-2xl font-bold text-[var(--text)]">Communication, Energy & TMF Actions</h1>
          <a className="btn btn-outline" href="/"><span>Back to Dashboard</span></a>
        </div>

        <div className="grid" style={{gridTemplateColumns:"minmax(280px,420px) 1fr", gap:"1rem"}}>
          <div className="card p-4">
            <div className="row mb-2"><Info className="w-4 h-4" /><h3 className="font-semibold">Inputs</h3></div>

            <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:".75rem"}}>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Spokesperson</span><input className="input" value={spokesperson} onChange={e=>setSpokesperson(e.target.value)}/></label>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Approver</span><input className="input" value={approver} onChange={e=>setApprover(e.target.value)}/></label>
            </div>
            <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Stakeholders (comma-separated)</span><input className="input" value={stakeholders} onChange={e=>setStakeholders(e.target.value)}/></label>
            <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Channels (comma-separated)</span><input className="input" value={channels} onChange={e=>setChannels(e.target.value)}/></label>
            <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Notification triggers (comma-separated)</span><input className="input" value={triggers} onChange={e=>setTriggers(e.target.value)}/></label>
            <label className="grid gap-1 mt-2"><span className="text-sm text-[var(--text-muted)]">Contact Roster (table text)</span><textarea className="input" style={{minHeight:100}} value={contacts} onChange={e=>setContacts(e.target.value)} /></label>

            <div className="row mt-3"><Megaphone className="w-4 h-4"/><strong>Energy Inputs</strong></div>
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:".75rem"}}>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Annual kWh</span><input className="input" type="number" value={kwh} onChange={e=>setKwh(Math.max(0, +e.target.value||0))}/></label>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Annual MG</span><input className="input" type="number" value={mg} onChange={e=>setMg(Math.max(0, +e.target.value||0))}/></label>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">$ per kWh</span><input className="input" type="number" step="0.001" value={rate} onChange={e=>setRate(Math.max(0, +e.target.value||0))}/></label>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Rep. Pump HP</span><input className="input" type="number" value={pumpHP} onChange={e=>setPumpHP(Math.max(0, +e.target.value||0))}/></label>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Rep. Pump Hours/yr</span><input className="input" type="number" value={pumpHrs} onChange={e=>setPumpHrs(Math.max(0, +e.target.value||0))}/></label>
              <label className="grid gap-1"><span className="text-sm text-[var(--text-muted)]">Unaccounted water (%)</span><input className="input" type="number" value={leakPct} onChange={e=>setLeakPct(Math.max(0, Math.min(100, +e.target.value||0)))}/></label>
            </div>

            <div className="row mt-3"><ClipboardList className="w-4 h-4"/><strong>TMF / Policy Check</strong></div>
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:".5rem"}}>
              <label className="row"><input type="checkbox" checked={hasCommsPolicy} onChange={e=>setHasCommsPolicy(e.target.checked)}/> Communication Policy</label>
              <label className="row"><input type="checkbox" checked={hasERP} onChange={e=>setHasERP(e.target.checked)}/> Emergency Response Plan</label>
              <label className="row"><input type="checkbox" checked={hasWaterLossAudit} onChange={e=>setHasWaterLossAudit(e.target.checked)}/> Water Loss Audit (AWWA M36)</label>
              <label className="row"><input type="checkbox" checked={hasBackflowPlan} onChange={e=>setHasBackflowPlan(e.target.checked)}/> Backflow/Cross-Connection Plan</label>
              <label className="row"><input type="checkbox" checked={hasAssetMgmt} onChange={e=>setHasAssetMgmt(e.target.checked)}/> Asset Management Plan</label>
              <label className="row"><input type="checkbox" checked={hasCyberPlan} onChange={e=>setHasCyberPlan(e.target.checked)}/> Cybersecurity Plan</label>
              <label className="row"><input type="checkbox" checked={inSoonerWARN} onChange={e=>setInSoonerWARN(e.target.checked)}/> SoonerWARN / mutual aid</label>
            </div>
          </div>

          <div className="card p-4">
            <div className="row mb-2"><Mail className="w-4 h-4"/><h3 className="font-semibold">Generated Communication Plan</h3></div>
            <textarea className="input" style={{minHeight:220, width:"100%", fontFamily:"ui-monospace, Menlo, Consolas, monospace"}} readOnly value={commPlan} />
            <div className="row mt-2">
              <button className="btn btn-outline" onClick={()=>navigator.clipboard.writeText(commPlan)}>Copy</button>
              <button className="btn btn-primary" onClick={()=>download(`CommunicationPlan_${pwsid||"PWS"}.md`, commPlan)}><Download className="w-4 h-4"/> Download .md</button>
            </div>

            <div className="row mt-6 mb-2"><PlugZap className="w-4 h-4"/><h3 className="font-semibold">Generated Energy Audit (Screening)</h3></div>
            <textarea className="input" style={{minHeight:220, width:"100%", fontFamily:"ui-monospace, Menlo, Consolas, monospace"}} readOnly value={energyAudit} />
            <div className="row mt-2">
              <button className="btn btn-outline" onClick={()=>navigator.clipboard.writeText(energyAudit)}>Copy</button>
              <button className="btn btn-primary" onClick={()=>download(`EnergyAudit_${pwsid||"PWS"}.md`, energyAudit)}><Download className="w-4 h-4"/> Download .md</button>
            </div>

            <div className="row mt-6 mb-2"><ShieldAlert className="w-4 h-4"/><h3 className="font-semibold">Required TMF Actions</h3></div>
            <textarea className="input" style={{minHeight:160, width:"100%", fontFamily:"ui-monospace, Menlo, Consolas, monospace"}} readOnly value={"# Actions\n"+(requiredActions.map(a=>`- [ ] ${a}`).join("\n")||"- [ ] No gaps flagged.")} />
            <div className="row mt-2">
              <button className="btn btn-outline" onClick={()=>download(`SystemEvaluations_${pwsid||"PWS"}.md`, bundleMd)}>Download Package (.md)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
