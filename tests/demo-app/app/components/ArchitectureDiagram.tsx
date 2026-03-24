"use client";

export type DiagramStep =
  | "idle"
  | "app"
  | "public"
  | "private"
  | "service"
  | "udp"
  | "dvla"
  | "dwp"
  | "complete";

export type DiagramVariant = "user" | "dvla" | "dwp";
export type AccentColor = "blue" | "yellow" | "purple";

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

const ACCENT: Record<AccentColor, ColorTokens> = {
  blue: {
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
  },
  yellow: {
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
  },
  purple: {
    dot: "bg-purple-500",
    line: "bg-purple-400",
    arrowHead: "text-purple-400",
    boxBorder: "border-purple-400",
    boxBg: "bg-purple-50",
    boxShadow: "shadow-purple-100",
    blockBg: "bg-purple-200",
    textPrimary: "text-purple-700",
    textSecondary: "text-purple-500",
    groupBorder: "border-purple-200",
    groupBg: "bg-purple-50/30",
    groupText: "text-purple-400",
  },
};

interface Props {
  variant?: DiagramVariant;
  activeStep?: DiagramStep;
  accentColor?: AccentColor;
}

// user: app → public → private → udp
// dvla: app → public → private → service → dvla
// dwp:  app → public → private → service → dwp
const USER_ORDER: DiagramStep[] = ["app", "public", "private", "service", "udp", "complete"];
const DVLA_ORDER: DiagramStep[] = ["app", "public", "private", "service", "dvla", "complete"];
const DWP_ORDER: DiagramStep[]  = ["app", "public", "private", "service", "dwp",  "complete"];

function orderFor(variant: DiagramVariant): DiagramStep[] {
  if (variant === "dvla") return DVLA_ORDER;
  if (variant === "dwp")  return DWP_ORDER;
  return USER_ORDER;
}

function isActive(node: DiagramStep, activeStep: DiagramStep, variant: DiagramVariant): boolean {
  if (activeStep === "idle") return false;
  const order = orderFor(variant);
  const ni = order.indexOf(node);
  if (ni === -1) return false;
  if (activeStep === "complete") return true;
  return order.indexOf(activeStep) >= ni;
}

function variantDomain(variant: DiagramVariant): "udp" | "dvla" | "dwp" {
  if (variant === "dvla") return "dvla";
  if (variant === "dwp") return "dwp";
  return "udp";
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] w-56 pointer-events-none">
      <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 leading-relaxed shadow-lg">
        {text}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
    </div>
  );
}

// Small domain block rendered inside a gateway box
function DomainChip({
  label,
  active,
  dimmed = false,
  colors,
}: {
  label: string;
  active: boolean;
  dimmed?: boolean;
  colors: ColorTokens;
}) {
  if (dimmed) {
    return (
      <div className="flex-1 px-1.5 py-1.5 rounded-lg border border-dashed border-slate-200 bg-white text-center">
        <p className="text-[9px] font-semibold leading-none tracking-wide text-slate-300">{label}</p>
      </div>
    );
  }
  return (
    <div className={`flex-1 px-1.5 py-1.5 rounded-lg border text-center transition-all duration-300 ${
      active
        ? `${colors.boxBorder} ${colors.boxBg}`
        : "border-slate-200 bg-white"
    }`}>
      <p className={`text-[9px] font-semibold leading-none tracking-wide transition-colors duration-300 ${
        active ? colors.textPrimary : "text-slate-400"
      }`}>
        {label}
      </p>
    </div>
  );
}

// Expanded domain block with tiny lambda sub-blocks (used in Public / Private gateways)
const LAMBDA_COUNTS: Record<"udp" | "dvla" | "dwp", number> = { udp: 4, dvla: 4, dwp: 3 };

