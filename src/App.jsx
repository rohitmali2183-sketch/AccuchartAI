// ─────────────────────────────────────────────────────────────────────────────
// AccuChart Complete Provider Platform
// Vercel-ready: all AI calls route through /api/claude (see api/claude.js)
//
// SETUP:
//   1. npm create vite@latest accuchart -- --template react
//   2. Replace src/App.jsx with this file
//   3. Add /api/claude.js to project root
//   4. In Vercel dashboard → Settings → Environment Variables:
//      ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxx
//   5. Push to GitHub → Vercel deploys automatically
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { T, typography } from "./theme";

// ─── PATIENT DATA ─────────────────────────────────────────────────────────────
const PATIENT = {
  name: "Marie Hasenpflug", age: 87, dob: "10/05/1938",
  payer: "Medicare Advantage", memberId: "HMA-77291-X",
  pcp: "Dr. John Gisbeth", practice: "Orci Care — Poughkeepsie",
  vitals: { bp: "128/58", hr: 75, rr: 16, temp: "97.2°F", wt: "147.4 lbs", bmi: 27.85, o2: "98%" },
  conditions: ["Lyme Disease (active)", "Lightheadedness / Dizziness", "Chronic MSK Pain + OA", "GERD", "Prediabetes (A1c 5.9%)", "Anemia — resolved"],
  medications: ["Omeprazole 20mg PO daily", "Gabapentin 100mg x2 PO nightly", "Amoxicillin 500mg TID (new — Lyme)"],
  labs: { hba1c: "5.9%", hgb: "13.9 g/dL", crp: "Elevated", lyme: "Positive (5 bands, index 2.0)", ckd: "Normal" },
  lastVisit: "2026-01-15", visitType: "F/U: Follow Up Visit", dos: "04/17/2026",
  payerSuspects: ["A69.20 — Lyme Disease (newly confirmed, not yet coded)", "G89.29 — Chronic pain (gabapentin use documented, not coded)"],
  hedisGaps: ["Annual wellness visit overdue", "Depression screening due (G0444)", "BMI counseling — documented today"],
  priorCodes: ["R42 Dizziness", "M79.3 Panniculitis", "K21.0 GERD", "R73.03 Prediabetes"],
  rafCurrent: 0.31, rafPotential: 0.73,
};

const SOAP_GENERATED = `SUBJECTIVE:
Chief Complaint: Follow-up for lightheadedness, Lyme disease management, and medication refills.

History of Present Illness: Marie Hasenpflug is an 87-year-old female presenting for follow-up. She reports ongoing intermittent lightheadedness/dizziness, improved but not completely resolved, with symptoms worse in the afternoons and evenings. Patient reports chronic pain managed with gabapentin; currently taking 100 mg tablets x2 at night (instead of prescribed 300 mg dose). Patient requests medication refills for omeprazole and gabapentin. Patient confirms positive Lyme disease testing (5 bands positive, index increased from 1.57 to 2.0). Requests antibiotic adjustment due to GI intolerance to doxycycline; prefers amoxicillin. A1c 5.9% consistent with prediabetes range.

OBJECTIVE:
Vitals: BP 128/58 mmHg, HR 75/min, RR 16/min, Temp 97.2°F, O2 Sat 98%, Wt 147.4 lbs, BMI 27.85
Labs: Hemoglobin 13.9 g/dL (improved from 11.9). CRP elevated, ESR negative. Lyme serology: Positive with 5 bands; index increased from 1.57 to 2.0. A1c: 5.9% (prediabetes range).
Physical Exam: General — alert, pleasant, well-nourished, no acute distress. Neurologic — alert and oriented. MSK — no swelling or tenderness, full ROM.

ASSESSMENT:
1. Lyme disease with positive serology (5 bands) and rising index; associated lightheadedness; elevated CRP.
2. Lightheadedness (non-vertiginous), likely multifactorial with Lyme contribution; possible cervical spondylosis.
3. Chronic musculoskeletal pain and osteoarthritis (neck, back, knees) with neuropathic component responsive to gabapentin.
4. Gastroesophageal reflux disease, stable on PPI; increased GI risk during antibiotic therapy.
5. Prediabetes (A1c 5.9%).
6. History of anemia — resolved (Hb improved to 13.9).
7. Elevated C-reactive protein, likely related to active Lyme infection.

PLAN:
1. Start amoxicillin 500 mg PO TID for 28-30 days for Lyme disease. Continue omeprazole to mitigate GI symptoms. Follow-up in 4 weeks.
2. Fall risk counseling — use rollator/walker as needed. Emphasize hydration.
3. Continue gabapentin 200 mg PO nightly. Weight loss goal (~10 lbs).
4. Refill omeprazole; take 30 minutes before breakfast.
5. Lifestyle counseling for prediabetes. Recheck A1c in 6-12 months.
6. Repeat CBC in ~3 months.`;

const ICD_CODES = [
  { id: "i1", code: "A69.20", name: "Lyme disease, unspecified", hcc: "HCC 6", rafW: 0.422, revenue: 422, anchor: "Lyme serology positive with 5 bands; index increased from 1.57 to 2.0", decision: "pending", priority: "high", isNew: true },
  { id: "i2", code: "R42",    name: "Dizziness and giddiness", hcc: null, rafW: 0, revenue: 0, anchor: "ongoing intermittent lightheadedness/dizziness, improved but not completely resolved", decision: "accepted", priority: "low" },
  { id: "i3", code: "M19.90", name: "Primary osteoarthritis, unspecified", hcc: null, rafW: 0, revenue: 0, anchor: "Chronic musculoskeletal pain and osteoarthritis (neck, back, knees)", decision: "pending", priority: "medium", upgrade: "Upgraded from M79.3 for specificity" },
  { id: "i4", code: "K21.9",  name: "GERD without esophagitis", hcc: null, rafW: 0, revenue: 0, anchor: "Gastroesophageal reflux disease, stable on PPI", decision: "pending", priority: "low", upgrade: "Downgraded from K21.0 — no esophagitis confirmed" },
  { id: "i5", code: "R73.03", name: "Prediabetes", hcc: null, rafW: 0, revenue: 0, anchor: "A1c: 5.9% consistent with prediabetes range", decision: "accepted", priority: "low", watch: "→ E11.65 if A1c ≥6.5% next visit (HCC 19, +$1,180/yr)" },
  { id: "i6", code: "G89.29", name: "Chronic pain syndrome", hcc: null, rafW: 0, revenue: 0, anchor: "chronic pain managed with gabapentin; neuropathic component responsive to gabapentin", decision: "pending", priority: "medium", isNew: true },
  { id: "i7", code: "R79.82", name: "Elevated C-reactive protein", hcc: null, rafW: 0, revenue: 0, anchor: "C-reactive protein elevated; likely related to active Lyme infection", decision: "pending", priority: "low" },
];

