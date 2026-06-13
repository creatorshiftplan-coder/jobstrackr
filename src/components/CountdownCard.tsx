import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Flame, Clock, Bookmark, Share2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CountdownItem } from "@/hooks/useCountdownExams";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { useSavedExamUpdateIds, useToggleSavedExamUpdate } from "@/hooks/useSavedExamUpdates";
import { ShareCountdownDialog } from "@/components/ShareCountdownDialog";

interface CountdownCardProps {
  item: CountdownItem;
  index: number;
  /** Larger "hero" treatment for the single most-urgent card */
  hero?: boolean;
}

type Urgency = "critical" | "soon" | "calm";

function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "soon";
  return "calm";
}

// Theme tokens per urgency — gradients reuse the app's category-accent style.
const URGENCY_THEME: Record<
  Urgency,
  { gradient: string; ring: string; chip: string; glow: string; accent: string }
> = {
  critical: {
    gradient: "from-rose-500/20 via-red-500/10 to-transparent",
    ring: "ring-1 ring-rose-500/40",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    glow: "shadow-[0_8px_30px_-12px_rgba(244,63,94,0.5)]",
    accent: "text-rose-600 dark:text-rose-400",
  },
  soon: {
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    ring: "ring-1 ring-amber-500/30",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    glow: "shadow-[0_8px_30px_-12px_rgba(245,158,11,0.45)]",
    accent: "text-amber-600 dark:text-amber-400",
  },
  calm: {
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    ring: "ring-1 ring-violet-500/25",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    glow: "shadow-[0_8px_30px_-12px_rgba(139,92,246,0.4)]",
    accent: "text-violet-600 dark:text-violet-400",
  },
};

interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffTo(target: Date): TimeParts {
  const ms = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Ticks once per second; pauses when the tab is hidden to save battery. */
function useLiveCountdown(target: Date): TimeParts {
  const [parts, setParts] = useState<TimeParts>(() => diffTo(target));

  useEffect(() => {
    setParts(diffTo(target));
    let id: number | undefined;
    const start = () => {
      stop();
      id = window.setInterval(() => setParts(diffTo(target)), 1000);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        setParts(diffTo(target));
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [target]);

  return parts;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function TimeBlock({
  value,
  label,
  accent,
  big,
}: {
  value: string;
  label: string;
  accent: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "tabular-nums font-display font-bold leading-none rounded-lg bg-background/70 dark:bg-background/40 backdrop-blur-sm border border-border/50",
          accent,
          big ? "text-3xl sm:text-4xl px-2.5 py-2 min-w-[3rem]" : "text-lg sm:text-xl px-2 py-1.5 min-w-[2.25rem]"
        )}
      >
        {value}
      </div>
      <span className="mt-1 text-[9px] sm:text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function CountdownCard({ item, index, hero = false }: CountdownCardProps) {
  const { days, hours, minutes, seconds } = useLiveCountdown(item.examDate);
  const urgency = urgencyFor(item.daysLeft);
  const theme = URGENCY_THEME[urgency];
  const to = `/exam-update/${item.update.slug || item.update.id}`;

  const { user } = useAuth();
  const { showAuthRequired } = useAuthRequired();
  const savedIds = useSavedExamUpdateIds();
  const toggleSaved = useToggleSavedExamUpdate();
  const isSaved = savedIds.has(item.update.id);
  const [shareOpen, setShareOpen] = useState(false);

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      showAuthRequired("Login to bookmark exams and build your countdown wall");
      return;
    }
    toggleSaved.mutate({ updateId: item.update.id, save: !isSaved });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
    >
      <Link to={to} className="block group" aria-label={`${item.update.title} — exam in ${item.daysLeft} days`}>
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-0.5",
            theme.ring,
            theme.glow,
            hero ? "p-5 sm:p-6" : "p-4"
          )}
        >
          {/* Urgency gradient wash */}
          <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", theme.gradient)} />

          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", theme.chip)}>
                  {urgency === "critical" ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {item.daysLeft === 0 ? "Exam Today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`}
                </span>
                <h3
                  className={cn(
                    "mt-2 font-bold text-foreground leading-tight",
                    hero ? "text-lg sm:text-xl line-clamp-2" : "text-sm line-clamp-2"
                  )}
                >
                  {item.update.title}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {item.eventLabel} · {format(item.examDate, "EEE, d MMM yyyy")}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share countdown"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleBookmark}
                  aria-label={isSaved ? "Remove from My Wall" : "Add to My Wall"}
                  aria-pressed={isSaved}
                  className="rounded-full p-1.5 transition-colors hover:bg-background/70"
                >
                  <Bookmark
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isSaved ? cn("fill-current", theme.accent) : "text-muted-foreground"
                    )}
                  />
                </button>
                <ChevronRight className="hidden h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
              </div>
            </div>

            {/* Live timer */}
            <div className={cn("mt-4 flex items-end gap-1.5 sm:gap-2", hero && "justify-center")}>
              <TimeBlock value={String(days)} label="Days" accent={theme.accent} big={hero} />
              <span className={cn("pb-3 font-bold", theme.accent, hero ? "text-2xl" : "text-base")}>:</span>
              <TimeBlock value={pad(hours)} label="Hrs" accent={theme.accent} big={hero} />
              <span className={cn("pb-3 font-bold", theme.accent, hero ? "text-2xl" : "text-base")}>:</span>
              <TimeBlock value={pad(minutes)} label="Min" accent={theme.accent} big={hero} />
              <span className={cn("pb-3 font-bold", theme.accent, hero ? "text-2xl" : "text-base")}>:</span>
              <TimeBlock value={pad(seconds)} label="Sec" accent={theme.accent} big={hero} />
            </div>
          </div>
        </div>
      </Link>

      <ShareCountdownDialog item={item} open={shareOpen} onOpenChange={setShareOpen} />
    </motion.div>
  );
}
