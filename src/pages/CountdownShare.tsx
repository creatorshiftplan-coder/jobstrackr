import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Share2, Timer, Rocket, CalendarClock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { CountdownCard } from "@/components/CountdownCard";
import { ShareCountdownDialog } from "@/components/ShareCountdownDialog";
import { useExamUpdateById } from "@/hooks/useExamUpdates";
import { examUpdateToCountdownItems } from "@/hooks/useCountdownExams";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CountdownShare() {
  const { slug } = useParams<{ slug: string }>();
  const { data: update, isLoading } = useExamUpdateById(slug);
  const [shareOpen, setShareOpen] = useState(false);

  const item = useMemo(
    () => (update ? examUpdateToCountdownItems(update)[0] ?? null : null),
    [update]
  );

  useEffect(() => {
    if (item) {
      document.title = `${item.daysLeft} days to ${item.title} · JobsTrackr`;
    } else if (update) {
      document.title = `${update.title} · JobsTrackr`;
    }
  }, [item, update]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 flex flex-col pb-24">
      <AppHeader title="Exam Countdown" variant="primary" showBack showMenu={false} showTitleLogo />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        )}

        {!isLoading && !item && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">
              {update ? "This exam date has passed" : "Countdown not found"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {update
                ? "But there are plenty of upcoming exams to track."
                : "The link may be outdated. Browse all live countdowns instead."}
            </p>
            <Button asChild className="mt-5">
              <Link to="/countdown">
                <Timer className="mr-2 h-4 w-4" />
                See all countdowns
              </Link>
            </Button>
          </div>
        )}

        {!isLoading && item && (
          <div className="space-y-5">
            <CountdownCard item={item} index={0} hero />

            <Button size="lg" className="w-full" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share this countdown
            </Button>

            {/* Conversion CTA for people landing from a shared link */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
              <Rocket className="mx-auto mb-2 h-7 w-7 text-primary" />
              <h2 className="font-bold text-foreground">Never miss an exam date again</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Bookmark exams, get admit-card & result alerts, and track every deadline in one place — free on JobsTrackr.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link to="/countdown">Explore all countdowns</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/auth">Create free account</Link>
                </Button>
              </div>
            </div>

            <ShareCountdownDialog item={item} open={shareOpen} onOpenChange={setShareOpen} />
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
