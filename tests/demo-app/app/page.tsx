"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ArchitectureDiagram, {
  type DiagramStep,
} from "./components/ArchitectureDiagram";
import ProfileJourneyDiagram, {
  type ProfileStep,
} from "./components/ProfileJourneyDiagram";
import MacButton from "./components/MacButton";

const SHOW_ARCH_DIAGRAM = process.env.NEXT_PUBLIC_SHOW_ARCH_DIAGRAM !== "false";

// User flow step order matches DiagramStep for 'user' variant
// idle → app → public → private → udp → complete

type ConsentStatus = "unknown" | "accepted" | "denied";

interface UserProfile {
  userId: string;
  notificationId: string;
  notifications: {
    consentStatus: ConsentStatus;
    notificationId: string;
  };
}

const CONSENT_STYLES: Record<ConsentStatus, string> = {
  unknown: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
};

function Spinner({ size = "h-4 w-4" }: { size?: string }) {
  return (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ProfileCard({ profile }: { profile: UserProfile }) {
  const status = profile.notifications.consentStatus;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
          {profile.userId.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide">User ID</p>
          <p className="text-sm font-mono text-gray-800 truncate">{profile.userId}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Notification Preferences
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Consent</span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CONSENT_STYLES[status]}`}
          >
            {status}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400">Notification Ref</p>
          <p className="text-xs font-mono text-gray-600 break-all mt-0.5">
            {profile.notifications.notificationId}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  );

  // Token state — auto-generated on mount
  const [token, setToken] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Profile state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [archMinimized, setArchMinimized] = useState(false);

  // Diagram animation state
  const [diagramStep, setDiagramStep] = useState<DiagramStep>("idle");
  const [profileStep, setProfileStep] = useState<ProfileStep>("idle");
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAnimTimers = () => {
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];
  };

  const runAnimation = () => {
    clearAnimTimers();

    // Architecture diagram
    setDiagramStep("app");
    animTimers.current.push(
      setTimeout(() => setDiagramStep("public"),   800),
      setTimeout(() => setDiagramStep("private"), 1600),
      setTimeout(() => setDiagramStep("service"), 2400),
      setTimeout(() => setDiagramStep("udp"),     3200),
    );

    // Profile journey — GET → decision diamond → CREATE (first-call path)
    setProfileStep("get_app");
    animTimers.current.push(
      setTimeout(() => setProfileStep("get_flex"),          800),
      setTimeout(() => setProfileStep("get_udp"),          1600),
      setTimeout(() => setProfileStep("decision"),         2400),
      setTimeout(() => setProfileStep("not_found"),        3400),
      setTimeout(() => setProfileStep("create_identity"),  4200),
      setTimeout(() => setProfileStep("create_data"),      5000),
      setTimeout(() => setProfileStep("create_done"),      6000),
    );
  };

  const finishAnimation = () => {
    clearAnimTimers();
    setDiagramStep("complete");
    animTimers.current.push(
      setTimeout(() => setDiagramStep("idle"),    8000),
      setTimeout(() => setProfileStep("idle"),    8000),
    );
  };

  useEffect(() => () => clearAnimTimers(), []);

  const fetchToken = async () => {
    setTokenLoading(true);
    setTokenError(null);
    setToken(null);
    setProfile(null);
    setProfileError(null);

    try {
      const res = await fetch("/api/token");
      const data = await res.json();
      if (!res.ok) {
        setTokenError(data.error ?? "Failed to generate token");
      } else {
        setToken(data.token);
        setStage(data.stage);
      }
    } catch {
      setTokenError("Network error — could not reach the token API");
    } finally {
      setTokenLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetProfile = async () => {
    if (!token) return;
    setProfileLoading(true);
    setProfileError(null);
    setProfile(null);

    runAnimation();

    // Ensure animation plays through before result lands (must exceed longest profile step: 6000ms)
    const minDelay = new Promise<void>((r) => setTimeout(r, 6400));

    try {
      const [res] = await Promise.all([
        fetch("/api/user-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl, token }),
        }),
        minDelay,
      ]);

      const data = await res.json();

      if (!res.ok) {
        setProfileError(
          `HTTP ${res.status} — ${data?.message ?? data?.error ?? JSON.stringify(data)}`
        );
        clearAnimTimers();
        setDiagramStep("idle");
        setProfileStep("idle");
      } else {
        setProfile(data);
        finishAnimation();
      }
    } catch {
      setProfileError("Network error — could not reach the API");
      clearAnimTimers();
      setDiagramStep("idle");
      setProfileStep("idle");
    } finally {
      setProfileLoading(false);
    }
  };

  const canFetch = !!token && baseUrl.trim().length > 0 && !profileLoading;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
      <div className="flex flex-col xl:flex-row items-center xl:items-start gap-8 w-full max-w-6xl">

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
                <ArchitectureDiagram variant="user" activeStep={diagramStep} />
              </>
            )}
          </div>
        )}

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
            <h1 className="text-white text-2xl font-bold mt-0.5">My Profile</h1>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto max-h-[580px] px-5 py-5 space-y-4">

            {/* Token section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Access Token
                </label>
                {stage && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                    {stage}
                  </span>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl px-4 py-3 bg-slate-50 flex items-center gap-3 min-h-[52px]">
                {tokenLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Spinner />
                    <span>Generating token…</span>
                  </div>
                ) : tokenError ? (
                  <p className="text-xs text-red-500 flex-1">{tokenError}</p>
                ) : token ? (
                  <p className="text-xs font-mono text-slate-600 flex-1 truncate">
                    {token.slice(0, 40)}…
                  </p>
                ) : null}

                <button
                  onClick={fetchToken}
                  disabled={tokenLoading}
                  title="Refresh token"
                  className="flex-shrink-0 text-slate-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 ${tokenLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* CTA button */}
            <button
              onClick={handleGetProfile}
              disabled={!canFetch}
              className="w-full bg-blue-600 disabled:bg-blue-300 text-white rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-150 shadow-md shadow-blue-200"
            >
              {profileLoading ? (
                <>
                  <Spinner />
                  <span>Fetching profile…</span>
                </>
              ) : (
                "Get User Profile"
              )}
            </button>

            {/* Profile error */}
            {profileError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="w-4 h-4 text-red-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7.5a1 1 0 100 2 1 1 0 000-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm font-semibold text-red-700">
                    Request failed
                  </p>
                </div>
                <p className="text-xs text-red-500 ml-6">{profileError}</p>
              </div>
            )}

            {/* Profile result */}
            {profile && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Profile loaded
                  </p>
                </div>
                <ProfileCard profile={profile} />
              </div>
            )}

            {/* View connected services — appears after successful profile load */}
            {profile && (
              <button
                onClick={() => router.push("/services")}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-150 shadow-md shadow-green-200"
              >
                View connected services →
              </button>
            )}

            <div className="h-2" />
          </div>
        </div>

        {/* Right: Profile journey diagram */}
        <div className="w-full xl:w-[380px] xl:pt-12 flex-shrink-0">
          <ProfileJourneyDiagram activeStep={profileStep} />

          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              The pattern
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Flex checks UDP for an existing profile. If none is found, it creates one automatically — the app always gets a profile back with a single call.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
