import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Flame, Clock, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLiveCountdown, urgencyFor, pad, type Urgency } from "@/lib/countdown";
import logoColor from "@/assets/logo-color.png";

interface FullscreenCountdownProps {
  title: string;
  eventLabel: string;
  examDate: Date;
  /** Deep link into the in-app detail page, if known. */
  href?: string;
  /** When provided, renders a close button (overlay mode on mobile). */
  onClose?: () => void;
}

// Rich, saturated immersive backdrops — far bolder than the card washes.
const THEME: Record<
  Urgency,
  { bg: string; orbA: string; orbB: string; accent: string; chip: string; ring: string }
> = {
  critical: {
    bg: "radial-gradient(125% 125% at 50% 0%, #1a0510 0%, #2b0713 45%, #050505 100%)",
    orbA: "bg-rose-500/30",
    orbB: "bg-red-600/25",
    accent: "text-rose-300",
    chip: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30",
    ring: "ring-rose-400/20",
  },
  soon: {
    bg: "radial-gradient(125% 125% at 50% 0%, #1c1203 0%, #2a1a05 45%, #050505 100%)",
    orbA: "bg-amber-400/30",
    orbB: "bg-orange-500/25",
    accent: "text-amber-200",
    chip: "bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/30",
    ring: "ring-amber-300/20",
  },
  calm: {
    bg: "radial-gradient(125% 125% at 50% 0%, #120920 0%, #1d0f33 45%, #050505 100%)",
    orbA: "bg-violet-500/30",
    orbB: "bg-fuchsia-500/25",
    accent: "text-violet-200",
    chip: "bg-violet-500/15 text-violet-100 ring-1 ring-violet-300/30",
    ring: "ring-violet-300/20",
  },
};

function FlipBlock({
  value,
  label,
  accent,
  ring,
}: {
  value: string;
  label: string;
  accent: string;
  ring: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl sm:rounded-3xl",
          "border border-white/10 bg-white/[0.04] backdrop-blur-xl ring-1",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_20px_60px_-25px_rgba(0,0,0,0.9)]",
          "min-w-[4.5rem] px-3 py-4 sm:min-w-[7rem] sm:px-6 sm:py-7 lg:min-w-[9rem] lg:px-8 lg:py-9",
          ring
        )}
      >
        {/* glossy top sheen */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/10 to-transparent sm:rounded-t-3xl" />
        <span
          className={cn(
            "tabular-nums font-display font-black leading-none tracking-tight",
            "text-4xl sm:text-6xl lg:text-7xl text-white",
            accent
          )}
        >
          {value}
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45 sm:text-xs">
        {label}
      </span>
    </div>
  );
}

export function FullscreenCountdown({
  title,
  eventLabel,
  examDate,
  href,
  onClose,
}: FullscreenCountdownProps) {
  const { days, hours, minutes, seconds } = useLiveCountdown(examDate);
  const urgency = urgencyFor(days);
  const theme = THEME[urgency];

  // Lock body scroll while the immersive view is mounted (overlay mode).
  useEffect(() => {
    if (!onClose) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Esc to close in overlay mode.
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isToday = days === 0;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-white",
        onClose ? "fixed inset-0 z-[100]" : "min-h-[100dvh] w-full"
      )}
      style={{ background: theme.bg }}
    >
      {/* Animated ambient orbs */}
      <motion.div
        aria-hidden
        className={cn("pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full blur-3xl", theme.orbA)}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.85, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className={cn("pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl", theme.orbB)}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Fine grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Close (overlay mode only) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit fullscreen"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-full border border-white/15 bg-white/10 p-2.5 text-white/80 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Brand */}
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex items-center gap-2">
        <img src={logoColor} alt="" className="h-7 w-7 rounded-lg bg-white/90 p-1" />
        <span className="text-sm font-bold tracking-tight text-white/80">JobsTrackr</span>
      </div>

      {/* Center content */}
      <motion.div
        className="relative z-[1] flex w-full max-w-4xl flex-col items-center px-6 text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span
          className={cn(
            "mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm",
            theme.chip
          )}
        >
          {urgency === "critical" ? <Flame className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {isToday ? "Exam is today" : days === 1 ? "1 day to go" : `${days} days to go`}
        </span>

        {/* Timer */}
        <div className="flex items-start justify-center gap-2 sm:gap-4 lg:gap-6">
          <FlipBlock value={String(days)} label="Days" accent={theme.accent} ring={theme.ring} />
          <span className={cn("pt-5 text-3xl font-black opacity-40 sm:pt-9 sm:text-5xl lg:pt-12 lg:text-6xl", theme.accent)}>:</span>
          <FlipBlock value={pad(hours)} label="Hours" accent={theme.accent} ring={theme.ring} />
          <span className={cn("pt-5 text-3xl font-black opacity-40 sm:pt-9 sm:text-5xl lg:pt-12 lg:text-6xl", theme.accent)}>:</span>
          <FlipBlock value={pad(minutes)} label="Minutes" accent={theme.accent} ring={theme.ring} />
          <span className={cn("pt-5 text-3xl font-black opacity-40 sm:pt-9 sm:text-5xl lg:pt-12 lg:text-6xl", theme.accent)}>:</span>
          <FlipBlock value={pad(seconds)} label="Seconds" accent={theme.accent} ring={theme.ring} />
        </div>

        {/* Title + date */}
        <h1 className="mt-10 max-w-3xl font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/70 backdrop-blur-md sm:text-base">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {eventLabel} · {format(examDate, "EEEE, d MMMM yyyy")}
        </p>

        {href && (
          <a
            href={href}
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            View full details
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </motion.div>
    </div>
  );
}
