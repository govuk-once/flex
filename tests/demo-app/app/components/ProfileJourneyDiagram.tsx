"use client";

export type ProfileStep =
  | "idle"
  | "get_app" | "get_flex" | "get_udp"
  | "decision"
  | "get_done"
  | "not_found"
  | "create_identity"
  | "create_data"
  | "create_done";

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

const BLUE: ColorTokens = {
  dot: "bg-blue-500",
  line: "bg-blue-400",
  arrowHead: "text-blue-400",
  boxBorder: "border-blue-400",
  boxBg: "bg-blue-50",
  boxShadow: "shadow-blue-100",
  blockBg: "bg-blue-200",
  textPrimary: "text-blue-700",
  textSecondary: "text-blue-500",
  groupBorder: "border-blue-200",
  groupBg: "bg-blue-50/30",
  groupText: "text-blue-400",
};

const INDIGO: ColorTokens = {
  dot: "bg-indigo-500",
  line: "bg-indigo-400",
  arrowHead: "text-indigo-400",
  boxBorder: "border-indigo-400",
  boxBg: "bg-indigo-50",
  boxShadow: "shadow-indigo-100",
  blockBg: "bg-indigo-200",
  textPrimary: "text-indigo-700",
  textSecondary: "text-indigo-500",
  groupBorder: "border-indigo-200",
  groupBg: "bg-indigo-50/30",
  groupText: "text-indigo-400",
};

// Combined ordering used for "at or past" checks
const FULL_ORDER: ProfileStep[] = [
  "get_app", "get_flex", "get_udp", "decision",
  "not_found", "create_identity", "create_data", "create_done",
];

function atOrPast(trigger: ProfileStep, active: ProfileStep): boolean {
  const ti = FULL_ORDER.indexOf(trigger);
  const ai = FULL_ORDER.indexOf(active);
  return ti >= 0 && ai >= 0 && ai >= ti;
}

const GET_STEPS: ProfileStep[]    = ["get_app", "get_flex", "get_udp", "decision", "get_done"];
const CREATE_STEPS: ProfileStep[] = ["not_found", "create_identity", "create_data", "create_done"];

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

function DomainBlock({ label, active, colors }: { label: string; active: boolean; colors: ColorTokens }) {
  return (
    <div className={`w-full px-2 py-2 rounded-lg border-2 text-center transition-all duration-300 ${
      active ? `${colors.boxBorder} ${colors.boxBg} shadow-sm ${colors.boxShadow}` : "border-slate-200 bg-white"
    }`}>
      <p className={`text-xs font-semibold mb-1.5 transition-colors duration-300 ${active ? colors.textPrimary : "text-slate-400"}`}>
        {label}
      </p>
      <div className="flex gap-0.5 justify-center flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-sm transition-colors duration-300 ${active ? colors.blockBg : "bg-slate-100"}`} />
        ))}
      </div>
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
      <p className={`text-[10px] leading-tight transition-colors duration-300 ${
        active ? colors.textPrimary : "text-slate-400"
      }`}>
        {label}
      </p>
    </div>
  );
}

// ─── Database tables ──────────────────────────────────────────────────────────

function TableHeader({ title, active }: { title: string; active: boolean }) {
  return (
    <div className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-center transition-colors duration-300 ${
      active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
    }`}>
      {title}
    </div>
  );
}

function TableColHeaders({ cols }: { cols: string[] }) {
  return (
    <div className="grid text-[9px] font-semibold text-slate-400 border-b border-slate-100"
      style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
      {cols.map((c, i) => (
        <div key={c} className={`px-1.5 py-0.5 ${i > 0 ? "border-l border-slate-100" : ""}`}>{c}</div>
      ))}
    </div>
  );
}

function TableRow({ cells, active }: { cells: string[]; active: boolean }) {
  return (
    <div
      className={`grid text-[9px] font-mono transition-all duration-500 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
      style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}
    >
      {cells.map((val, i) => (
        <div key={i} className={`px-1.5 py-1 truncate transition-colors duration-300 ${i > 0 ? "border-l border-slate-100" : ""} ${
          active ? "text-indigo-600 bg-indigo-50" : "text-slate-400 bg-white"
        }`}>
          {val}
        </div>
      ))}
    </div>
  );
}

// ─── UNS WIP node ─────────────────────────────────────────────────────────────