const CPT_CODES = [
  { id: "c1", code: "99214", name: "Office/Outpatient Est. — Moderate MDM 30min", rvu: 3.87, revenue: 148, decision: "pending", type: "primary" },
  { id: "c2", code: "99401", name: "Preventive Medicine Counseling ~15min",       rvu: 1.15, revenue: 44,  decision: "pending", type: "primary" },
  { id: "c3", code: "2000F", name: "Blood Pressure Measured (quality)",            rvu: 0,    revenue: 0,   decision: "pending", type: "quality" },
  { id: "c4", code: "3008F", name: "BMI Documented (quality)",                     rvu: 0,    revenue: 0,   decision: "pending", type: "quality" },
  { id: "c5", code: "G0444", name: "Depression Screening Annual",                  rvu: 0.53, revenue: 18,  decision: "pending", type: "quality" },
];

const MISSING_CODES = [
  { code: "Z87.39", name: "History of musculoskeletal disorders", urgency: "medium", evidence: "Patient uses rollator walker; chronic MSK documented throughout note" },
  { code: "E11.65", name: "Type 2 Diabetes with hyperglycemia",  urgency: "watch",  evidence: "A1c 5.9% — prediabetes today, watch at next visit" },
];

function mockAIResponse(prompt) {
  if (prompt.includes("Pre-Visit Intelligence")) {
    return `### RISK SNAPSHOT
Lyme disease is newly confirmed and currently under-treated risk is moderate due to age, fall risk, and active symptoms.

### CONDITIONS TO ADDRESS TODAY
- Confirm active Lyme treatment plan and tolerance to antibiotics.
- Reassess dizziness frequency, timing, and safety impact.
- Document chronic pain severity and functional impact.

### DOCUMENTATION MUST-HAVES
- Explicitly link active symptoms to assessed conditions.
- Capture medication decisions and response to current therapy.
- Include MEAT elements for chronic conditions discussed.

### OPEN CARE GAPS
- Annual wellness visit is overdue.
- Depression screening is due.
- Reinforce BMI/lifestyle counseling in-plan documentation.

### REVENUE ALERT
Capturing confirmed Lyme disease and chronic pain specificity can materially improve RAF completeness and reduce downstream denials.`;
  }

  if (prompt.includes("clinical note enhancer")) {
    return `Symptoms are persistent but improved, and clinical context supports active follow-up rather than resolved status. Document current severity, treatment response, and medication rationale to strengthen coding specificity. Include measurable follow-up criteria and safety counseling to support medical necessity and continuity of care.`;
  }

  if (prompt.includes("coding assistant")) {
    return `This code was suggested because the encounter text contains direct evidence that aligns with the documented condition. Verify that assessment and plan language clearly supports code specificity and active management. Confidence: Medium-High based on explicit note anchors and treatment linkage.`;
  }

  if (prompt.includes("revenue intelligence agent")) {
    return `Documentation capture was strong because key active conditions, treatment actions, and coding-supported details were carried through to claim preparation. At the next visit, monitor progression from prediabetes and confirm whether additional specificity is warranted based on new labs. If this level of capture is repeated monthly, annualized reimbursement impact remains meaningfully positive for this patient panel segment.`;
  }

  return `AccuChart mock mode is active. Core workflow is available without external AI connectivity.`;
}

// ─── AI HELPER — calls /api/claude (your Vercel proxy) ───────────────────────
async function streamAI(prompt, onChunk, signal) {
  const fallback = () => {
    const text = mockAIResponse(prompt);
    onChunk(text);
    return text;
  };

  try {
    const res = await fetch("/api/claude", {           // ← Vercel proxy route
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok || !res.body) {
      return fallback();
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value).split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.delta?.text) { full += d.delta.text; onChunk(full); }
          } catch { /* skip parse errors on stream boundaries */ }
        }
      }
    }
    return full || fallback();
  } catch {
    return fallback();
  }
}

