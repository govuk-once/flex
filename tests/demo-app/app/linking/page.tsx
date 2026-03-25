"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LinkingDiagram, { type LinkStep } from "../components/LinkingDiagram";

const PHASES: Array<{
  phase: 1 | 2;
  title: string;
  description: string;
  steps: Array<{ label: string; detail: string }>;
  firstStep: LinkStep;
  animSteps: Array<{ step: LinkStep; delay: number }>;
  doneStep: LinkStep;
  accent: string;
  btnClass: string;
}> = [
  {
    phase: 1,
    title: "Phase 1 — Register Link ID",
    description:
      "The app sends a linking ID to Flex. Flex authenticates the request, routes it through the private network, and stores the link ID in the User Data Platform.",
    steps: [
      { label: "App sends link ID", detail: "GOV.UK app makes a single call into Flex, passing the link ID in the request body." },
      { label: "Flex authenticates & routes", detail: "Public and Private Gateways validate the token and route to UDP over the private network." },
      { label: "UDP stores the link", detail: "The link ID is persisted against the user's profile in the User Data Platform." },
    ],
    firstStep: "reg_app",
    animSteps: [
      { step: "reg_app",     delay: 0 },
      { step: "reg_public",  delay: 500 },
      { step: "reg_private", delay: 1000 },
      { step: "reg_udp",     delay: 1500 },
      { step: "reg_done",    delay: 2200 },
    ],
    doneStep: "reg_done",
    accent: "green",
    btnClass: "bg-green-600 hover:bg-green-700 shadow-green-200",
  },
  {
    phase: 2,
    title: "Phase 2 — Fetch Linked Data",
    description:
      "The app sends only an access token to Flex. Flex looks up the stored link ID from UDP, then uses it to query the DVLA remote data source — the app never sees the link ID.",
    steps: [
      { label: "App sends access token", detail: "The app makes a standard API call with a bearer token. No link ID needed." },
      { label: "Flex routes to Service Gateway", detail: "Public → Private → Service Gateway. The DVLA connector handles the rest." },
      { label: "Service Gateway resolves link", detail: "Service GW queries UDP to retrieve the stored link ID for this user." },
      { label: "DVLA returns driving data", detail: "Service GW calls DVLA with the link ID and returns the driving licence data to the app." },
    ],
    firstStep: "fetch_app",
    animSteps: [
      { step: "fetch_app",     delay: 0 },
      { step: "fetch_public",  delay: 500 },
      { step: "fetch_private", delay: 1000 },
      { step: "fetch_service", delay: 1500 },
      { step: "fetch_data",    delay: 2100 },
      { step: "fetch_done",    delay: 2900 },
    ],
    doneStep: "fetch_done",
    accent: "yellow",
    btnClass: "bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200",
  },
];

export default function LinkingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<LinkStep>("idle");
  const [playing, setPlaying] = useState(false);
  const [completedPhase, setCompletedPhase] = useState<0 | 1 | 2>(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const playPhase = (phaseIndex: 0 | 1) => {
    if (playing) return;
    clearTimers();
    setPlaying(true);
    const phase = PHASES[phaseIndex];

    for (const { step, delay } of phase.animSteps) {
      timers.current.push(setTimeout(() => setActiveStep(step), delay));
    }

    const totalDuration = Math.max(...phase.animSteps.map((s) => s.delay)) + 400;
    timers.current.push(
      setTimeout(() => {
        setPlaying(false);
        setCompletedPhase((phaseIndex + 1) as 1 | 2);
      }, totalDuration),
    );
  };

  const reset = () => {
    clearTimers();
    setActiveStep("idle");
    setPlaying(false);
    setCompletedPhase(0);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 w-full max-w-4xl">

        {/* Diagram */}
        <div className="w-full lg:w-[380px] lg:pt-12 flex-shrink-0">
          <LinkingDiagram activeStep={activeStep} />

          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Why linking?
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              The app never holds sensitive DVLA credentials. Flex brokers the relationship — the citizen links once, and Flex resolves the identifier on every subsequent request.
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
          <div className="bg-slate-800 px-6 py-5">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">
              GOVUK.app — Flex
            </p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Link ID Journey</h1>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[580px] px-5 py-5 space-y-4">

            {PHASES.map((phase, i) => {
              const isDone = completedPhase > i;
              const isNext = completedPhase === i;
              const isFuture = completedPhase < i;

              return (
                <div
                  key={phase.phase}
                  className={`rounded-2xl border-2 p-4 transition-all duration-300 ${
                    isDone
                      ? "border-green-200 bg-green-50"
                      : isNext
                      ? "border-slate-200 bg-white"
                      : "border-slate-100 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      isDone
                        ? "bg-green-500 text-white"
                        : isNext
                        ? "bg-slate-800 text-white"
                        : "bg-slate-200 text-slate-400"
                    }`}>
                      {isDone ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L5 9 2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                        </svg>
                      ) : phase.phase}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isDone ? "text-green-700" : "text-slate-700"}`}>
                        {phase.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {phase.description}
                      </p>
                    </div>
                  </div>

                  {!isDone && (
                    <ol className="space-y-1.5 mb-3">
                      {phase.steps.map((s, si) => (
                        <li key={si} className="flex gap-2 items-start">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[9px] flex items-center justify-center font-semibold mt-0.5">
                            {si + 1}
                          </span>
                          <div>
                            <p className="text-xs font-medium text-slate-600">{s.label}</p>
                            <p className="text-[11px] text-slate-400 leading-snug">{s.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {isNext && (
                    <button
                      onClick={() => playPhase(i as 0 | 1)}
                      disabled={playing || isFuture}
                      className={`w-full text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm disabled:opacity-50 ${phase.btnClass}`}
                    >
                      {playing ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Animating…</span>
                        </>
                      ) : (
                        `Play Phase ${phase.phase}`
                      )}
                    </button>
                  )}
                </div>
              );
            })}

            {completedPhase === 2 && (
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 text-center">
                <p className="text-sm font-semibold text-blue-700 mb-0.5">Journey complete</p>
                <p className="text-xs text-blue-500 mb-3">
                  The app retrieved DVLA data without ever holding credentials or a raw link ID.
                </p>
                <button
                  onClick={reset}
                  className="text-xs font-semibold text-blue-600 underline underline-offset-2"
                >
                  Replay from start
                </button>
              </div>
            )}

            <button
              onClick={() => router.push("/services")}
              className="w-full text-slate-500 text-xs font-medium py-2 text-center"
            >
              ← Back to services
            </button>

            <div className="h-2" />
          </div>
        </div>
      </div>
    </main>
  );
}
