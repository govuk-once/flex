"use client";

interface Props {
  minimized: boolean;
  onToggle: () => void;
  label?: string;
}

export default function MacButton({ minimized, onToggle, label }: Props) {
  return (
    <button
      onClick={onToggle}
      title={minimized ? `Expand${label ? ` ${label}` : ""}` : `Minimise${label ? ` ${label}` : ""}`}
      className="group relative w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center
        bg-[#28c840] hover:bg-[#1aab2c] shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-colors"
    >
      {/* Icon revealed on hover */}
      <svg
        className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity"
        viewBox="0 0 8 8"
        fill="none"
        stroke="#006412"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        {minimized ? (
          /* plus — expand */
          <>
            <line x1="4" y1="1.5" x2="4" y2="6.5" />
            <line x1="1.5" y1="4" x2="6.5" y2="4" />
          </>
        ) : (
          /* minus — minimise */
          <line x1="1.5" y1="4" x2="6.5" y2="4" />
        )}
      </svg>
    </button>
  );
}