function DomainBlock({
  label,
  active,
  dimmed = false,
  colors,
}: {
  label: string;
  active: boolean;
  dimmed?: boolean;
  colors: ColorTokens;
}) {
  const domain = label.toLowerCase() as "udp" | "dvla" | "dwp";
  const count = LAMBDA_COUNTS[domain] ?? 4;

  if (dimmed) {
    return (
      <div className="flex-1 px-1.5 py-2 rounded-lg border border-dashed border-slate-200 bg-white text-center">
        <p className="text-[9px] font-semibold leading-none tracking-wide text-slate-300 mb-2">{label}</p>
        <div className="flex gap-0.5 justify-center flex-wrap">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="w-4 h-4 rounded-sm bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 px-1.5 py-2 rounded-lg border text-center transition-all duration-300 ${
      active ? `${colors.boxBorder} ${colors.boxBg}` : "border-slate-200 bg-white"
    }`}>
      <p className={`text-[9px] font-semibold leading-none tracking-wide mb-2 transition-colors duration-300 ${
        active ? colors.textPrimary : "text-slate-400"
      }`}>
        {label}
      </p>
      <div className="flex gap-0.5 justify-center flex-wrap">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-sm transition-colors duration-300 ${
              active ? colors.blockBg : "bg-slate-100"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Gateway box with domain chips inside (Public / Private / Service gateways)
function GatewayBox({
  label,
  sublabel,
  active,
  future = false,
  showBlocks = false,
  variant,
  tooltip,
  colors,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  future?: boolean;
  showBlocks?: boolean;
  variant: DiagramVariant;
  tooltip?: string;
  colors: ColorTokens;
}) {
  const domain = variantDomain(variant);
  const isFutureInactive = future && !active;

  return (
    <div className="relative group w-full">
      <div className={`rounded-xl border-2 w-full transition-all duration-300 cursor-default ${
        isFutureInactive
          ? "border-dashed border-slate-300 bg-white"
          : active
          ? `${colors.boxBorder} ${colors.boxBg} shadow-sm ${colors.boxShadow}`
          : "border-slate-200 bg-white"
      }`}>
        <div className="px-4 pt-3 pb-2 text-center">
          <p className={`text-sm font-semibold transition-colors duration-300 ${
            isFutureInactive ? "text-slate-300" : active ? colors.textPrimary : "text-slate-500"
          }`}>
            {label}
          </p>
          {sublabel && (
            <p className={`text-xs mt-0.5 transition-colors duration-300 ${
              isFutureInactive ? "text-slate-300" : active ? colors.textSecondary : "text-slate-400"
            }`}>
              {sublabel}
            </p>
          )}
          {isFutureInactive && (
            <p className="text-[9px] text-slate-300 mt-0.5 uppercase tracking-wide">future</p>
          )}
        </div>
        <div className="px-3 pb-3 flex gap-1.5">
          {showBlocks ? (
            <>
              <DomainBlock label="UDP"  active={active && domain === "udp"}  dimmed={isFutureInactive} colors={colors} />
              <DomainBlock label="DVLA" active={active && domain === "dvla"} dimmed={isFutureInactive} colors={colors} />
              <DomainBlock label="DWP"  active={active && domain === "dwp"}  dimmed={isFutureInactive} colors={colors} />
            </>
          ) : (
            <>
              <DomainChip label="UDP"  active={active && domain === "udp"}  dimmed={isFutureInactive} colors={colors} />
              <DomainChip label="DVLA" active={active && domain === "dvla"} dimmed={isFutureInactive} colors={colors} />
              <DomainChip label="DWP"  active={active && domain === "dwp"}  dimmed={isFutureInactive} colors={colors} />
            </>
          )}
        </div>
      </div>
      {tooltip && (
        <div className="hidden group-hover:block">
          <Tooltip text={tooltip} />
        </div>
      )}
    </div>
  );
}

function Box({
  label,
  sublabel,
  active,
  future = false,
  tooltip,
  colors,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  future?: boolean;
  tooltip?: string;
  colors: ColorTokens;
}) {
  if (future && !active) {
    return (
      <div className="relative group w-full">
        <div className="px-3 py-3 rounded-xl border-2 border-dashed border-slate-300 bg-white text-center w-full cursor-default">
          <p className="text-sm font-semibold text-slate-300">{label}</p>
          {sublabel && <p className="text-xs text-slate-300 mt-0.5">{sublabel}</p>}
          <p className="text-[9px] text-slate-300 mt-0.5 uppercase tracking-wide">future</p>
        </div>
        {tooltip && (
          <div className="hidden group-hover:block">
            <Tooltip text={tooltip} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative group w-full">
      <div className={`px-3 py-3 rounded-xl border-2 text-center w-full transition-all duration-300 cursor-default ${
        active
          ? `${colors.boxBorder} ${colors.boxBg} shadow-sm ${colors.boxShadow}`
          : "border-slate-200 bg-white"
      }`}>
        <p className={`text-sm font-semibold transition-colors duration-300 ${active ? colors.textPrimary : "text-slate-500"}`}>
          {label}
        </p>
        {sublabel && (
          <p className={`text-xs mt-0.5 transition-colors duration-300 ${active ? colors.textSecondary : "text-slate-400"}`}>
            {sublabel}
          </p>
        )}
      </div>
      {tooltip && (
        <div className="hidden group-hover:block">
          <Tooltip text={tooltip} />
        </div>
      )}
    </div>
  );
}

function VArrow({ active, colors }: { active: boolean; colors: ColorTokens }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className={`w-0.5 h-5 transition-colors duration-300 ${active ? colors.line : "bg-slate-200"}`} />
      <svg
        className={`w-3 h-3 transition-colors duration-300 ${active ? colors.arrowHead : "text-slate-300"}`}
        viewBox="0 0 12 12" fill="currentColor"
      >
        <path d="M6 10L1 4h10z" />
      </svg>
    </div>
  );
}

const TOOLTIPS: Record<string, string> = {
  app: "The citizen-facing GOV.UK app. Makes a single API call into Flex — it never talks directly to any government department.",
  public: "The front door into Flex. Authenticates the request, enforces rate limits, and routes traffic into the private network. Never exposed beyond this point.",
  private: "Applies business rules and orchestrates calls between internal services. Sits entirely within the private network — no public internet.",
  service: "The OGD connector. Each government department plugs their data source in here. Flex handles the security and conformance; the department just connects.",
  udp: "User Data Platform — the primary data store for citizen profiles, notification preferences, and consent. Accessed over a private tunnel.",
  dvla: "Driver and Vehicle Licensing Agency. Driving licence data routed through the Service Gateway. No direct connection from the app.",
  dwp: "Department for Work and Pensions. Benefits and payment data routed through the same Service Gateway pattern.",
};

export default function ArchitectureDiagram({
  variant = "user",
  activeStep = "idle",
  accentColor = "blue",
}: Props) {
  const a = (node: DiagramStep) => isActive(node, activeStep, variant);
  const isUser = variant === "user";
  const colors = ACCENT[accentColor];
  const deptActive = a("udp") || a("dvla") || a("dwp");

  return (
    <div className="flex flex-col items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-100 w-full gap-0">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4 w-full">
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${activeStep !== "idle" ? colors.dot : "bg-slate-300"}`} />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Integration pattern
        </p>
      </div>

      {/* GOV.UK App */}
      <div className="w-48">
        <Box label="GOV.UK App" active={a("app")} tooltip={TOOLTIPS.app} colors={colors} />
      </div>

      <VArrow active={a("app")} colors={colors} />

      {/* Flex group */}
      <div className={`w-full rounded-xl border-2 p-4 transition-all duration-300 ${
        a("public") ? `${colors.groupBorder} ${colors.groupBg}` : "border-slate-200 bg-slate-50/30"
      }`}>
        <p className={`text-[9px] font-semibold uppercase tracking-widest text-center mb-3 transition-colors duration-300 ${
          a("public") ? colors.groupText : "text-slate-300"
        }`}>
          Flex
        </p>

        <div className="flex flex-col items-center">
          <GatewayBox
            label="Public Gateway"
            sublabel="front door"
            active={a("public")}
            showBlocks
            variant={variant}
            tooltip={TOOLTIPS.public}
            colors={colors}
          />
          <VArrow active={a("public")} colors={colors} />
          <GatewayBox
            label="Private Gateway"
            sublabel="business rules"
            active={a("private")}
            showBlocks
            variant={variant}
            tooltip={TOOLTIPS.private}
            colors={colors}
          />
          <VArrow active={a("private")} colors={colors} />
          <GatewayBox
            label="Service Gateway"
            sublabel="OGD connector"
            active={a("service")}
            future={isUser}
            variant={variant}
            tooltip={TOOLTIPS.service}
            colors={colors}
          />
        </div>
      </div>

      {/* Arrows: Flex → Government Departments (aligned with group box interior) */}
      <div className="flex w-full px-3 gap-2">
        <div className="flex-1 flex justify-center">
          <VArrow active={a("udp")} colors={colors} />
        </div>
        <div className="flex-1 flex justify-center">
          <VArrow active={a("dvla")} colors={colors} />
        </div>
        <div className="flex-1 flex justify-center">
          <VArrow active={a("dwp")} colors={colors} />
        </div>
      </div>

      {/* Government Departments group */}
      <div className={`w-full rounded-xl border-2 p-3 transition-all duration-300 ${
        deptActive
          ? `${colors.groupBorder} ${colors.groupBg}`
          : "border-slate-200 bg-slate-50/30"
      }`}>
        <p className={`text-[9px] font-semibold uppercase tracking-widest text-center mb-2 transition-colors duration-300 ${
          deptActive ? colors.groupText : "text-slate-300"
        }`}>
          Government Departments
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Box label="UDP" sublabel="data store" active={a("udp")} future={!isUser} tooltip={TOOLTIPS.udp} colors={colors} />
          </div>
          <div className="flex-1">
            <Box label="DVLA" sublabel="driving licence" active={a("dvla")} future={isUser} tooltip={TOOLTIPS.dvla} colors={colors} />
          </div>
          <div className="flex-1">
            <Box label="DWP" sublabel="benefits" active={a("dwp")} future={isUser} tooltip={TOOLTIPS.dwp} colors={colors} />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 w-full text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-slate-300" />
          <span>Private tunnel — no public internet</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t-2 border-dashed border-slate-300" />
          <span>Future</span>
        </div>
      </div>
    </div>
  );
}
