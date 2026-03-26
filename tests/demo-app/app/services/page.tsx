"use client";

import { useEffect, useRef, useState } from "react";

import ArchitectureDiagram, {
  type AccentColor,
  type DiagramStep,
  type DiagramVariant,
} from "../components/ArchitectureDiagram";
import LinkingDiagram, { type LinkStep } from "../components/LinkingDiagram";
import MacButton from "../components/MacButton";

const SHOW_ARCH_DIAGRAM = process.env.NEXT_PUBLIC_SHOW_ARCH_DIAGRAM !== "false";

interface Field {
  label: string;
  value: string;
}

interface DepartmentData {
  id: string;
  name: string;
  accent: AccentColor;
  cardColour: string;
  iconColour: string;
  connectBtnClass: string;
  step: DiagramStep;
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DepartmentCard({
  dept,
  fields,
}: {
  dept: DepartmentData;
  fields: Field[];
}) {
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
        {fields.map((f) => (
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
          "Consent"
        )}
      </button>
    </div>
  );
}

function DepartmentSkeleton() {
  return (
    <div className="border-2 border-slate-100 rounded-2xl p-4 bg-white animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-slate-100 rounded w-1/3" />
          <div className="h-2 bg-slate-100 rounded w-1/4" />
        </div>
        <div className="h-8 w-20 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

// Timings (ms) for the Link ID journey phases, triggered on DVLA connect
const LINK_ANIM: Array<{ step: LinkStep; delay: number }> = [
  // Phase 1 — register link ID
  { step: "reg_app",     delay: 0 },
  { step: "reg_public",  delay: 800 },
  { step: "reg_private", delay: 1600 },
  { step: "reg_udp",     delay: 2400 },
  { step: "reg_done",    delay: 3200 },
  // Phase 2 — fetch data using link ID
  { step: "fetch_app",     delay: 4400 },
  { step: "fetch_public",  delay: 5200 },
  { step: "fetch_private", delay: 6000 },
  { step: "fetch_service", delay: 6800 },
  { step: "fetch_data",    delay: 7800 },
  { step: "fetch_done",    delay: 9000 },
];

export default function ServicesPage() {
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [depsLoading, setDepsLoading] = useState(true);

  const [diagramVariant, setDiagramVariant] = useState<DiagramVariant>("dvla");
  const [diagramStep, setDiagramStep] = useState<DiagramStep>("idle");
  const [accentColor, setAccentColor] = useState<AccentColor>("blue");

  const [linkStep, setLinkStep] = useState<LinkStep>("idle");

  // Map of department id → live fields fetched after connecting
  const [connectedFields, setConnectedFields] = useState<Map<string, Field[]>>(new Map());
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [archMinimized, setArchMinimized] = useState(false);

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data: DepartmentData[]) => setDepartments(data))
      .catch(() => setDepartments([]))
      .finally(() => setDepsLoading(false));
  }, []);

  const clearAnimTimers = () => {
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];
  };

  useEffect(() => () => clearAnimTimers(), []);

  const runArchAnim = (step: DiagramStep) => {
    setDiagramStep("app");
    animTimers.current.push(
      setTimeout(() => setDiagramStep("public"),  1000),
      setTimeout(() => setDiagramStep("private"), 2000),
      setTimeout(() => setDiagramStep("service"), 3000),
      setTimeout(() => setDiagramStep(step),      4000),
    );
  };

  const replayAll = () => {
    if (connecting) return;
    clearAnimTimers();
    setDiagramVariant("dvla");
    setAccentColor("yellow");
    setLinkStep("idle");
    runArchAnim("dvla");
    for (const { step, delay } of LINK_ANIM) {
      animTimers.current.push(setTimeout(() => setLinkStep(step), delay));
    }
    animTimers.current.push(setTimeout(() => setDiagramStep("complete"), 9500));
  };

  const replayPhase1 = () => {
    if (connecting) return;
    clearAnimTimers();
    setDiagramVariant("dvla");
    setAccentColor("yellow");
    setLinkStep("idle");
    runArchAnim("dvla");
    const phase1 = LINK_ANIM.filter(({ step }) => step.startsWith("reg_"));
    for (const { step, delay } of phase1) {
      animTimers.current.push(setTimeout(() => setLinkStep(step), delay));
    }
  };

  const replayPhase2 = () => {
    if (connecting) return;
    clearAnimTimers();
    setDiagramVariant("dvla");
    setAccentColor("yellow");
    // Pre-set to reg_done so identity table shows as written before phase 2 starts
    setLinkStep("reg_done");
    runArchAnim("dvla");
    const phase2 = LINK_ANIM.filter(({ step }) => step.startsWith("fetch_"));
    const offset = phase2[0].delay;
    for (const { step, delay } of phase2) {
      animTimers.current.push(setTimeout(() => setLinkStep(step), delay - offset));
    }
    animTimers.current.push(setTimeout(() => setDiagramStep("complete"), phase2[phase2.length - 1].delay - offset + 500));
  };

  const handleConnect = async (dept: DepartmentData) => {
    if (connecting) return;

    setConnecting(dept.id);
    setConnectError(null);
    setDiagramVariant(dept.id as DiagramVariant);
    setAccentColor(dept.accent);
    clearAnimTimers();

    // Architecture diagram animation
    setDiagramStep("app");
    animTimers.current.push(
      setTimeout(() => setDiagramStep("public"),  1000),
      setTimeout(() => setDiagramStep("private"), 2000),
      setTimeout(() => setDiagramStep("service"), 3000),
      setTimeout(() => setDiagramStep(dept.step), 4000),
    );

    // Link ID journey animation — only for DVLA
    if (dept.id === "dvla") {
      setLinkStep("idle");
      for (const { step, delay } of LINK_ANIM) {
        animTimers.current.push(setTimeout(() => setLinkStep(step), delay));
      }
    }

    try {
      const res = await fetch(`/api/${dept.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const fields: Field[] = Array.isArray(data.fields) ? data.fields : [];

      // Wait for the full Link ID animation to complete before showing result
      await new Promise<void>((resolve) => setTimeout(resolve, 9200));

      setDiagramStep("complete");
      setConnectedFields((prev) => new Map([...prev, [dept.id, fields]]));
    } catch (err) {
      clearAnimTimers();
      setDiagramStep("idle");
      setLinkStep("idle");
      setConnectError(
        err instanceof Error ? err.message : "Connection failed",
      );
    } finally {
      setConnecting(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
      <div className="flex flex-col xl:flex-row items-center xl:items-start gap-8 w-full max-w-7xl">

        {/* Left: Architecture diagram (feature-flagged) */}
        {SHOW_ARCH_DIAGRAM && (
          <div className={`xl:pt-12 flex-shrink-0 transition-all duration-300 ${archMinimized ? "w-10" : "w-full xl:w-[380px]"}`}>
            {archMinimized ? (
              <MacButton minimized label="architecture" onToggle={() => setArchMinimized(false)} />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <MacButton minimized={false} label="architecture" onToggle={() => setArchMinimized(true)} />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Architecture</p>
                </div>

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
              </>
            )}
          </div>
        )}

        {/* Centre: Phone frame */}
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
              Consent
            </p>

            {connectError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs text-red-600">{connectError}</p>
              </div>
            )}

            {depsLoading ? (
              <>
                <DepartmentSkeleton />
                <DepartmentSkeleton />
              </>
            ) : (
              departments.map((dept) =>
                connectedFields.has(dept.id) ? (
                  <DepartmentCard
                    key={dept.id}
                    dept={dept}
                    fields={connectedFields.get(dept.id)!}
                  />
                ) : (
                  <ConnectButton
                    key={dept.id}
                    dept={dept}
                    onConnect={() => handleConnect(dept)}
                    connecting={connecting === dept.id}
                  />
                ),
              )
            )}

            <div className="h-2" />
          </div>
        </div>

        {/* Right: Link ID journey diagram (shown for DVLA) */}
        <div className="w-full xl:w-[460px] xl:pt-12 flex-shrink-0">
          <LinkingDiagram activeStep={linkStep} />

          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Link ID journey
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              When you consent to DVLA, Flex stores a link ID against your profile in UDP. On every subsequent request, the Service Gateway resolves that link automatically — the app never holds DVLA credentials.
            </p>
          </div>

          {/* Demo replay controls */}
          <div className="mt-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Replay</p>
            <div className="flex gap-1.5">
              <button
                onClick={replayAll}
                disabled={!!connecting}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition-colors active:scale-95"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M10.5 6A4.5 4.5 0 116 1.5v1.25L8.5 0 11 2.75 8.5 5V3.6A3.4 3.4 0 1010.5 6z" />
                </svg>
                Full
              </button>
              <button
                onClick={replayPhase1}
                disabled={!!connecting}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 disabled:opacity-40 transition-colors active:scale-95"
              >
                Phase 1
              </button>
              <button
                onClick={replayPhase2}
                disabled={!!connecting}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 disabled:opacity-40 transition-colors active:scale-95"
              >
                Phase 2
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
