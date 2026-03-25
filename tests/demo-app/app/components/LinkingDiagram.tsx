"use client";

export type LinkStep =
  | "idle"
  | "reg_app" | "reg_public" | "reg_private" | "reg_udp" | "reg_done"
  | "fetch_app" | "fetch_public" | "fetch_private" | "fetch_service" | "fetch_data" | "fetch_done";

interface ColorTokens {
  dot: string;
  line: string;
  arrowHead: string;
  boxBorder: string;
  boxBg: string;
  boxShadow: string;
  blockBg: string;
  textPrimary: string;
  textSecondary: string;
  groupBorder: string;
  groupBg: string;
  groupText: string;
}

const GREEN: ColorTokens = {
  dot: "bg-green-500",
  line: "bg-green-400",
  arrowHead: "text-green-400",
  boxBorder: "border-green-400",
  boxBg: "bg-green-50",
  boxShadow: "shadow-green-100",
  blockBg: "bg-green-200",
  textPrimary: "text-green-700",
  textSecondary: "text-green-500",
  groupBorder: "border-green-200",
  groupBg: "bg-green-50/30",
  groupText: "text-green-400",
};

const YELLOW: ColorTokens = {
  dot: "bg-yellow-500",
  line: "bg-yellow-400",
  arrowHead: "text-yellow-400",
  boxBorder: "border-yellow-500",
  boxBg: "bg-yellow-50",
  boxShadow: "shadow-yellow-100",
  blockBg: "bg-yellow-200",
  textPrimary: "text-yellow-700",
  textSecondary: "text-yellow-600",
  groupBorder: "border-yellow-200",
  groupBg: "bg-yellow-50/30",
  groupText: "text-yellow-500",
};

const REG_ORDER: LinkStep[]   = ["reg_app",   "reg_public",   "reg_private",   "reg_udp",   "reg_done"];
const FETCH_ORDER: LinkStep[] = ["fetch_app", "fetch_public", "fetch_private", "fetch_service", "fetch_data", "fetch_done"];

const FULL_ORDER: LinkStep[] = [...REG_ORDER, ...FETCH_ORDER];

function atOrPast(trigger: LinkStep, active: LinkStep): boolean {
  const ti = FULL_ORDER.indexOf(trigger);
  const ai = FULL_ORDER.indexOf(active);
  return ti >= 0 && ai >= 0 && ai >= ti;
}

function p1Active(node: LinkStep, step: LinkStep): boolean {
  if (!REG_ORDER.includes(step)) return false;
  return REG_ORDER.indexOf(step) >= REG_ORDER.indexOf(node);
}

function p2Active(node: LinkStep, step: LinkStep): boolean {
  if (!FETCH_ORDER.includes(step)) return false;
  return FETCH_ORDER.indexOf(step) >= FETCH_ORDER.indexOf(node);
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function VArrow({ active, colors }: { active: boolean; colors: ColorTokens }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className={`w-0.5 h-4 transition-colors duration-300 ${active ? colors.line : "bg-slate-200"}`} />
      <svg
        className={`w-3 h-3 transition-colors duration-300 ${active ? colors.arrowHead : "text-slate-300"}`}
        viewBox="0 0 12 12" fill="currentColor"
      >
        <path d="M6 10L1 4h10z" />
      </svg>
    </div>
  );
}

