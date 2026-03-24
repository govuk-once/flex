"use client";

import { useEffect, useRef, useState } from "react";
import ArchitectureDiagram, {
  type AccentColor,
  type DiagramStep,
} from "../components/ArchitectureDiagram";

interface DepartmentData {
  id: string;
  name: string;
  accent: AccentColor;
  cardColour: string;
  iconColour: string;
  connectBtnClass: string;
  step: DiagramStep;
  fields: { label: string; value: string }[];
}

const DEPARTMENTS: DepartmentData[] = [
  {
    id: "dvla",
    name: "DVLA",
    accent: "yellow",
    cardColour: "bg-yellow-50 border-yellow-200",
    iconColour: "bg-yellow-400 text-yellow-900",
    connectBtnClass: "bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200",
    step: "dvla",
    fields: [
      { label: "Licence number", value: "JONES751116JA9AB" },
      { label: "Categories", value: "B (car)  ·  A1 (motorcycle)" },
      { label: "Valid until", value: "14 Apr 2031" },
      { label: "Status", value: "Full licence" },
    ],
  },
  {
    id: "dwp",
    name: "DWP",
    accent: "purple",
    cardColour: "bg-purple-50 border-purple-200",
    iconColour: "bg-purple-500 text-white",
    connectBtnClass: "bg-purple-500 hover:bg-purple-600 shadow-purple-200",
    step: "dwp",
    fields: [
      { label: "Benefit", value: "Universal Credit" },
      { label: "Monthly amount", value: "£658.19" },
      { label: "Next payment", value: "3 Apr 2026" },
      { label: "Reference", value: "UC-2024-88341" },
    ],
  },
];

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DepartmentCard({ dept }: { dept: DepartmentData }) {
  return (
    <div className={`border-2 rounded-2xl p-4 ${dept.cardColour}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${dept.iconColour}`}>
          {dept.name.slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">{dept.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-xs text-green-600 font-medium">Connected</p>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {dept.fields.map((f) => (
          <div key={f.label} className="flex justify-between items-baseline gap-2">
            <p className="text-xs text-slate-400 flex-shrink-0">{f.label}</p>
            <p className="text-xs font-mono text-slate-700 text-right">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectButton({
  dept,
  onConnect,
  connecting,
}: {
  dept: DepartmentData;
  onConnect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="border-2 border-slate-200 rounded-2xl p-4 bg-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm opacity-60 ${dept.iconColour}`}>
          {dept.name.slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">{dept.name}</p>
          <p className="text-xs text-slate-400">Not connected</p>
        </div>
      </div>
      <button
        onClick={onConnect}
        disabled={connecting}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white transition-all active:scale-95 shadow-sm disabled:opacity-50 ${dept.connectBtnClass}`}
      >
        {connecting ? (
          <>
            <Spinner />
            <span>Connecting…</span>
          </>
        ) : (
          "Connect"
        )}
      </button>
    </div>
  );
}

export default function ServicesPage() {
  const [diagramVariant, setDiagramVariant] = useState<"dvla" | "dwp">("dvla");
  const [diagramStep, setDiagramStep] = useState<DiagramStep>("idle");
  const [accentColor, setAccentColor] = useState<AccentColor>("blue");
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<string | null>(null);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAnimTimers = () => {
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];
  };

  useEffect(() => () => clearAnimTimers(), []);

  const handleConnect = (dept: DepartmentData) => {
    if (connecting) return;
    setConnecting(dept.id);
    setDiagramVariant(dept.id as "dvla" | "dwp");
    setAccentColor(dept.accent);
    clearAnimTimers();

    // Animate the path to this department only
    setDiagramStep("app");
    animTimers.current.push(
      setTimeout(() => setDiagramStep("public"),       500),
      setTimeout(() => setDiagramStep("private"),     1000),
      setTimeout(() => setDiagramStep("service"),     1500),
      setTimeout(() => setDiagramStep(dept.step),     2000),
      setTimeout(() => setDiagramStep("complete"),    2400),
      setTimeout(() => {
        setConnected((prev) => new Set([...prev, dept.id]));
        setConnecting(null);
      }, 2600),
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 w-full max-w-4xl">

        {/* Architecture diagram */}
        <div className="w-full lg:w-[420px] lg:pt-12 flex-shrink-0">
          <ArchitectureDiagram
            variant={diagramVariant}
            activeStep={diagramStep}
            accentColor={accentColor}
          />

          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              The pattern
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Any government department follows the same path. Flex handles the security, private networking, and conformance — the department just connects their data source to the Service Gateway.
            </p>
          </div>
        </div>

        {/* Phone frame */}
        <div className="w-[375px] flex-shrink-0 bg-white rounded-[44px] shadow-2xl overflow-hidden border-[10px] border-slate-800">
          {/* Notch */}
          <div className="bg-slate-800 flex justify-center pb-2 pt-1">
            <div className="w-24 h-5 bg-slate-900 rounded-full" />
          </div>

          {/* Status bar */}
          <div className="bg-white flex justify-between items-center px-6 pt-2 pb-1 text-xs font-medium text-slate-500">
            <span>9:41</span>
            <div className="flex gap-1 items-center">
              <div className="w-3.5 h-2 rounded-sm border border-slate-400 relative">
                <div className="absolute inset-0.5 right-1 bg-slate-400 rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* App header */}
          <div className="bg-blue-600 px-6 py-5">
            <p className="text-blue-200 text-xs font-medium uppercase tracking-widest">
              GOVUK.app - Fake
            </p>
            <h1 className="text-white text-2xl font-bold mt-0.5">My Services</h1>
          </div>

          {/* Connected services list */}
          <div className="overflow-y-auto max-h-[580px] px-5 py-5 space-y-3">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
              Government departments
            </p>

            {DEPARTMENTS.map((dept) =>
              connected.has(dept.id) ? (
                <DepartmentCard key={dept.id} dept={dept} />
              ) : (
                <ConnectButton
                  key={dept.id}
                  dept={dept}
                  onConnect={() => handleConnect(dept)}
                  connecting={connecting === dept.id}
                />
              )
            )}

            <div className="h-2" />
          </div>
        </div>
      </div>
    </main>
  );
}
