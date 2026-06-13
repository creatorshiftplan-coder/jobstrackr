import { useMemo, useState } from "react";
import { Timer, Search, Flame, X, Bookmark, Compass } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { CountdownCard } from "@/components/CountdownCard";
import { useCountdownExams, CountdownItem } from "@/hooks/useCountdownExams";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { useSavedExamUpdateIds } from "@/hooks/useSavedExamUpdates";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WallView = "discover" | "mine";

export default function CountdownWall() {
  const { items, isLoading, isError, refetch } = useCountdownExams();
  const { user } = useAuth();
  const { showAuthRequired } = useAuthRequired();
  const savedExamIds = useSavedExamUpdateIds();
  const { data: savedJobs } = useSavedJobs();
  const [view, setView] = useState<WallView>("discover");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const savedJobIds = useMemo(
    () => new Set((savedJobs ?? []).map((j) => j.job_id)),
    [savedJobs]
  );

  const isItemSaved = (i: CountdownItem) =>
    i.sourceType === "job" ? savedJobIds.has(i.sourceId) : savedExamIds.has(i.sourceId);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (view === "mine" && !isItemSaved(i)) return false;
      if (!q) return true;
      return (
        i.title?.toLowerCase().includes(q) ||
        i.eventLabel?.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, debouncedSearch, view, savedExamIds, savedJobIds]);

  const handleViewChange = (next: WallView) => {
    if (next === "mine" && !user) {
      showAuthRequired("Login to build your personal countdown wall");
      return;
    }
    setView(next);
  };

  const hero = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 flex flex-col pb-24">
      {/* Mobile header */}
      <div className="md:hidden">
        <AppHeader
          title="Countdown"
          variant="primary"
          showMenu={true}
          showRefresh={true}
          showTitleLogo={true}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Desktop hero band */}
      <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.55)_52%,hsl(var(--primary)/0.12)_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Timer className="h-3.5 w-3.5" />
            Live Exam Countdowns
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
            Every upcoming exam, counting down in real time.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
            Announced exam dates that haven't passed yet — sorted by what's closest. Tap any card for full details.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6">
        {/* View toggle + search */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full border border-border bg-secondary/50 p-1 text-sm font-medium">
            <button
              onClick={() => handleViewChange("discover")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
                view === "discover" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Compass className="h-4 w-4" />
              Discover
            </button>
            <button
              onClick={() => handleViewChange("mine")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
                view === "mine" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bookmark className={cn("h-4 w-4", view === "mine" && "fill-current")} />
              My Wall
            </button>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exams…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load countdowns. Pull to refresh.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              {view === "mine" ? (
                <Bookmark className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Timer className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <p className="font-medium text-foreground">
              {debouncedSearch
                ? "No matching exams"
                : view === "mine"
                ? "Your wall is empty"
                : "No upcoming exam dates yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedSearch
                ? "Try a different search."
                : view === "mine"
                ? "Tap the bookmark on any countdown to pin it here."
                : "Check back soon — new dates are added daily."}
            </p>
            {!debouncedSearch && view === "mine" && (
              <Button variant="outline" className="mt-4" onClick={() => setView("discover")}>
                <Compass className="mr-2 h-4 w-4" />
                Browse exams
              </Button>
            )}
          </div>
        )}

        {/* Wall */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="space-y-4">
            {hero && (
              <div className="grid grid-cols-1">
                <div className="relative">
                  <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Flame className="h-3.5 w-3.5 text-rose-500" />
                    Next up
                  </span>
                  <CountdownCard item={hero} index={0} hero />
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
                {rest.map((item, i) => (
                  <CountdownCard key={item.id} item={item} index={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
