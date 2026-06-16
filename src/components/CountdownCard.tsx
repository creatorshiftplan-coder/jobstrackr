import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Flame, Clock, Bookmark, Share2, Maximize2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CountdownItem } from "@/hooks/useCountdownExams";
import { useLiveCountdown, urgencyFor, pad, fullscreenCountdownUrl, type Urgency } from "@/lib/countdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { useSavedExamUpdateIds, useToggleSavedExamUpdate } from "@/hooks/useSavedExamUpdates";
import { useSavedJobs, useSaveJob, useUnsaveJob } from "@/hooks/useSavedJobs";
import { ShareCountdownDialog } from "@/components/ShareCountdownDialog";
import { FullscreenCountdown } from "@/components/FullscreenCountdown";

interface CountdownCardProps {
  item: CountdownItem;
  index: number;
  /** Larger "hero" treatment for the single most-urgent card */
  hero?: boolean;
}

// Theme tokens per urgency — gradients reuse the app's category-accent style.
const URGENCY_THEME: Record<
  Urgency,
  { gradient: string; ring: string; chip: string; glow: string; glowHover: string; accent: string; bar: string }
> = {
  critical: {
    gradient: "from-rose-500/20 via-red-500/10 to-transparent",
    ring: "ring-1 ring-rose-500/40",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    glow: "shadow-[0_8px_30px_-12px_rgba(244,63,94,0.5)]",
    glowHover: "hover:shadow-[0_18px_50px_-12px_rgba(244,63,94,0.6)]",
    accent: "text-rose-600 dark:text-rose-400",
    bar: "from-rose-500 to-red-500",
  },
  soon: {
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    ring: "ring-1 ring-amber-500/30",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    glow: "shadow-[0_8px_30px_-12px_rgba(245,158,11,0.45)]",
    glowHover: "hover:shadow-[0_18px_50px_-12px_rgba(245,158,11,0.55)]",
    accent: "text-amber-600 dark:text-amber-400",
    bar: "from-amber-500 to-orange-500",
  },
  calm: {
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    ring: "ring-1 ring-violet-500/25",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    glow: "shadow-[0_8px_30px_-12px_rgba(139,92,246,0.4)]",
    glowHover: "hover:shadow-[0_18px_50px_-12px_rgba(139,92,246,0.5)]",
    accent: "text-violet-600 dark:text-violet-400",
    bar: "from-violet-500 to-fuchsia-500",
  },
};

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
          "relative overflow-hidden tabular-nums font-display font-bold leading-none rounded-xl",
          "bg-gradient-to-b from-background/80 to-background/50 dark:from-white/[0.08] dark:to-white/[0.02]",
          "backdrop-blur-sm border border-border/50 ring-1 ring-inset ring-white/5",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
          accent,
          big ? "text-3xl sm:text-4xl px-2.5 py-2 min-w-[3rem]" : "text-lg sm:text-xl px-2 py-1.5 min-w-[2.25rem]"
        )}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
        <span className="relative">{value}</span>
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
  const to = item.href;
  const isMobile = useIsMobile();

  const { user } = useAuth();
  const { showAuthRequired } = useAuthRequired();
  const [shareOpen, setShareOpen] = useState(false);
  const [fsOpen, setFsOpen] = useState(false);

  // Bookmarking routes to the right table by source type: jobs → saved_jobs,
  // exam_updates → saved_exam_updates. Both hooks run (rules of hooks); we read
  // whichever applies to this card.
  const examSavedIds = useSavedExamUpdateIds();
  const toggleExamSaved = useToggleSavedExamUpdate();
  const { data: savedJobs } = useSavedJobs();
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();

  const isJob = item.sourceType === "job";
  const isSaved = isJob
    ? savedJobs?.some((j) => j.job_id === item.sourceId) ?? false
    : examSavedIds.has(item.sourceId);

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      showAuthRequired("Login to bookmark exams and build your countdown wall");
      return;
    }
    if (isJob) {
      if (isSaved) unsaveJob.mutate(item.sourceId);
      else saveJob.mutate(item.sourceId);
    } else {
      toggleExamSaved.mutate({ updateId: item.sourceId, save: !isSaved });
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };

  // Mobile → immersive in-app overlay (best-effort native fullscreen).
  // Desktop → open the standalone fullscreen view in a new tab.
  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) {
      setFsOpen(true);
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      window.open(fullscreenCountdownUrl(item), "_blank", "noopener,noreferrer");
    }
  };

  const handleCloseFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    setFsOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
    >
      <Link to={to} className="block group" aria-label={`${item.title} — exam in ${item.daysLeft} days`}>
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1",
            theme.ring,
            theme.glow,
            theme.glowHover,
            hero ? "p-5 sm:p-6" : "p-4"
          )}
        >
          {/* Top accent bar */}
          <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-70", theme.bar)} />
          {/* Urgency gradient wash */}
          <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", theme.gradient)} />
          {/* Corner sheen that brightens on hover */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/5 blur-2xl transition-opacity duration-300 group-hover:opacity-80 opacity-40" />

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
                  {item.title}
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
                  onClick={handleExpand}
                  aria-label={isMobile ? "Open fullscreen countdown" : "Open fullscreen countdown in new tab"}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                >
                  {isMobile ? <Maximize2 className="h-5 w-5" /> : <ExternalLink className="h-5 w-5" />}
                </button>
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

      {/* Immersive mobile overlay — portaled to body so `fixed` escapes the
          transformed motion ancestor and truly covers the viewport. */}
      {fsOpen &&
        createPortal(
          <FullscreenCountdown
            title={item.title}
            eventLabel={item.eventLabel}
            examDate={item.examDate}
            href={item.href}
            onClose={handleCloseFs}
          />,
          document.body
        )}
    </motion.div>
  );
}