function UnsWipNode({ visible }: { visible: boolean }) {
  return (
    <div className={`w-full flex items-center gap-2 transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-30"}`}>
      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
        <p className="text-[9px] font-mono text-slate-500 truncate">one_signal_id</p>
      </div>
      <svg className="w-5 h-3 flex-shrink-0 text-slate-300" viewBox="0 0 20 12" fill="currentColor">
        <path d="M0 5h14v2H0zM13 0l7 6-7 6V0z" />
      </svg>
      <div className="flex-1 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
        <p className="text-[10px] text-slate-400 leading-none">UNS Notify</p>
        <span className="inline-block mt-0.5 text-[8px] font-bold bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded">WIP</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  activeStep?: ProfileStep;
}

export default function ProfileJourneyDiagram({ activeStep = "idle" }: Props) {
  const inGetPhase    = GET_STEPS.includes(activeStep);
  const inCreatePhase = CREATE_STEPS.includes(activeStep);
  const is = (trigger: ProfileStep) => atOrPast(trigger, activeStep);

  const appActive   = is("get_app");
  const flexActive  = is("get_flex");
  const udpActive   = is("get_udp");
  const notFound    = inCreatePhase;
  const identityActive = is("create_identity");
  const dataActive     = is("create_data");
  const doneActive     = is("create_done");

  const headerDot = inCreatePhase ? INDIGO.dot : inGetPhase ? BLUE.dot : "bg-slate-300";

  const STEPS: { label: string; active: boolean; colors: ColorTokens }[] = [
    { label: "App requests user profile",      active: is("get_app"),         colors: BLUE   },
    { label: "Flex validates access token",    active: is("get_flex"),        colors: BLUE   },
    { label: "UDP checks identity store",      active: is("get_udp"),         colors: BLUE   },
    { label: "User not found — creating",      active: is("not_found"),       colors: INDIGO },
    { label: "Identity record stored in UDP",  active: is("create_identity"), colors: INDIGO },
    { label: "Notification prefs stored",      active: is("create_data"),     colors: INDIGO },
    { label: "Profile returned to app",        active: is("create_done"),     colors: INDIGO },
  ];

  return (
    <div className="flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-slate-100 w-full">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4 w-full">
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${headerDot}`} />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profile journey</p>
        <div className="ml-auto flex gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
            inGetPhase || inCreatePhase ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
          }`}>GET</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
            inCreatePhase ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
          }`}>CREATE</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex gap-3 w-full">

        {/* Left: flow diagram */}
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <Box
            label="GOV.UK App"
            sublabel={inCreatePhase ? "creating profile" : inGetPhase ? "requesting profile" : undefined}
            active={appActive}
            colors={BLUE}
          />

          <VArrow active={flexActive} colors={BLUE} />

          {/* Flex — always blue (GET path) */}
          <div className={`w-full rounded-xl border-2 px-2 py-2 transition-all duration-300 ${
            flexActive ? `${BLUE.groupBorder} ${BLUE.groupBg}` : "border-slate-200 bg-slate-50/30"
          }`}>
            <p className={`text-[8px] font-semibold uppercase tracking-widest text-center mb-2 transition-colors duration-300 ${
              flexActive ? BLUE.groupText : "text-slate-300"
            }`}>Flex</p>
            <DomainBlock label="UDP service" active={flexActive} colors={BLUE} />
          </div>

          <VArrow active={udpActive} colors={BLUE} />

          {/* Remote UDP — always blue (GET path) */}
          <div className={`w-full rounded-xl border-2 px-2 py-2 transition-all duration-300 ${
            udpActive ? `${BLUE.groupBorder} ${BLUE.groupBg}` : "border-slate-200 bg-slate-50/30"
          }`}>
            <p className={`text-[8px] font-semibold uppercase tracking-widest text-center mb-2 transition-colors duration-300 ${
              udpActive ? BLUE.groupText : "text-slate-300"
            }`}>Remote — UDP</p>
            <Box label="UDP" sublabel="identity & data store" active={udpActive} colors={BLUE} />
          </div>

          {/* Tables — animate in on create */}
          <div className={`w-full flex gap-1.5 mt-2 transition-opacity duration-500 ${notFound ? "opacity-100" : "opacity-0"}`}>
            <div className={`flex-1 rounded-lg border-2 overflow-hidden transition-all duration-300 ${
              identityActive ? "border-indigo-300" : "border-slate-200"
            }`}>
              <TableHeader title="Identity" active={identityActive} />
              <TableColHeaders cols={["udpId", "extId"]} />
              <TableRow cells={["udp-01…", "d6a…"]} active={identityActive} />
            </div>
            <div className={`flex-1 rounded-lg border-2 overflow-hidden transition-all duration-300 ${
              dataActive ? "border-indigo-300" : "border-slate-200"
            }`}>
              <TableHeader title="Data" active={dataActive} />
              <TableColHeaders cols={["key", "value"]} />
              <TableRow cells={["one_signal_id", "dNVRHHR-Ik3vzs_QBsIv2WB7nCr-sROc6jIXxOqPRQQ"]} active={dataActive} />
              <TableRow cells={["consent", "accepted"]} active={dataActive} />
            </div>
          </div>

          {/* UNS WIP */}
          <div className={`w-full mt-2 transition-opacity duration-500 ${notFound ? "opacity-100" : "opacity-0"}`}>
            <UnsWipNode visible={doneActive} />
          </div>
        </div>

        {/* Right: numbered steps */}
        <div className="w-[118px] flex-shrink-0 flex flex-col gap-1">
          {STEPS.map((s, i) => (
            <StepCard key={i} number={i + 1} label={s.label} active={s.active} colors={s.colors} />
          ))}
        </div>

      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 w-full text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-300" />
          <span>GET</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-indigo-400" />
          <span>CREATE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t-2 border-dashed border-orange-300" />
          <span>WIP</span>
        </div>
      </div>
    </div>
  );
}