function Box({ label, sublabel, active, colors }: {
  label: string; sublabel?: string; active: boolean; colors: ColorTokens;
}) {
  return (
    <div className={`w-full px-2 py-2 rounded-lg border-2 text-center transition-all duration-300 ${
      active ? `${colors.boxBorder} ${colors.boxBg} shadow-sm ${colors.boxShadow}` : "border-slate-200 bg-white"
    }`}>
      <p className={`text-xs font-semibold transition-colors duration-300 ${active ? colors.textPrimary : "text-slate-500"}`}>
        {label}
      </p>
      {sublabel && (
        <p className={`text-[10px] transition-colors duration-300 ${active ? colors.textSecondary : "text-slate-400"}`}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

const LAMBDA_COUNTS: Record<string, number> = { udp: 4, dvla: 4, uns: 3 };

function DomainBlock({ label, active, colors }: { label: string; active: boolean; colors: ColorTokens }) {
  const count = LAMBDA_COUNTS[label.toLowerCase()] ?? 4;
  return (
    <div className={`w-full px-2 py-2 rounded-lg border-2 text-center transition-all duration-300 ${
      active ? `${colors.boxBorder} ${colors.boxBg} shadow-sm ${colors.boxShadow}` : "border-slate-200 bg-white"
    }`}>
      <p className={`text-xs font-semibold mb-1.5 transition-colors duration-300 ${active ? colors.textPrimary : "text-slate-400"}`}>
        {label}
      </p>
      <div className="flex gap-0.5 justify-center flex-wrap">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-sm transition-colors duration-300 ${active ? colors.blockBg : "bg-slate-100"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Remote service box (standalone, no outer group) ─────────────────────────

function RemoteServiceBox({ serviceLabel, sublabel, active, colors }: {
  serviceLabel: string; sublabel?: string; active: boolean; colors: ColorTokens;
}) {
  return (
    <div className="flex-1 flex flex-col gap-1">
      <p className={`text-[8px] font-semibold uppercase tracking-widest text-center transition-colors duration-300 ${
        active ? colors.groupText : "text-slate-300"
      }`}>
        Remote
      </p>
      <Box label={serviceLabel} sublabel={sublabel} active={active} colors={colors} />
    </div>
  );
}

// ─── Split connector (Flex → UDP + DVLA) ─────────────────────────────────────

function SplitConnector({ udpActive, dvlaActive, colors }: {
  udpActive: boolean; dvlaActive: boolean; colors: ColorTokens;
}) {
  const udpLine  = udpActive  ? colors.line      : "bg-slate-200";
  const dvlaLine = dvlaActive ? colors.line      : "bg-slate-200";
  const udpHead  = udpActive  ? colors.arrowHead : "text-slate-300";
  const dvlaHead = dvlaActive ? colors.arrowHead : "text-slate-300";

  return (
    <div className="relative w-full" style={{ height: "44px" }}>
      {/* stem down from Flex */}
      <div className={`absolute left-1/2 top-0 w-0.5 h-3 -translate-x-1/2 transition-colors duration-300 ${
        udpActive || dvlaActive ? colors.line : "bg-slate-200"
      }`} />
      {/* horizontal bar */}
      <div className={`absolute left-[16%] right-[16%] top-3 h-0.5 transition-colors duration-300 ${
        udpActive || dvlaActive ? colors.line : "bg-slate-200"
      }`} />
      {/* left leg → UDP */}
      <div className={`absolute left-[16%] top-3 w-0.5 h-4 -translate-x-1/2 transition-colors duration-300 ${udpLine}`} />
      <svg className={`absolute w-3 h-3 -translate-x-1/2 transition-colors duration-300 ${udpHead}`}
        style={{ left: "16%", top: "26px" }} viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 10L1 4h10z" />
      </svg>
      {/* right leg → DVLA */}
      <div className={`absolute right-[16%] top-3 w-0.5 h-4 translate-x-1/2 transition-colors duration-300 ${dvlaLine}`} />
      <svg className={`absolute w-3 h-3 translate-x-1/2 transition-colors duration-300 ${dvlaHead}`}
        style={{ right: "16%", top: "26px" }} viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 10L1 4h10z" />
      </svg>
    </div>
  );
}

// ─── Identity table ───────────────────────────────────────────────────────────

function IdentityTableRow({ cells, writing, reading }: {
  cells: string[]; writing: boolean; reading: boolean;
}) {
  const active = writing || reading;
  return (
    <div
      className={`grid text-[9px] font-mono transition-all duration-500 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
      style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}
    >
      {cells.map((val, i) => (
        <div key={i} className={`px-1.5 py-1 truncate transition-colors duration-300 ${i > 0 ? "border-l border-slate-100" : ""} ${
          reading ? "text-yellow-700 bg-yellow-50" : writing ? "text-green-700 bg-green-50" : "text-slate-400 bg-white"
        }`}>
          {val}
        </div>
      ))}
    </div>
  );
}

function IdentityTable({ writing, reading }: { writing: boolean; reading: boolean }) {
  const active = writing || reading;
  const headerColor = reading ? "bg-yellow-100 text-yellow-700" : writing ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400";
  const borderColor = reading ? "border-yellow-300" : writing ? "border-green-300" : "border-slate-200";

  return (
    <div className={`w-full rounded-lg border-2 overflow-hidden transition-all duration-300 ${borderColor}`}>
      <div className={`px-2 py-1 flex items-center justify-between transition-colors duration-300 ${headerColor}`}>
        <span className="text-[9px] font-bold uppercase tracking-widest">Identity</span>
        {active && (
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors duration-300 ${
            reading ? "bg-yellow-200 text-yellow-800" : "bg-green-200 text-green-800"
          }`}>
            {reading ? "READ" : "WRITE"}
          </span>
        )}
      </div>
      <div className="grid text-[9px] font-semibold text-slate-400 border-b border-slate-100"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {["udpId", "dvla_id", "service"].map((col, i) => (
          <div key={col} className={`px-1.5 py-0.5 ${i > 0 ? "border-l border-slate-100" : ""}`}>{col}</div>
        ))}
      </div>
      <IdentityTableRow cells={["udp-01…", "dvla-9f…", "DVLA"]} writing={writing} reading={reading} />
    </div>
  );
}

// ─── Numbered step annotation ─────────────────────────────────────────────────

function StepCard({ number, label, active, colors }: {
  number: number; label: string; active: boolean; colors: ColorTokens;
}) {
  return (
    <div className={`flex items-start gap-1.5 px-1.5 py-1.5 rounded-lg border transition-all duration-300 ${
      active ? `${colors.boxBorder} ${colors.boxBg}` : "border-transparent"
    }`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5 transition-colors duration-300 ${
        active ? `${colors.blockBg} ${colors.textPrimary}` : "bg-slate-100 text-slate-400"
      }`}>
        {number}
      </span>
      <p className={`text-[10px] leading-tight transition-colors duration-300 ${active ? colors.textPrimary : "text-slate-400"}`}>
        {label}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  activeStep?: LinkStep;
}

export default function LinkingDiagram({ activeStep = "idle" }: Props) {
  const isP1 = (node: LinkStep) => p1Active(node, activeStep);
  const isP2 = (node: LinkStep) => p2Active(node, activeStep);
  const is   = (trigger: LinkStep) => atOrPast(trigger, activeStep);

  const p1Any = REG_ORDER.includes(activeStep);
  const p2Any = FETCH_ORDER.includes(activeStep);
  const C = p2Any ? YELLOW : GREEN;

  const appActive   = isP1("reg_app")    || isP2("fetch_app");
  const flexActive  = isP1("reg_public") || isP2("fetch_public");
  const udpRemote   = isP1("reg_udp")    || isP2("fetch_service");
  const dvlaRemote  = isP2("fetch_data");

  const tableWriting = (isP1("reg_udp") || p2Any) && !isP2("fetch_service");
  const tableReading = isP2("fetch_service");

  const headerDot = p2Any ? YELLOW.dot : p1Any ? GREEN.dot : "bg-slate-300";

  const STEPS: { label: string; trigger: LinkStep; colors: ColorTokens }[] = [
    { label: "App consents to DVLA and passes link id to Flex",         trigger: "reg_app",      colors: GREEN  },
    { label: "Enters Flex public gateway",   trigger: "reg_public",   colors: GREEN  },
    { label: "Routed via private network",   trigger: "reg_private",  colors: GREEN  },
    { label: "Link ID written to UDP",       trigger: "reg_udp",      colors: GREEN  },
    { label: "Link registration confirmed",  trigger: "reg_done",     colors: GREEN  },
    { label: "App requests DVLA data with access token",       trigger: "fetch_app",    colors: YELLOW },
    { label: "Flex Routes to Service Gateway",    trigger: "fetch_private",colors: YELLOW },
    { label: "Link ID read from UDP",        trigger: "fetch_service",colors: YELLOW },
    { label: "DVLA returns driving data",    trigger: "fetch_data",   colors: YELLOW },
    { label: "Data delivered to app",        trigger: "fetch_done",   colors: YELLOW },
  ];

  return (
    <div className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-slate-100 w-full">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4 w-full">
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${headerDot}`} />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Link ID journey</p>
        <div className="ml-auto flex gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
            p1Any ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
          }`}>Phase 1</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
            p2Any ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-400"
          }`}>Phase 2</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex gap-3 w-full">

        {/* Left: flow diagram */}
        <div className="flex-1 min-w-0 flex flex-col items-center">

          {/* GOV.UK App */}
          <Box
            label="GOV.UK App"
            sublabel={p2Any ? "access token" : p1Any ? "sends link ID" : undefined}
            active={appActive}
            colors={C}
          />

          <VArrow active={flexActive} colors={C} />

          {/* Flex */}
          <div className={`w-full rounded-xl border-2 px-2 py-2 transition-all duration-300 ${
            flexActive ? `${C.groupBorder} ${C.groupBg}` : "border-slate-200 bg-slate-50/30"
          }`}>
            <p className={`text-[8px] font-semibold uppercase tracking-widest text-center mb-2 transition-colors duration-300 ${
              flexActive ? C.groupText : "text-slate-300"
            }`}>Flex</p>
            <div className="flex gap-1.5">
              <div className="flex-1">
                <DomainBlock label="UDP" active={isP1("reg_public") || isP2("fetch_service")} colors={C} />
              </div>
              <div className="flex-1">
                <DomainBlock label="DVLA" active={isP2("fetch_service")} colors={C} />
              </div>
            </div>
          </div>

          {/* Split connector */}
          <SplitConnector
            udpActive={udpRemote}
            dvlaActive={dvlaRemote}
            colors={C}
          />

          {/* Separate remote service boxes — no outer wrapper */}
          <div className="flex gap-1.5 w-full">
            <RemoteServiceBox
              serviceLabel="UDP"
              sublabel={p1Any ? "stores link ID" : "link ID lookup"}
              active={udpRemote}
              colors={GREEN}
            />
            <RemoteServiceBox
              serviceLabel="DVLA"
              sublabel="driving licence data"
              active={dvlaRemote}
              colors={YELLOW}
            />
          </div>

          {/* Identity table */}
          <div className="w-full mt-3">
            <IdentityTable writing={tableWriting} reading={tableReading} />
          </div>

        </div>

        {/* Right: numbered steps */}
        <div className="w-[118px] flex-shrink-0 flex flex-col gap-1">
          {STEPS.map((s, i) => (
            <StepCard
              key={i}
              number={i + 1}
              label={s.label}
              active={is(s.trigger)}
              colors={s.colors}
            />
          ))}
        </div>

      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 w-full text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-green-300" />
          <span>Phase 1 — register link</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-yellow-400" />
          <span>Phase 2 — fetch data</span>
        </div>
      </div>
    </div>
  );
}
