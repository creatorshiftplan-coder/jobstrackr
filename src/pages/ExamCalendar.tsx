import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  BookOpen,
  FileText,
  Trophy,
  Download,
  GraduationCap,
  User,
  Plus,
  Bookmark,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { CalendarEventSheet } from "@/components/CalendarEventSheet";
import { ExamDatesEditSheet } from "@/components/ExamDatesEditSheet";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useExams, ExamAttempt } from "@/hooks/useExams";
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

function EventRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const config = EVENT_TYPE_CONFIG[event.type];
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dotClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {event.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {event.org ? ` • ${event.org}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badgeClass}`}>
          {config.label}
        </span>
        {!event.isPast && event.daysLeft !== null && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {event.daysLeft === 0 ? "Today" : `${event.daysLeft}d left`}
          </span>
        )}
      </div>
    </button>
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
      const label = event.date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [upcoming]);

  if (upcoming.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No upcoming dates for this filter
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h3>
          {group.events.map((event) => (
            <EventRow key={event.id} event={event} onClick={() => onEventClick(event)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ExamCalendar() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editAttempt, setEditAttempt] = useState<ExamAttempt | null>(null);
  const [showExamPicker, setShowExamPicker] = useState(false);

  const { allEvents, upcoming, byDate, isLoading, totalUpcoming } = useCalendarEvents({ filter });
  const { userExams } = useExams({ includeExamCatalog: false });

  // Open edit sheet for a specific exam attempt (by sourceId)
  const handleEditDates = useCallback(
    (sourceId: string) => {
      const attempt = userExams.find((a) => a.id === sourceId);
      if (attempt) {
        setEditAttempt(attempt);
      }
    },
    [userExams]
  );

  // FAB handler
  const handleFabClick = useCallback(() => {
    if (userExams.length === 0) {
      toast.info("Track an exam in My Exams first to set your personal dates");
      return;
    }
    if (userExams.length === 1) {
      setEditAttempt(userExams[0]);
    } else {
      setShowExamPicker(true);
    }
  }, [userExams]);

  const eventDates = useMemo(
    () => [...byDate.values()].flat().map((e) => e.date),
    [byDate]
  );
  const selectedDayEvents = useMemo(
    () => byDate.get(dateKey(selectedDate)) ?? [],
    [byDate, selectedDate]
  );

  const handleExportAll = () => {
    try {
      downloadICS(upcoming);
      toast.success(`Exported ${upcoming.length} date${upcoming.length === 1 ? "" : "s"} to calendar file`);
    } catch {
      toast.error("Could not export calendar. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(204_100%_99%),_hsl(205_85%_96%)_55%,_hsl(206_70%_94%)_100%)] dark:bg-[radial-gradient(circle_at_top,_hsl(224_55%_18%),_hsl(222_50%_14%)_55%,_hsl(220_45%_10%)_100%)] pb-24 md:pb-10">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 bg-primary dark:bg-card dark:border-b dark:border-border backdrop-blur-xl border-b border-primary-foreground/10 md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 h-14">
          <Link to="/more" className="flex-shrink-0">
            <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
              <MenuBarsIcon className="h-5 w-5 text-primary-foreground dark:text-primary" />
            </div>
          </Link>
          <h1 className="font-display font-bold text-lg text-primary-foreground dark:text-foreground flex items-center gap-2 min-w-0">
            <img src={logoColor} alt="JobsTrackr" className="h-7 w-7 object-contain dark:hidden" />
            <img src={logoWhite} alt="JobsTrackr" className="h-7 w-7 object-contain hidden dark:block" />
            <span className="truncate">Exam Calendar</span>
          </h1>
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={handleExportAll}
              disabled={upcoming.length === 0}
              className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors disabled:opacity-40"
              aria-label="Export all upcoming dates"
            >
              <Download className="h-5 w-5 text-primary-foreground dark:text-primary" />
            </button>
            <Link to="/profile" aria-label="Profile">
              <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
                <User className="h-5 w-5 text-primary-foreground dark:text-primary" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop hero */}
      <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.5)_48%,hsl(var(--primary)/0.12)_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-start justify-between gap-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                Personalised Schedule
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Exam Calendar</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                All your application deadlines, exam dates, admit cards, and results in one place — built
                from your tracked exams and profile-matched jobs.
              </p>
            </div>
            <Button onClick={handleExportAll} disabled={upcoming.length === 0} className="gap-2 shrink-0">
              <Download className="h-4 w-4" />
              Export All ({totalUpcoming})
            </Button>
          </div>
        </div>
      </section>

      <main className="px-4 py-4 md:mx-auto md:max-w-3xl md:px-6 lg:px-8">
        {/* Filter bar */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {FILTER_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === key
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4 pt-2">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : allEvents.length === 0 ? (
          <div className="text-center py-12 space-y-5 px-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto">
              <CalendarDays className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                {userExams.length > 0 ? "No dates set yet" : "Nothing to show yet"}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                {userExams.length > 0
                  ? `You're tracking ${userExams.length} exam${
                      userExams.length === 1 ? "" : "s"
                    }, but no dates are available yet. Add one to start filling your calendar.`
                  : "Add an exam from My Exams or Saved Jobs, or tap the + button below to set your own dates."}
              </p>
            </div>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Link to="/tracker" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Add via My Exams
                </Button>
              </Link>
              <Link to="/saved" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Bookmark className="h-4 w-4" />
                  Add via Saved Jobs
                </Button>
              </Link>
              <Button className="w-full justify-start gap-2" onClick={handleFabClick}>
                <Plus className="h-4 w-4" />
                Set dates with the + button
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="calendar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <div className="rounded-2xl border border-border bg-card shadow-sm flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onDayClick={(day) => setSelectedDate(day)}
                  modifiers={{ hasEvent: eventDates }}
                  modifiersClassNames={{ hasEvent: "has-event" }}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </h3>
                {selectedDayEvents.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No events on this date
                  </p>
                ) : (
                  selectedDayEvents.map((event) => (
                    <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
                  ))
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Upcoming Dates
                  </h3>
                  {upcoming.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {upcoming.length} total
                    </span>
                  )}
                </div>
                {upcoming.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No upcoming dates for this filter
                  </p>
                ) : (
                  <AgendaList upcoming={upcoming} onEventClick={setSelectedEvent} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="agenda">
              <AgendaList upcoming={upcoming} onEventClick={setSelectedEvent} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <CalendarEventSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEditDates={handleEditDates}
      />

      {/* FAB — Set My Dates */}
      <button
        onClick={handleFabClick}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Set my dates"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Exam picker sheet (when user has >1 tracked exams) */}
      <Sheet open={showExamPicker} onOpenChange={setShowExamPicker}>
        <SheetContent side="bottom" className="rounded-t-2xl mx-auto max-w-lg max-h-[60vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Select an Exam</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 mt-3 pb-2">
            {userExams.map((attempt) => {
              const name = attempt.exams?.name ?? "Exam";
              const hasCustom = attempt.custom_dates && Object.values(attempt.custom_dates).some(Boolean);
              return (
                <button
                  key={attempt.id}
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
                  onClick={() => {
                    setShowExamPicker(false);
                    setEditAttempt(attempt);
                  }}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{attempt.year}</p>
                  </div>
                  {hasCustom && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                      Dates set
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit dates sheet */}
      <ExamDatesEditSheet
        attempt={editAttempt}
        open={!!editAttempt}
        onOpenChange={(open) => !open && setEditAttempt(null)}
      />

      <BottomNav />
    </div>
  );
}
