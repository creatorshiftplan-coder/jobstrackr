import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Timer } from "lucide-react";
import { FullscreenCountdown } from "@/components/FullscreenCountdown";

/**
 * Standalone immersive countdown — rendered in its own tab from the desktop
 * "open fullscreen" action. All data rides in the query string (t/e/d), so the
 * page is fully self-contained and needs no app state or refetch.
 */
export default function CountdownLive() {
  const [params] = useSearchParams();
  const title = params.get("t") ?? "";
  const eventLabel = params.get("e") ?? "Exam Date";
  const dateParam = params.get("d");

  const examDate = useMemo(() => {
    if (!dateParam) return null;
    const d = new Date(dateParam);
    return isNaN(d.getTime()) ? null : d;
  }, [dateParam]);

  useEffect(() => {
    if (title) document.title = `${title} · Live Countdown · JobsTrackr`;
  }, [title]);

  if (!title || !examDate) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Timer className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">This countdown link is incomplete or has expired.</p>
        <Link to="/countdown" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          See all live countdowns
        </Link>
      </div>
    );
  }

  return <FullscreenCountdown title={title} eventLabel={eventLabel} examDate={examDate} />;
}
