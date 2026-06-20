import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Flame, Clock, Bookmark, Share2, Maximize2, ExternalLink } from "lucide-react";
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

/**
 * Restrained urgency accents. The card stays on a neutral surface; urgency is
 * conveyed by a single semantic colour applied only to the status spine, the
 * status pill, and the timer numerals — never as a full-surface wash.
 */
const URGENCY_THEME: Record<
  Urgency,
  { spine: string; pill: string; dot: string; num: string; hoverBorder: string }
> = {
  critical: {
    spine: "bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700",
    pill: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200",
    dot: "bg-rose-500",
    num: "text-rose-600 dark:text-rose-400",
    hoverBorder: "group-hover:border-rose-400 dark:group-hover:border-rose-500/50",
  },
  soon: {
    spine: "bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500",
    pill: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200",
    dot: "bg-amber-500",
    num: "text-amber-600 dark:text-amber-400",
    hoverBorder: "group-hover:border-amber-400 dark:group-hover:border-amber-500/50",
  },
  calm: {
    spine: "bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600",
    pill: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-200",
    dot: "bg-sky-500",
    num: "text-sky-600 dark:text-sky-400",
    hoverBorder: "group-hover:border-sky-400 dark:group-hover:border-sky-500/50",
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
          "flex w-full items-center justify-center rounded-xl border border-border/70 bg-muted/40 tabular-nums",
          "font-display font-bold leading-none dark:bg-white/[0.035]",
          accent,
          big ? "h-14 text-[1.75rem] sm:h-16 sm:text-3xl" : "h-11 text-xl"
        )}
      >
        {value}
      </div>
      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
  const actionButtonClass =
    "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";
  const showEventLabel = item.eventLabel.trim().toLowerCase() !== "exam date";

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
      <Link to={to} className="group block" aria-label={`${item.title} - exam in ${item.daysLeft} days`}>
        <div
          className={cn(
            "relative isolate overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300",
            "hover:-translate-y-0.5 hover:shadow-md",
            theme.hoverBorder,
            hero ? "p-5 sm:p-6" : "p-4 sm:p-5"
          )}
        >
          {/* Urgency status spine */}
          <span className={cn("absolute inset-y-0 left-0 w-1.5", theme.spine)} aria-hidden />

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                theme.pill
              )}
            >
              <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                {urgency === "critical" && (
                  <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", theme.dot)} />
                )}
                <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", theme.dot)} />
              </span>
              {urgency === "critical" ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {item.daysLeft === 0 ? "Exam Today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`}
            </span>

            <div className="-mr-1 flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={handleExpand}
                aria-label={isMobile ? "Open fullscreen countdown" : "Open fullscreen countdown in new tab"}
                className={actionButtonClass}
              >
                {isMobile ? <Maximize2 className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              </button>
              <button type="button" onClick={handleShare} aria-label="Share countdown" className={actionButtonClass}>
                <Share2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleBookmark}
                aria-label={isSaved ? "Remove from My Wall" : "Add to My Wall"}
                aria-pressed={isSaved}
                className={actionButtonClass}
              >
                <Bookmark className={cn("h-4 w-4 transition-colors", isSaved && cn("fill-current", theme.num))} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h3
            className={cn(
              "mt-3 break-words font-display font-bold leading-snug tracking-tight text-foreground line-clamp-2",
              hero ? "text-xl" : "text-base"
            )}
          >
            {item.title}
          </h3>

          {/* Date */}
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {showEventLabel && (
              <>
                <span>{item.eventLabel}</span>
                <span className="text-border">·</span>
              </>
            )}
            <span className="font-medium text-foreground">{format(item.examDate, "EEE, d MMM yyyy")}</span>
          </div>

          {/* Live timer */}
          <div className={cn("grid grid-cols-4 gap-2 sm:gap-2.5", hero ? "mt-5" : "mt-4")}>
            <TimeBlock value={String(days)} label="Days" accent={theme.num} big={hero} />
            <TimeBlock value={pad(hours)} label="Hrs" accent={theme.num} big={hero} />
            <TimeBlock value={pad(minutes)} label="Min" accent={theme.num} big={hero} />
            <TimeBlock value={pad(seconds)} label="Sec" accent={theme.num} big={hero} />
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
