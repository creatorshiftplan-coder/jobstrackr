import { Link } from "react-router-dom";
import { CalendarPlus, Clock, Download, ExternalLink, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CalendarEvent, EVENT_TYPE_CONFIG } from "@/lib/calendarEvents";
import { downloadICS, generateGoogleCalendarUrl } from "@/lib/calendarExport";
import { cn } from "@/lib/utils";

interface CalendarEventSheetProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

function formatDate(date: Date, options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("en-IN", options ?? { day: "numeric", month: "short", year: "numeric" });
}

function statusText(event: CalendarEvent) {
  if (event.isPast) return "Passed";
  if (event.daysLeft === 0) return "Today";
  if (event.daysLeft === 1) return "Tomorrow";
  return `${event.daysLeft} days left`;
}

export function CalendarEventSheet({ event, onClose }: CalendarEventSheetProps) {
  if (!event) return null;
  const config = EVENT_TYPE_CONFIG[event.type];

  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-3xl border-border bg-card p-0">
        <div className="border-b border-border/70 bg-[linear-gradient(135deg,hsl(var(--secondary)/0.75),hsl(var(--card)))] px-5 py-5">
          <SheetHeader className="text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", config.badgeClass)}>
                {config.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Clock className="h-3 w-3" />
                {statusText(event)}
              </span>
            </div>
            <SheetTitle className="pt-2 text-xl leading-snug text-foreground">{event.title}</SheetTitle>
          </SheetHeader>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
            <div className="flex h-[72px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary/60">
              <span className="text-xs font-bold uppercase text-primary">
                {formatDate(event.date, { month: "short" })}
              </span>
              <span className="mt-1 text-2xl font-bold leading-none text-foreground">
                {formatDate(event.date, { day: "numeric" })}
              </span>
            </div>
            <div className="min-w-0 rounded-2xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Scheduled For</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(event.date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {event.org && (
                <p className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{event.org}</span>
                </p>
              )}
            </div>
          </div>

          {event.sourceSlug && (
            <Link to={`/jobs/${event.sourceSlug}`} onClick={onClose}>
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View Job Details
              </Button>
            </Link>
          )}

          <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2">
            <Button
              className="gap-2"
              onClick={() => window.open(generateGoogleCalendarUrl(event), "_blank", "noopener")}
            >
              <CalendarPlus className="h-4 w-4" />
              Google Calendar
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => downloadICS([event])}>
              <Download className="h-4 w-4" />
              Save as .ics
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
