import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Clock,
  Download,
  FileText,
  GraduationCap,
  ListChecks,
  Sparkles,
  Trophy,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { CalendarEventSheet } from "@/components/CalendarEventSheet";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarEvent, CalendarEventType, EVENT_TYPE_CONFIG, dateKey } from "@/lib/calendarEvents";
import { downloadICS } from "@/lib/calendarExport";
import { cn } from "@/lib/utils";
import logoColor from "@/assets/logo-color.png";
import logoWhite from "@/assets/logo-white.png";

type FilterKey = CalendarEventType | "all";

const FILTER_CONFIG: { key: FilterKey; label: string; icon: typeof CalendarDays }[] = [
  { key: "all", label: "All", icon: CalendarDays },
  { key: "apply_end", label: "Deadlines", icon: Clock },
  { key: "exam_date", label: "Exams", icon: BookOpen },
  { key: "admit_card", label: "Admit Cards", icon: FileText },
  { key: "result", label: "Results", icon: Trophy },
];

function formatDate(date: Date, options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("en-IN", options ?? { day: "numeric", month: "short", year: "numeric" });
}

function urgencyLabel(event: CalendarEvent) {
  if (event.isPast) return "Passed";
  if (event.daysLeft === 0) return "Today";
  if (event.daysLeft === 1) return "Tomorrow";
  return `${event.daysLeft} days left`;
}