const STAGES = [
  { id: "prechart", label: "Pre-Chart",       icon: "🔍" },
  { id: "scribe",   label: "Scribe & SOAP",   icon: "🎙" },
  { id: "coding",   label: "AI Coding",        icon: "⚙️" },
  { id: "claim",    label: "CMS-1500 Claim",  icon: "📄" },
  { id: "submit",   label: "Submit & Track",  icon: "✅" },
];

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [stage, setStage]               = useState("prechart");
  const [unlocked, setUnlocked]         = useState(["prechart"]);
  const [icdDec, setIcdDec]             = useState(Object.fromEntries(ICD_CODES.map(c => [c.id, c.decision])));
  const [cptDec, setCptDec]             = useState(Object.fromEntries(CPT_CODES.map(c => [c.id, c.decision])));
  const [missingAct, setMissingAct]     = useState({});

  const unlock = s => setUnlocked(u => u.includes(s) ? u : [...u, s]);
  const advance = s => { unlock(s); setStage(s); };
  const goTo    = s => { if (unlocked.includes(s)) setStage(s); };

  const acceptedICD = ICD_CODES.filter(c => icdDec[c.id] === "accepted");
  const acceptedCPT = CPT_CODES.filter(c => cptDec[c.id] === "accepted");
  const revenue     = acceptedICD.reduce((s, c) => s + c.revenue, 0) + acceptedCPT.reduce((s, c) => s + c.revenue, 0);

  return (
    <div style={{ fontFamily: typography.sans, background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
        .btn{border:none;cursor:pointer;border-radius:8px;font-family:${typography.sans};font-weight:700;transition:all .15s}
        .btn:hover{filter:brightness(1.07);transform:translateY(-1px)}
        .card{background:${T.surface};border-radius:12px;border:1px solid ${T.border};box-shadow:0 1px 6px #00000008}
        .row-hover:hover{background:#F8FAFC!important}
        textarea,input{font-family:${typography.sans}}
      `}</style>

      {/* TOP NAV */}
      <header style={{ background: T.navy, padding: "0 28px", display: "flex", alignItems: "center", height: 56, flexShrink: 0, borderBottom: `3px solid ${T.pink}`, gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32 }}>
          <div style={{ width: 3, height: 28, background: T.pink, borderRadius: 2 }} />
          <span style={{ fontSize: 18, fontWeight: 900, color: "#fff", fontFamily: typography.brand }}>AccuChart</span>
          <span style={{ fontSize: 10, color: T.teal, letterSpacing: "2px", fontWeight: 700 }}>PROVIDER</span>
        </div>

        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {STAGES.map((s, i) => {
            const isUnlocked = unlocked.includes(s.id);
            const isActive   = stage === s.id;
            const isDone     = unlocked.includes(STAGES[i + 1]?.id);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <button onClick={() => goTo(s.id)} style={{
                  padding: "5px 12px", borderRadius: 6, border: "none",
                  background: isActive ? T.pink : isDone ? "#05301A" : isUnlocked ? `${T.teal}20` : "transparent",
                  color: isActive ? "#fff" : isDone ? T.green : isUnlocked ? T.teal : "#334155",
                  fontSize: 12, fontWeight: 700, cursor: isUnlocked ? "pointer" : "default",
                  opacity: isUnlocked ? 1 : 0.35,
                  display: "flex", alignItems: "center", gap: 5, transition: "all .15s",
                }}>
                  <span>{isDone && !isActive ? "✓" : s.icon}</span>
                  <span>{s.label}</span>
                </button>
                {i < STAGES.length - 1 && <span style={{ color: "#1E3A5F", fontSize: 12, padding: "0 2px" }}>›</span>}
              </div>
            );
          })}
        </div>

        <div style={{ background: "#0D2137", borderRadius: 8, padding: "6px 14px", textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{PATIENT.name}</div>
          <div style={{ fontSize: 10, color: T.muted }}>{PATIENT.age}yo · {PATIENT.payer} · {PATIENT.dos}</div>
        </div>
      </header>

      <main style={{ flex: 1, overflow: "auto" }}>
        {stage === "prechart" && <PreChart   patient={PATIENT} onAdvance={() => advance("scribe")} />}
        {stage === "scribe"   && <ScribeSOAP patient={PATIENT} soap={SOAP_GENERATED} onAdvance={() => advance("coding")} />}
        {stage === "coding"   && <CodingStage patient={PATIENT} icdCodes={ICD_CODES} cptCodes={CPT_CODES} missing={MISSING_CODES} icdDec={icdDec} setIcdDec={setIcdDec} cptDec={cptDec} setCptDec={setCptDec} missingAct={missingAct} setMissingAct={setMissingAct} onAdvance={() => advance("claim")} />}
        {stage === "claim"    && <ClaimStage  patient={PATIENT} acceptedICD={acceptedICD} acceptedCPT={acceptedCPT} revenue={revenue} onAdvance={() => advance("submit")} />}
        {stage === "submit"   && <SubmitTrack patient={PATIENT} acceptedICD={acceptedICD} acceptedCPT={acceptedCPT} revenue={revenue} />}
      </main>
    </div>
  );
}

// ─── STAGE 1 — PRE-CHART ─────────────────────────────────────────────────────
function PreChart({ patient, onAdvance }) {
  const [brief, setBrief]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);
  const abort = useRef(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    streamAI(
      `You are AccuChart Agent 01 — Pre-Visit Intelligence. Generate a physician pre-visit brief for Dr. Gisbeth seeing Marie Hasenpflug, 87yo female, Medicare Advantage, follow-up 04/17/2026.

Conditions: ${patient.conditions.join(", ")}
Medications: ${patient.medications.join(", ")}
Labs: A1c ${patient.labs.hba1c}, Hgb ${patient.labs.hgb}, CRP ${patient.labs.crp}, Lyme ${patient.labs.lyme}
Prior codes: ${patient.priorCodes.join(", ")}
Payer suspects: ${patient.payerSuspects.join("; ")}
HEDIS gaps: ${patient.hedisGaps.join("; ")}
Current RAF: ${patient.rafCurrent}, Potential: ${patient.rafPotential}

Use ### headers for these sections:
### RISK SNAPSHOT
### CONDITIONS TO ADDRESS TODAY
### DOCUMENTATION MUST-HAVES
### OPEN CARE GAPS
### REVENUE ALERT

Be specific and clinical. This brief is read by a physician in 3 minutes before entering the exam room.`,
      t => setBrief(t),
      ctrl.signal
    ).then(() => { setLoading(false); setDone(true); }).catch(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto", animation: "fadeUp .3s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: T.teal, letterSpacing: "2px", fontWeight: 700, marginBottom: 4 }}>STAGE 1 — PRE-CHART INTELLIGENCE</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: T.text }}>Good morning, Dr. Gisbeth.</h1>
          <p style={{ color: T.sub, marginTop: 4, fontSize: 14 }}>Your next patient is ready. AccuChart has prepared your brief.</p>
        </div>
        {done && <button className="btn" onClick={onAdvance} style={{ background: T.pink, color: "#fff", padding: "12px 24px", fontSize: 14 }}>Begin Encounter →</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        {/* Patient card */}
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "1px", fontWeight: 700, marginBottom: 10 }}>PATIENT</div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: T.text, marginBottom: 2 }}>{patient.name}</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }}>{patient.age}yo · {patient.payer}</div>
            {[["Visit", patient.visitType], ["Provider", patient.pcp], ["DOS", patient.dos], ["Last Visit", patient.lastVisit]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.muted }}>{l}</span>
                <span style={{ color: T.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: "1px", fontWeight: 700, marginBottom: 12 }}>RAF OPPORTUNITY</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.slate }}>{patient.rafCurrent}</div>
                <div style={{ fontSize: 10, color: T.muted }}>Current</div>
              </div>
              <div style={{ fontSize: 20, color: T.muted, alignSelf: "center" }}>→</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.green }}>{patient.rafPotential}</div>
                <div style={{ fontSize: 10, color: T.muted }}>Potential</div>
              </div>
            </div>
            <div style={{ height: 8, background: T.light, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(patient.rafCurrent / patient.rafPotential) * 100}%`, background: `linear-gradient(90deg,${T.teal},${T.green})`, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: T.green, marginTop: 8, fontWeight: 700, textAlign: "center" }}>+$420/yr potential if gaps closed today</div>
          </div>
        </div>

        {/* Brief */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? T.teal : T.green, animation: loading ? "pulse 1s infinite" : "none" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.navy, letterSpacing: "1px" }}>
              {loading ? "ACCUCHART AI GENERATING BRIEF…" : "PRE-VISIT BRIEF — READY"}
            </span>
          </div>
          <MarkdownBlock text={brief} loading={loading} accent={T.teal} />
        </div>
      </div>
    </div>
  );
}