function EventRow({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
}) {
  const config = EVENT_TYPE_CONFIG[event.type];
  const isUrgent = !event.isPast && event.daysLeft !== null && event.daysLeft <= 3;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border border-border/80 bg-card pl-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card active:scale-[0.99]",
        compact ? "p-3 pl-4" : "p-3.5 pl-4"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", config.dotClass)} />
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-secondary/60">
          <span className="text-[10px] font-bold uppercase leading-none text-primary">
            {formatDate(event.date, { month: "short" })}
          </span>
          <span className="mt-1 text-lg font-bold leading-none text-foreground">
            {formatDate(event.date, { day: "numeric" })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex min-w-0 items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", config.dotClass)} />
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", config.badgeClass)}>
              {config.label}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {event.org || "JobsTrackr"} • {formatDate(event.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        <div
          className={cn(
            "hidden shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold sm:block",
            event.isPast
              ? "bg-muted text-muted-foreground"
              : isUrgent
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-primary/10 text-primary"
          )}
        >
          {urgencyLabel(event)}
        </div>
      </div>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: typeof CalendarDays;
  tone?: "primary" | "warning" | "success";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  filter,
  counts,
  onChange,
}: {
  filter: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (filter: FilterKey) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide md:mx-0 md:rounded-2xl md:border md:border-border/70 md:bg-card/80 md:p-2 md:shadow-sm">
      {FILTER_CONFIG.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all md:flex-1 md:justify-center",
            filter === key
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground md:bg-transparent"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px]",
              filter === key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
            )}
          >
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  );
}

function AgendaList({
  upcoming,
  onEventClick,
}: {
  upcoming: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const grouped = useMemo(() => {
    const groups: { label: string; events: CalendarEvent[] }[] = [];
    for (const event of upcoming) {
      const label = formatDate(event.date, { month: "long", year: "numeric" });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [upcoming]);

  if (upcoming.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-10 text-center">
        <ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No upcoming dates for this filter</p>
        <p className="mt-1 text-xs text-muted-foreground">Try another event type or track more exams.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.label} className="relative space-y-3 pl-4">
          <div className="absolute bottom-1 left-1.5 top-7 w-px bg-border" />
          <h3 className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-3 w-3 rounded-full border-2 border-primary bg-background" />
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.events.map((event) => (
              <EventRow key={event.id} event={event} onClick={() => onEventClick(event)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExamCalendar() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const { allEvents, upcoming, byDate, isLoading, totalUpcoming } = useCalendarEvents({ filter });

  const eventDates = useMemo(
    () => [...byDate.values()].flat().map((e) => e.date),
    [byDate]
  );
  const selectedDayEvents = byDate.get(dateKey(selectedDate)) ?? [];
  const nextEvent = upcoming[0] ?? null;
  const urgentCount = upcoming.filter((event) => event.daysLeft !== null && event.daysLeft <= 7).length;

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = {
      all: allEvents.length,
      apply_start: 0,
      apply_end: 0,
      exam_date: 0,
      admit_card: 0,
      result: 0,
      answer_key: 0,
    };
    for (const event of allEvents) result[event.type] += 1;
    return result;
  }, [allEvents]);

  const handleExportAll = () => downloadICS(upcoming);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(204_100%_99%),_hsl(205_85%_96%)_55%,_hsl(206_70%_94%)_100%)] pb-24 dark:bg-[radial-gradient(circle_at_top,_hsl(224_55%_18%),_hsl(222_50%_14%)_55%,_hsl(220_45%_10%)_100%)] md:pb-10">
      <header className="sticky top-0 z-40 border-b border-primary-foreground/10 bg-primary backdrop-blur-xl dark:border-border dark:bg-card md:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link to="/more" className="flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-primary-foreground/10 dark:hover:bg-secondary/80">
              <MenuBarsIcon className="h-5 w-5 text-primary-foreground dark:text-primary" />
            </div>
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 font-display text-lg font-bold text-primary-foreground dark:text-foreground">
            <img src={logoColor} alt="JobsTrackr" className="h-7 w-7 object-contain dark:hidden" />
            <img src={logoWhite} alt="JobsTrackr" className="hidden h-7 w-7 object-contain dark:block" />
            <span className="truncate">Exam Calendar</span>
          </h1>
          <button
            onClick={handleExportAll}
            disabled={upcoming.length === 0}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-primary-foreground/10 disabled:opacity-40 dark:hover:bg-secondary/80"
            aria-label="Export all upcoming dates"
          >
            <Download className="h-5 w-5 text-primary-foreground dark:text-primary" />
          </button>
        </div>
      </header>

      {/* Mobile summary strip */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3 md:hidden">
        <div className="rounded-2xl border border-border/70 bg-card/85 p-2.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-primary">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Upcoming</p>
          </div>
          <p className="mt-1 text-lg font-bold text-foreground">{totalUpcoming}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/85 p-2.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">7 Days</p>
          </div>
          <p className="mt-1 text-lg font-bold text-foreground">{urgentCount}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/85 p-2.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CalendarClock className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Next</p>
          </div>
          <p className="mt-1 text-sm font-bold text-foreground">
            {nextEvent ? formatDate(nextEvent.date, { day: "numeric", month: "short" }) : "—"}
          </p>
        </div>
      </div>

      <section className="hidden border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.5)_48%,hsl(var(--primary)/0.12)_100%)] md:block">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-start justify-between gap-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                Personalised Schedule
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Exam Calendar</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                Plan application deadlines, exam dates, admit cards, and results from your tracked exams and matched jobs.
              </p>
            </div>
            <Button onClick={handleExportAll} disabled={upcoming.length === 0} className="shrink-0 gap-2">
              <Download className="h-4 w-4" />
              Export All ({totalUpcoming})
            </Button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <SummaryCard label="Upcoming" value={totalUpcoming} icon={CalendarCheck2} />
            <SummaryCard label="Next 7 Days" value={urgentCount} icon={AlertCircle} tone="warning" />
            <SummaryCard
              label="Next Date"
              value={nextEvent ? formatDate(nextEvent.date, { day: "numeric", month: "short" }) : "None"}
              icon={CalendarClock}
              tone="success"
            />
          </div>
        </div>
      </section>

      <main className="px-4 py-3 md:mx-auto md:max-w-6xl md:px-6 md:py-6 lg:px-8">
        <FilterBar filter={filter} counts={counts} onChange={setFilter} />

        {isLoading ? (
          <div className="grid gap-4 pt-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
            <Skeleton className="h-[420px] w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </div>
        ) : allEvents.length === 0 ? (
          <div className="mx-auto max-w-md px-4 py-14 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
              <CalendarDays className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">No dates yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Track exams and complete your job preferences to build a personalised exam schedule.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link to="/tracker">
                <Button className="gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Track an Exam
                </Button>
              </Link>
              <Link to="/search">
                <Button variant="outline">Explore Jobs</Button>
              </Link>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="calendar" className="pt-1">
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <TabsList className="grid w-full max-w-sm grid-cols-2 rounded-xl bg-card/80 p-1 shadow-sm">
                <TabsTrigger value="calendar" className="gap-2 rounded-lg">
                  <CalendarDays className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-2 rounded-lg">
                  <ListChecks className="h-4 w-4" />
                  Agenda
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="calendar" className="mt-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
                <section className="rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm sm:p-5">
                  <div className="mb-2 flex items-start justify-between gap-4 px-1 sm:mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-foreground sm:text-lg">Monthly View</h2>
                      <p className="mt-1 hidden text-sm text-muted-foreground sm:block">Select a marked date to review related events.</p>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Event day
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-1.5 py-2 sm:px-4 sm:py-3">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onDayClick={(day) => setSelectedDate(day)}
                      modifiers={{ hasEvent: eventDates }}
                      modifiersClassNames={{ hasEvent: "has-event" }}
                      className="calendar-dashboard w-full p-0"
                      classNames={{
                        months: "flex w-full flex-col",
                        month: "w-full space-y-2 sm:space-y-4",
                        table: "w-full border-collapse",
                        head_row: "grid grid-cols-7 w-full",
                        row: "grid grid-cols-7 w-full mt-1 sm:mt-2",
                        head_cell: "text-muted-foreground rounded-md text-center font-semibold text-[0.75rem]",
                        cell: "relative flex items-center justify-center p-0 text-center text-sm focus-within:relative focus-within:z-20",
                        day: "mx-auto flex aspect-square w-full max-w-[2rem] items-center justify-center rounded-xl p-0 text-sm font-medium transition-colors hover:bg-secondary aria-selected:opacity-100 sm:max-w-[2.75rem]",
                        day_today: "bg-secondary text-foreground",
                        day_selected:
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 px-1 pt-3 sm:mt-4 sm:gap-x-4 sm:gap-y-2 sm:pt-4">
                    {(["apply_start", "apply_end", "exam_date", "admit_card", "result"] as CalendarEventType[]).map((type) => (
                      <div key={type} className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", EVENT_TYPE_CONFIG[type].dotClass)} />
                        <span className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">{EVENT_TYPE_CONFIG[type].label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected Date</p>
                        <h2 className="mt-1 text-lg font-semibold text-foreground">
                          {formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" })}
                        </h2>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CalendarCheck2 className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {selectedDayEvents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center">
                          <p className="text-sm font-medium text-foreground">No events on this date</p>
                          <p className="mt-1 text-xs text-muted-foreground">Choose another marked date from the calendar.</p>
                        </div>
                      ) : (
                        selectedDayEvents.map((event) => (
                          <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} compact />
                        ))
                      )}
                    </div>
                  </div>

                  {nextEvent && (
                    <button
                      onClick={() => setSelectedEvent(nextEvent)}
                      className="w-full rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        <Sparkles className="h-4 w-4" />
                        Next Important Date
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">{nextEvent.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(nextEvent.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} • {urgencyLabel(nextEvent)}
                      </p>
                    </button>
                  )}
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="agenda" className="mt-0">
              <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-sm md:p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Upcoming Agenda</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Sorted by date across your active calendar filter.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportAll} disabled={upcoming.length === 0} className="hidden gap-2 sm:inline-flex">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
                <AgendaList upcoming={upcoming} onEventClick={setSelectedEvent} />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <CalendarEventSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <BottomNav />
    </div>
  );
}