// ─── STAGE 2 — SCRIBE & SOAP ─────────────────────────────────────────────────
function ScribeSOAP({ patient, soap, onAdvance }) {
  const [tab, setTab]             = useState("note");
  const [noteText, setNoteText]   = useState(soap);
  const [enhancing, setEnhancing] = useState(null);
  const [enhanced, setEnhanced]   = useState({});

  const SECTIONS = [
    { id: "hpi", label: "History of Present Illness",
      content: "Patient reports ongoing intermittent lightheadedness/dizziness, improved but not completely resolved. Confirms positive Lyme disease testing (5 bands, index 2.0). Requests amoxicillin due to GI intolerance to doxycycline. A1c 5.9% prediabetes range. Gabapentin self-adjusted to 100mg x2 nightly." },
    { id: "obj", label: "Objective / Vitals",
      content: "BP 128/58, HR 75, RR 16, Temp 97.2°F, O2 98%, Wt 147.4 lbs, BMI 27.85. Labs: Hgb 13.9, CRP elevated, Lyme positive 5 bands index 2.0, A1c 5.9%." },
    { id: "ap",  label: "Assessment / Plan",
      content: "1. Lyme disease — start amoxicillin 500mg TID x28-30 days.\n2. Lightheadedness — hydration, fall precautions, walker use.\n3. Chronic MSK pain/OA — continue gabapentin 200mg nightly.\n4. GERD — refill omeprazole.\n5. Prediabetes — lifestyle counseling, recheck A1c 6-12 months." },
  ];

  const enhance = async (sec) => {
    setEnhancing(sec.id);
    setEnhanced(e => ({ ...e, [sec.id]: "" }));
    const ctrl = new AbortController();
    await streamAI(
      `You are AccuChart's clinical note enhancer. Enhance this ${sec.label} section for better MEAT compliance and coding specificity. Keep under 6 sentences. Do not invent details.\n\nOriginal:\n"${sec.content}"`,
      t => setEnhanced(e => ({ ...e, [sec.id]: t })),
      ctrl.signal
    );
    setEnhancing(null);
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto", animation: "fadeUp .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: T.teal, letterSpacing: "2px", fontWeight: 700, marginBottom: 4 }}>STAGE 2 — AI SCRIBE & SOAP NOTE</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: T.text }}>Encounter Note — {patient.name}</h2>
          <p style={{ color: T.sub, fontSize: 13, marginTop: 2 }}>AI-generated from voice recording · {patient.dos} · 8:51 min</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" style={{ background: T.light, color: T.slate, padding: "10px 18px", fontSize: 13 }}>🖨 Print</button>
          <button className="btn" onClick={onAdvance} style={{ background: T.pink, color: "#fff", padding: "10px 20px", fontSize: 13 }}>Proceed to Coding →</button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[["Transcription","✓ Complete",T.green],["AI Scribing","✓ Complete",T.green],["MEAT Check","✓ 87% compliant",T.amber],["Coding Ready","✓ Ready",T.green]].map(([l,s,c]) => (
          <div key={l} style={{ flex:1, background:"#fff", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px" }}>
            <div style={{ fontSize:10, color:T.muted, fontWeight:700 }}>{l}</div>
            <div style={{ fontSize:12, fontWeight:700, color:c, marginTop:2 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`2px solid ${T.border}`, marginBottom:16 }}>
        {[["note","Full SOAP Note"],["sections","Section View + Enhance"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"8px 18px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:tab===id?T.pink:T.sub, borderBottom:`2px solid ${tab===id?T.pink:"transparent"}`, marginBottom:-2, transition:"all .15s" }}>{label}</button>
        ))}
      </div>

      {tab === "note" ? (
        <div className="card" style={{ padding: 28 }}>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
            style={{ width:"100%", minHeight:480, border:"none", outline:"none", fontSize:13, lineHeight:1.8, color:T.text, resize:"vertical", fontFamily:"'Lato',sans-serif" }} />
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {SECTIONS.map(sec => (
            <div key={sec.id} className="card" style={{ padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.navy }}>{sec.label}</div>
                <button className="btn" onClick={() => enhance(sec)}
                  style={{ background:`${T.pink}15`, color:T.pink, padding:"5px 14px", fontSize:12 }}>
                  {enhancing === sec.id ? "✦ Enhancing…" : "✦ Enhance with AI"}
                </button>
              </div>
              <div style={{ fontSize:13, color:T.text, lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                {enhanced[sec.id] || sec.content}
                {enhancing === sec.id && <span style={{ color:T.teal, animation:"shimmer 1s infinite" }}>▋</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STAGE 3 — AI CODING ─────────────────────────────────────────────────────
function CodingStage({ patient, icdCodes, cptCodes, missing, icdDec, setIcdDec, cptDec, setCptDec, missingAct, setMissingAct, onAdvance }) {
  const [tab, setTab]       = useState("icd");
  const [expanded, setExp]  = useState(null);
  const [aiExp, setAiExp]   = useState({});
  const [aiLoading, setAiL] = useState(null);

  const pendingICD = Object.values(icdDec).filter(d => d === "pending").length;
  const pendingCPT = Object.values(cptDec).filter(d => d === "pending").length;
  const hccCount   = icdCodes.filter(c => c.hcc && icdDec[c.id] === "accepted").length;
  const annualRev  = icdCodes.filter(c => icdDec[c.id] === "accepted").reduce((s,c) => s + c.revenue, 0);

  const decide = (id, val, setter) => setter(d => ({ ...d, [id]: val }));

  const askAI = async (code) => {
    setAiL(code.id); setAiExp(e => ({ ...e, [code.id]: "" }));
    const ctrl = new AbortController();
    await streamAI(
      `You are AccuChart's coding assistant. Explain in 3 sentences why code ${code.code} (${code.name}) was suggested for Marie Hasenpflug, 87yo.
Supporting evidence: "${code.anchor}"
${code.hcc ? `This is HCC-mapped (${code.hcc}), RAF weight ${code.rafW}, worth ~$${code.revenue}/yr.` : "Not HCC-mapped."}
${code.watch ? `Watch: ${code.watch}` : ""}
Cover: (1) why triggered, (2) what to verify, (3) confidence High/Medium/Low. Plain language.`,
      t => setAiExp(e => ({ ...e, [code.id]: t })),
      ctrl.signal
    );
    setAiL(null);
  };

  const Btns = ({ id, val, setter }) => {
    if (val === "accepted") return <div style={{ display:"flex", gap:6, alignItems:"center" }}><span style={{ color:T.green, fontWeight:700 }}>✓ Accepted</span><button className="btn" onClick={() => decide(id,"pending",setter)} style={{ background:T.light, color:T.muted, fontSize:10, padding:"3px 8px" }}>undo</button></div>;
    if (val === "rejected") return <div style={{ display:"flex", gap:6, alignItems:"center" }}><span style={{ color:T.red,   fontWeight:700 }}>✗ Rejected</span><button className="btn" onClick={() => decide(id,"pending",setter)} style={{ background:T.light, color:T.muted, fontSize:10, padding:"3px 8px" }}>undo</button></div>;
    if (val === "flagged")  return <div style={{ display:"flex", gap:6, alignItems:"center" }}><span style={{ color:T.amber, fontWeight:700 }}>⚑ Coder</span> <button className="btn" onClick={() => decide(id,"pending",setter)} style={{ background:T.light, color:T.muted, fontSize:10, padding:"3px 8px" }}>undo</button></div>;
    return (
      <div style={{ display:"flex", gap:5 }}>
        <button className="btn" onClick={() => decide(id,"accepted",setter)} style={{ background:"#DCFCE7", color:"#166534", padding:"5px 10px", fontSize:12 }}>✓</button>
        <button className="btn" onClick={() => decide(id,"flagged", setter)} style={{ background:"#FEF3C7", color:"#92400E", padding:"5px 10px", fontSize:12 }}>⚑</button>
        <button className="btn" onClick={() => decide(id,"rejected",setter)} style={{ background:"#FEE2E2", color:"#991B1B", padding:"5px 10px", fontSize:12 }}>✗</button>
      </div>
    );
  };

  return (
    <div style={{ padding:"24px 32px", maxWidth:1200, margin:"0 auto", animation:"fadeUp .3s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11, color:T.teal, letterSpacing:"2px", fontWeight:700, marginBottom:4 }}>STAGE 3 — AI CODING INTELLIGENCE</div>
          <h2 style={{ fontSize:22, fontWeight:900, fontFamily:"'Playfair Display',serif", color:T.text }}>Medical Codes — {patient.name}</h2>
        </div>
        <button className="btn" onClick={onAdvance} style={{ background:T.pink, color:"#fff", padding:"10px 22px", fontSize:13 }}>Generate Claim →</button>
      </div>

      {/* Intelligence bar */}
      <div style={{ background:T.navy, borderRadius:10, padding:"14px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:24 }}>
        <div style={{ fontSize:10, color:T.teal, letterSpacing:"2px", fontWeight:700 }}>🧠 ACCUCHART AI</div>
        {[
          { label:"Pending", val: pendingICD + pendingCPT, color: pendingICD+pendingCPT > 0 ? T.amber : T.green },
          { label:"HCC Captured", val: hccCount,           color: T.green },
          { label:"RAF Impact",   val: "+0.422",           color: "#67E8F9" },
          { label:"Annual Value", val: `$${annualRev}/yr`, color: T.green },
          { label:"Missing Codes",val: missing.length,     color: T.amber },
        ].map(m => (
          <div key={m.label} style={{ textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:m.color }}>{m.val}</div>
            <div style={{ fontSize:9, color:T.muted }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`2px solid ${T.border}`, marginBottom:20 }}>
        {[["icd","ICD-10 Codes",pendingICD],["cpt","CPT Codes",pendingCPT],["missing","Missing Codes",missing.length,T.amber]].map(([id,label,badge,bc]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"9px 18px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:tab===id?T.pink:T.sub, borderBottom:`2px solid ${tab===id?T.pink:"transparent"}`, marginBottom:-2, display:"flex", alignItems:"center", gap:6 }}>
            {label}{badge > 0 && <span style={{ background:bc||T.pink, color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:10 }}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ICD Tab */}
      {tab === "icd" && (
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"180px 1fr 130px 110px 170px", padding:"10px 20px", background:T.light, borderBottom:`1px solid ${T.border}`, fontSize:11, fontWeight:700, color:T.muted, gap:8 }}>
            <div>CODE</div><div>CONDITION · NOTE ANCHOR</div><div>RAF / HCC</div><div>REVENUE</div><div>DECISION</div>
          </div>
          {icdCodes.map((code, i) => {
            const dec = icdDec[code.id];
            const isExp = expanded === code.id;
            return (
              <div key={code.id} style={{ borderBottom: i<icdCodes.length-1 ? `1px solid ${T.border}` : "none", background: dec==="accepted"?"#F0FDF4": dec==="rejected"?"#FEF2F2":"#fff", transition:"background .2s" }}>
                <div className="row-hover" onClick={() => setExp(isExp ? null : code.id)}
                  style={{ display:"grid", gridTemplateColumns:"180px 1fr 130px 110px 170px", padding:"13px 20px", cursor:"pointer", alignItems:"start", gap:8 }}>
                  <div>
                    <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:15, fontWeight:900, color:T.text }}>{code.code}</span>
                      {code.hcc   && <span style={{ fontSize:9, background:"#FEF3C7", color:"#92400E", borderRadius:10, padding:"1px 6px", fontWeight:700 }}>⭐ HCC</span>}
                      {code.isNew && <span style={{ fontSize:9, background:`${T.teal}20`, color:T.teal, borderRadius:10, padding:"1px 6px", fontWeight:700 }}>NEW</span>}
                    </div>
                    <div style={{ fontSize:11, color:T.sub }}>{code.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, borderLeft:`3px solid ${T.pink}`, paddingLeft:8, color:T.slate, fontStyle:"italic", lineHeight:1.5 }}>
                      "{code.anchor.slice(0,80)}{code.anchor.length>80?"…":""}"
                    </div>
                    {code.upgrade && <div style={{ fontSize:10, color:T.teal,  marginTop:4 }}>↑ {code.upgrade}</div>}
                    {code.watch   && <div style={{ fontSize:10, color:T.amber, marginTop:4 }}>👁 {code.watch}</div>}
                  </div>
                  <div>
                    {code.hcc
                      ? <><div style={{ fontSize:14, fontWeight:900, color:T.text }}>+{code.rafW.toFixed(3)}</div><div style={{ fontSize:10, color:T.green, background:"#DCFCE7", padding:"1px 6px", borderRadius:4, display:"inline-block", marginTop:2 }}>{code.hcc}</div></>
                      : <div style={{ fontSize:11, color:T.muted }}>No HCC</div>}
                  </div>
                  <div style={{ fontSize:code.revenue>0?15:12, fontWeight:code.revenue>0?900:400, color:code.revenue>0?T.green:T.muted }}>
                    {code.revenue > 0 ? `$${code.revenue}/yr` : "—"}
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <Btns id={code.id} val={icdDec[code.id]} setter={setIcdDec} />
                  </div>
                </div>
                {isExp && (
                  <div style={{ padding:"0 20px 16px", borderTop:`1px solid ${T.border}`, background:"#FAFBFC", animation:"fadeUp .2s ease" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, paddingTop:14 }}>
                      <div>
                        <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:"1px", marginBottom:6 }}>FULL NOTE EVIDENCE</div>
                        <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderLeft:"4px solid #F97316", borderRadius:"0 8px 8px 0", padding:"10px 14px", fontSize:12, color:"#431407", fontStyle:"italic", lineHeight:1.7 }}>
                          "{code.anchor}"
                        </div>
                      </div>
                      <div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                          <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:"1px" }}>AI EXPLANATION</div>
                          {!aiExp[code.id] && aiLoading !== code.id && (
                            <button className="btn" onClick={() => askAI(code)} style={{ background:T.navy, color:"#67E8F9", padding:"4px 12px", fontSize:11 }}>✦ Explain</button>
                          )}
                        </div>
                        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", minHeight:70, fontSize:12, color:T.slate, lineHeight:1.7 }}>
                          {aiLoading === code.id ? <span style={{ color:T.teal, animation:"shimmer 1s infinite" }}>✦ Analyzing…</span>
                            : aiExp[code.id] ? aiExp[code.id]
                            : <span style={{ color:T.muted, fontStyle:"italic" }}>Click Explain for AI analysis</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ padding:"12px 20px", background:T.light, display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button className="btn" onClick={() => icdCodes.forEach(c => setIcdDec(d => ({...d,[c.id]:"accepted"})))} style={{ background:"#DCFCE7", color:"#166534", padding:"8px 16px", fontSize:12 }}>✓ Accept All</button>
            <button className="btn" onClick={() => icdCodes.forEach(c => { if(icdDec[c.id]==="pending") setIcdDec(d => ({...d,[c.id]:"flagged"})); })} style={{ background:"#FEF3C7", color:"#92400E", padding:"8px 16px", fontSize:12 }}>⚑ Send Pending to Coder</button>
          </div>
        </div>
      )}

      {/* CPT Tab */}
      {tab === "cpt" && (
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"140px 1fr 80px 100px 170px", padding:"10px 20px", background:T.light, borderBottom:`1px solid ${T.border}`, fontSize:11, fontWeight:700, color:T.muted, gap:8 }}>
            <div>CODE</div><div>DESCRIPTION</div><div>RVU</div><div>REVENUE</div><div>DECISION</div>
          </div>
          {cptCodes.map((code, i) => (
            <div key={code.id} style={{ display:"grid", gridTemplateColumns:"140px 1fr 80px 100px 170px", padding:"13px 20px", borderBottom:i<cptCodes.length-1?`1px solid ${T.border}`:"none", background:cptDec[code.id]==="accepted"?"#F0FDF4":"#fff", gap:8, alignItems:"start" }}>
              <div>
                <div style={{ fontSize:15, fontWeight:900, color:T.text }}>{code.code}</div>
                <div style={{ fontSize:10, color:T.muted }}>{code.type}</div>
              </div>
              <div style={{ fontSize:12, color:T.slate, lineHeight:1.5 }}>{code.name}</div>
              <div style={{ fontSize:13, fontWeight:700, color:code.rvu>0?T.text:T.muted }}>{code.rvu>0?code.rvu.toFixed(2):"—"}</div>
              <div style={{ fontSize:13, fontWeight:700, color:code.revenue>0?T.green:T.muted }}>{code.revenue>0?`$${code.revenue}`:"—"}</div>
              <div onClick={e => e.stopPropagation()}>
                <Btns id={code.id} val={cptDec[code.id]} setter={setCptDec} />
              </div>
            </div>
          ))}
          <div style={{ padding:"12px 20px", background:T.light, display:"flex", justifyContent:"flex-end" }}>
            <button className="btn" onClick={() => cptCodes.forEach(c => setCptDec(d => ({...d,[c.id]:"accepted"})))} style={{ background:"#DCFCE7", color:"#166634", padding:"8px 16px", fontSize:12 }}>✓ Accept All CPT</button>
          </div>
        </div>
      )}

      {/* Missing Tab */}
      {tab === "missing" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:10, padding:"12px 18px", display:"flex", gap:10 }}>
            <span style={{ fontSize:20 }}>⚠️</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#92400E" }}>AccuChart found {missing.length} conditions in the note that were not coded</div>
              <div style={{ fontSize:12, color:"#B45309" }}>Found in documentation but absent from the code list. Add to claim or flag for your coder.</div>
            </div>
          </div>
          {missing.map(m => {
            const act = missingAct[m.code];
            return (
              <div key={m.code} className="card" style={{ padding:"16px 20px", borderLeft:`4px solid ${m.urgency==="high"?T.red:m.urgency==="medium"?T.amber:T.teal}` }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                  <div>
                    <div style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
                      <span style={{ fontSize:15, fontWeight:900 }}>{m.code}</span>
                      <span style={{ fontSize:13, color:T.slate }}>{m.name}</span>
                      <span style={{ fontSize:10, background:m.urgency==="watch"?"#EFF6FF":"#FEF3C7", color:m.urgency==="watch"?"#1D4ED8":"#92400E", padding:"1px 7px", borderRadius:10, fontWeight:700 }}>{m.urgency==="watch"?"👁 Watch":"⚠ Suggested"}</span>
                    </div>
                    <div style={{ fontSize:12, color:T.sub, fontStyle:"italic" }}>"{m.evidence}"</div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    {act ? (
                      <span style={{ fontSize:12, fontWeight:700, color:act==="added"?T.green:T.muted }}>{act==="added"?"✓ Added":"✗ Skipped"}</span>
                    ) : (<>
                      <button className="btn" onClick={() => setMissingAct(a => ({...a,[m.code]:"added"}))} style={{ background:"#DCFCE7", color:"#166534", padding:"6px 12px", fontSize:12 }}>+ Add</button>
                      <button className="btn" onClick={() => setMissingAct(a => ({...a,[m.code]:"flagged"}))} style={{ background:"#FEF3C7", color:"#92400E", padding:"6px 12px", fontSize:12 }}>⚑ Coder</button>
                      <button className="btn" onClick={() => setMissingAct(a => ({...a,[m.code]:"skipped"}))} style={{ background:T.light, color:T.muted, padding:"6px 12px", fontSize:12 }}>Skip</button>
                    </>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── STAGE 4 — CMS-1500 ──────────────────────────────────────────────────────
function ClaimStage({ patient, acceptedICD, acceptedCPT, revenue, onAdvance }) {
  const [confirmed, setConfirmed] = useState(false);
  const diagCodes = acceptedICD.map(c => c.code).slice(0, 12);
  const procs     = acceptedCPT.slice(0, 6);
  const total     = Math.max(revenue, 192);

  const F = ({ label, value, span }) => (
    <div style={{ gridColumn: span ? `span ${span}` : "span 1" }}>
      <div style={{ fontSize:9, color:T.muted, fontWeight:700, letterSpacing:"0.5px", marginBottom:3 }}>{label}</div>
      <div style={{ background:"#F8FAFC", border:`1px solid ${T.border}`, borderRadius:5, padding:"6px 10px", fontSize:12, color:T.text, minHeight:30 }}>{value || <span style={{ color:T.muted }}>—</span>}</div>
    </div>
  );

  return (
    <div style={{ padding:"24px 32px", maxWidth:1100, margin:"0 auto", animation:"fadeUp .3s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:11, color:T.teal, letterSpacing:"2px", fontWeight:700, marginBottom:4 }}>STAGE 4 — CMS-1500 CLAIM FORM</div>
          <h2 style={{ fontSize:22, fontWeight:900, fontFamily:"'Playfair Display',serif", color:T.text }}>Auto-Generated Claim — {patient.name}</h2>
          <p style={{ color:T.sub, fontSize:13, marginTop:2 }}>Pre-populated from accepted codes · Clean-claim check passed ✓</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <label style={{ display:"flex", gap:8, alignItems:"center", cursor:"pointer", fontSize:13, color:T.slate }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width:16, height:16, accentColor:T.pink }} />
            I have reviewed and approve this claim
          </label>
          <button className="btn" disabled={!confirmed} onClick={onAdvance}
            style={{ background:confirmed?T.pink:T.light, color:confirmed?"#fff":T.muted, padding:"10px 22px", fontSize:13, cursor:confirmed?"pointer":"default" }}>
            Submit Claim →
          </button>
        </div>
      </div>

      {/* Clean claim badges */}
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        {[["✓","Clean Claim Check","Passed",T.green],["✓","Code Combinations","Valid",T.green],["✓","MEAT Compliance","87%",T.amber],["$","Expected Reimbursement",`$${total}`,T.teal]].map(([i,l,s,c]) => (
          <div key={l} style={{ flex:1, background:"#fff", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px" }}>
            <div style={{ fontSize:10, color:T.muted, fontWeight:700 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:700, color:c, marginTop:2 }}>{i} {s}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="card" style={{ padding:24, border:"2px solid #E4E8EF" }}>
        <div style={{ textAlign:"center", marginBottom:20, paddingBottom:14, borderBottom:"2px solid #0F172A" }}>
          <div style={{ fontSize:16, fontWeight:900, letterSpacing:"2px" }}>HEALTH INSURANCE CLAIM FORM</div>
          <div style={{ fontSize:11, color:T.muted }}>APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) — CMS-1500 (02-12)</div>
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.navy, background:T.light, padding:"4px 8px", borderRadius:4, marginBottom:10 }}>PATIENT & INSURED INFORMATION</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
            <F label="1a. INSURED'S ID" value={patient.memberId} />
            <F label="2. PATIENT NAME" value={patient.name.split(" ").reverse().join(", ")} />
            <F label="3. DOB" value={patient.dob} />
            <F label="5. ADDRESS" value="Poughkeepsie, NY" />
          </div>
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.navy, background:T.light, padding:"4px 8px", borderRadius:4, marginBottom:10 }}>21. DIAGNOSIS CODES (ICD-10-CM)</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
            {Array.from({ length:12 }).map((_,i) => (
              <div key={i}>
                <div style={{ fontSize:9, color:T.muted, marginBottom:2 }}>{String.fromCharCode(65+i)}.</div>
                <div style={{ background:diagCodes[i]?"#F0FDF4":"#F8FAFC", border:`1px solid ${diagCodes[i]?"#86EFAC":T.border}`, borderRadius:5, padding:"5px 8px", fontSize:12, fontWeight:diagCodes[i]?700:400, color:diagCodes[i]?T.green:T.muted, minHeight:28 }}>
                  {diagCodes[i]||""}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.navy, background:T.light, padding:"4px 8px", borderRadius:4, marginBottom:10 }}>24. SERVICE LINE ITEMS</div>
          <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"110px 70px 1fr 60px 80px 60px", background:T.light, padding:"8px 12px", fontSize:10, fontWeight:700, color:T.muted, gap:8 }}>
              <div>DATE OF SVC</div><div>PLACE</div><div>CPT / DESCRIPTION</div><div>DIAG</div><div>CHARGES</div><div>UNITS</div>
            </div>
            {(procs.length > 0 ? procs : CPT_CODES.slice(0,2)).map((code, i) => (
              <div key={code.id} style={{ display:"grid", gridTemplateColumns:"110px 70px 1fr 60px 80px 60px", padding:"8px 12px", borderTop:`1px solid ${T.border}`, fontSize:12, gap:8, background:i%2===0?"#fff":"#FAFBFC" }}>
                <div>{patient.dos}</div>
                <div>11</div>
                <div><span style={{ fontWeight:700 }}>{code.code}</span> — {code.name.slice(0,35)}</div>
                <div>{diagCodes.slice(0,4).map((_,j) => String.fromCharCode(65+j)).join(",")}</div>
                <div style={{ fontWeight:700, color:T.green }}>${code.revenue||"0.00"}</div>
                <div>1</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:12, color:T.muted }}>28. TOTAL CHARGE</div>
            <div style={{ fontSize:28, fontWeight:900, color:T.green }}>${total.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STAGE 5 — SUBMIT & TRACK ────────────────────────────────────────────────
function SubmitTrack({ patient, acceptedICD, acceptedCPT, revenue }) {
  const [insight, setInsight]       = useState("");
  const [loadingIns, setLoadingIns] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoadingIns(true);
    streamAI(
      `You are AccuChart's revenue intelligence agent. A claim was just submitted for Marie Hasenpflug, 87yo, Medicare Advantage.
Accepted ICD: ${acceptedICD.map(c => `${c.code} (${c.name})`).join(", ")||"None"}
Accepted CPT: ${acceptedCPT.map(c => c.code).join(", ")||"None"}
Encounter revenue: ~$${Math.max(revenue,192)}

Write 3 sharp sentences: (1) what was captured well, (2) one thing to watch at next visit, (3) estimated annual revenue if repeated monthly. Physician-friendly language.`,
      t => setInsight(t),
      ctrl.signal
    ).then(() => setLoadingIns(false)).catch(() => setLoadingIns(false));
    return () => ctrl.abort();
  }, []);

  const TIMELINE = [
    { time:"Now",       event:"Claim submitted to Humana Medicare Advantage", done:true },
    { time:"+1-3 days", event:"Payer acknowledgement / 277CA",                done:false },
    { time:"+7-14 days",event:"Claim adjudication",                           done:false },
    { time:"+14-21 days",event:"ERA / EOB received",                          done:false },
    { time:"+21-30 days",event:"Payment deposited",                           done:false },
  ];

  return (
    <div style={{ padding:"28px 32px", maxWidth:1100, margin:"0 auto", animation:"fadeUp .3s ease" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, color:T.teal, letterSpacing:"2px", fontWeight:700, marginBottom:4 }}>STAGE 5 — SUBMITTED & TRACKING</div>
        <h2 style={{ fontSize:22, fontWeight:900, fontFamily:"'Playfair Display',serif", color:T.text }}>Claim Submitted — {patient.name}</h2>
      </div>

      {/* Success banner */}
      <div style={{ background:`linear-gradient(135deg,${T.navy},#0E3A5F)`, borderRadius:12, padding:"24px 28px", marginBottom:24, display:"flex", gap:24, alignItems:"center" }}>
        <div style={{ fontSize:40 }}>✅</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:900, color:"#fff", marginBottom:4 }}>Claim Successfully Submitted</div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>Claim ID: ACC-{Math.random().toString().slice(2,10).toUpperCase()} · {new Date().toLocaleString()} · Humana Medicare Advantage</div>
        </div>
        {[["Codes",`${acceptedICD.length+acceptedCPT.length}`,"#67E8F9"],["Revenue",`$${Math.max(revenue,192)}`,T.green],["HCC","A69.20","#FCD34D"],["+RAF","+0.422","#C4B5FD"]].map(([l,v,c]) => (
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:"#64748B" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Timeline */}
        <div className="card" style={{ padding:24 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:16 }}>Payment Timeline</div>
          {TIMELINE.map((t, i) => (
            <div key={i} style={{ display:"flex", gap:14, marginBottom:16, alignItems:"flex-start" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:t.done?T.green:T.light, border:`2px solid ${t.done?T.green:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:t.done?"#fff":T.muted, fontWeight:700, flexShrink:0 }}>{t.done?"✓":i+1}</div>
                {i < TIMELINE.length-1 && <div style={{ width:2, height:20, background:T.border, marginTop:2 }} />}
              </div>
              <div>
                <div style={{ fontSize:11, color:T.muted, fontWeight:700 }}>{t.time}</div>
                <div style={{ fontSize:13, color:t.done?T.text:T.muted }}>{t.event}</div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Insight + Revenue card */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="card" style={{ padding:24, flex:1 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:loadingIns?T.teal:T.green, animation:loadingIns?"pulse 1s infinite":"none" }} />
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Post-Submission Intelligence</div>
            </div>
            <div style={{ fontSize:13, color:T.slate, lineHeight:1.8 }}>
              {loadingIns && !insight && <span style={{ color:T.teal, animation:"shimmer 1s infinite" }}>✦ Analyzing this encounter…</span>}
              <MarkdownBlock text={insight} accent={T.teal} />
            </div>
          </div>

          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:10, color:T.muted, fontWeight:700, marginBottom:12, letterSpacing:"1px" }}>REVENUE RECOVERED THIS ENCOUNTER</div>
            {[["Without AccuChart (baseline)","$142",T.muted],["With AccuChart codes","$472",T.green]].map(([l,v,c]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ color:T.sub }}>{l}</span>
                <span style={{ fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
              <span style={{ fontWeight:700, color:T.text }}>AccuChart Recovered</span>
              <span style={{ fontWeight:900, fontSize:18, color:T.green }}>+$330</span>
            </div>
            <div style={{ fontSize:11, color:T.muted, marginTop:6 }}>× 12 monthly visits = ~$3,960/yr for this patient alone</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MARKDOWN BLOCK ───────────────────────────────────────────────────────────
function MarkdownBlock({ text, loading, accent }) {
  if (!text && loading) return <div style={{ color: accent, animation:"shimmer 1.2s infinite", fontSize:13 }}>✦ Generating…</div>;
  if (!text) return null;
  return (
    <div style={{ fontSize:13, lineHeight:1.8 }}>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height:8 }} />;
        if (line.startsWith("### ")) return <div key={i} style={{ fontSize:12, fontWeight:900, color:accent, marginTop:16, marginBottom:5, textTransform:"uppercase", borderBottom:`1px solid ${accent}30`, paddingBottom:3 }}>{line.slice(4)}</div>;
        if (line.startsWith("## "))  return <div key={i} style={{ fontSize:15, fontWeight:700, color:T.text, marginTop:12, marginBottom:4 }}>{line.slice(3)}</div>;
        if (line.match(/^[-*]\s/))   return <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}><span style={{ color:accent, flexShrink:0 }}>▸</span><span style={{ color:T.slate }}>{line.replace(/^[-*]\s/,"").replace(/\*\*(.*?)\*\*/g,"$1")}</span></div>;
        return <div key={i} style={{ color:T.slate, marginBottom:3 }}>{line.replace(/\*\*(.*?)\*\*/g,"$1")}</div>;
      })}
    </div>
  );
}
