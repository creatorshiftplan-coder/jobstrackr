import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTrendingExams } from "@/hooks/useTrendingExams";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { TrendingExamCard } from "@/components/TrendingExamCard";
import { ExamUpdateCard } from "@/components/ExamUpdateCard";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp, X, ChevronDown, MapPin, Grid3X3, Clock, Newspaper,
    Search as SearchIcon, LayoutGrid, Bell, Ticket, Trophy, KeyRound,
    BarChart3, BookOpen, RefreshCw, Sparkles, FilterX, SearchX,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getExamStatusType, getBadgeConfig } from "@/lib/examStatus";
import { useAllExamUpdates, useExamUpdateSearch } from "@/hooks/useExamUpdates";
import { searchUpdates, scoreUpdateForQuery, tokenizeQuery } from "@/lib/updateSearch";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useScroll } from "framer-motion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";



// Tab options
const TABS: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "all", label: "All", icon: LayoutGrid },
    { id: "notification", label: "Notifications", icon: Bell },
    { id: "admit_card", label: "Admit Cards", icon: Ticket },
    { id: "result", label: "Results", icon: Trophy },
    { id: "answer_key", label: "Answer Keys", icon: KeyRound },
    { id: "cutoff", label: "Cutoffs", icon: BarChart3 },
    { id: "syllabus", label: "Syllabus", icon: BookOpen },
    { id: "news", label: "News", icon: Newspaper },
];

// Map tab IDs to exam_updates category values for filtering
const TAB_TO_UPDATE_CATEGORY: Record<string, string | undefined> = {
    all: undefined,
    admit_card: "admit_card",
    result: "result",
    answer_key: "answer_key",
    cutoff: "cutoff",
    syllabus: "syllabus",
    news: "news",
};

// Tabs that only show exam_updates (no exam cards)
const UPDATES_ONLY_TABS = new Set(["answer_key", "cutoff", "syllabus", "news"]);

// Exam categories for filtering
const EXAM_CATEGORIES = [
    "Banking", "SSC", "Railways", "Defence", "UPSC", "Teaching", "State PSC"
];

// Location options for filtering (all Indian states)
const EXAM_LOCATIONS = [
    "All India",
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

// State abbreviations for matching
const STATE_ABBREVIATIONS: Record<string, string[]> = {
    "Uttar Pradesh": ["UP", "Uttar Pradesh"],
    "Madhya Pradesh": ["MP", "Madhya Pradesh"],
    "Andhra Pradesh": ["AP", "Andhra Pradesh"],
    "Himachal Pradesh": ["HP", "Himachal Pradesh"],
    "Tamil Nadu": ["TN", "Tamil Nadu"],
    "West Bengal": ["WB", "West Bengal"],
    "Jammu & Kashmir": ["J&K", "JK", "Jammu"],
    "Maharashtra": ["MH", "Maharashtra"],
    "Gujarat": ["GJ", "Gujarat"],
    "Rajasthan": ["RJ", "Rajasthan"],
    "Karnataka": ["KA", "Karnataka"],
};

// Consistent section heading used above every feed group
function SectionHeading({
    icon: Icon,
    title,
    count,
    accent = false,
    hint,
}: {
    icon: LucideIcon;
    title: string;
    count?: number;
    accent?: boolean;
    /** Small trailing note, e.g. the sort order applied to the section. */
    hint?: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span
                className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    accent ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"
                )}
            >
                <Icon className="h-3.5 w-3.5" />
            </span>
            <h2
                className={cn(
                    "text-[13px] font-semibold uppercase tracking-[0.14em]",
                    accent ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}
            >
                {title}
            </h2>
            {typeof count === "number" && (
                <Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                    {count}
                </Badge>
            )}
            {hint && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {hint}
                </span>
            )}
        </div>
    );
}

// Structured skeleton that mirrors the real update card layout
function UpdateCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <Skeleton className="h-0.5 w-full rounded-none" />
            <div className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                            <Skeleton className="h-4 w-16 rounded-full" />
                            <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                </div>
                <div className="flex gap-2 pl-11">
                    <Skeleton className="h-6 w-32 rounded-md" />
                    <Skeleton className="h-6 w-24 rounded-md" />
                </div>
            </div>
        </div>
    );
}

// Shared empty / error state
function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="relative mb-5">
                <div className="absolute inset-0 scale-150 rounded-full bg-primary/5" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm">
                    <Icon className="h-7 w-7 text-muted-foreground" />
                </div>
            </div>
            <h2 className="mb-1.5 text-base font-semibold text-foreground">{title}</h2>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

export default function Trending() {
    const [searchParams] = useSearchParams();
    const expandedExamId = searchParams.get('exam');

    const [selectedTab, setSelectedTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebouncedValue(searchQuery, 250);
    const [latestFilter, setLatestFilter] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [showAllUpdates, setShowAllUpdates] = useState(false);

    const { data: exams, isLoading, error, refetch, isRefetching } = useTrendingExams("All");
    const { getLogoByName } = useConductingBodyLogos();

    // Fetch exam updates from the updates tab (scraped data)
    const updateCategory = TAB_TO_UPDATE_CATEGORY[selectedTab];
    const { data: examUpdates, isLoading: updatesLoading } = useAllExamUpdates(updateCategory);
    // Whole-table search — the cached feed above only spans the newest 100 rows.
    const { data: searchResults, isFetching: searchFetching } = useExamUpdateSearch(debouncedSearch);
    const queryClient = useQueryClient();

    // Prefetch homepage jobs data when idle (P7: cross-page prefetching)
    useEffect(() => {
        let idleId: number | undefined;
        const prefetchHomepage = () => {
            queryClient.prefetchQuery({
                queryKey: ["homepage-bundle"],
                queryFn: async () => {
                    const res = await fetch("/api/cache/homepage");
                    if (!res.ok) return [];
                    return res.json();
                },
                staleTime: 1000 * 60 * 5,
            });
        };
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            idleId = window.requestIdleCallback(prefetchHomepage, { timeout: 3000 });
        } else {
            idleId = window.setTimeout(prefetchHomepage, 2000) as unknown as number;
        }
        return () => {
            if (idleId !== undefined && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleId);
            }
        };
    }, [queryClient]);

    // Scroll tracking for hide/show filter bar
    const containerRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const { scrollY } = useScroll({ container: containerRef });
    const [filterVisible, setFilterVisible] = useState(true);

    // Track scroll direction
    useEffect(() => {
        return scrollY.on("change", (current) => {
            if (current > lastScrollY.current && current > 100) {
                setFilterVisible(false);
            } else if (current < lastScrollY.current) {
                setFilterVisible(true);
            }
            lastScrollY.current = current;
        });
    }, [scrollY]);

    // Toggle category selection
    const toggleCategory = useCallback((category: string) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    }, []);

    // Toggle location selection
    const toggleLocation = useCallback((location: string) => {
        setSelectedLocations(prev =>
            prev.includes(location)
                ? prev.filter(l => l !== location)
                : [...prev, location]
        );
    }, []);

    // Determine if the current tab is "updates-only" (no exam cards)
    const isUpdatesOnlyTab = UPDATES_ONLY_TABS.has(selectedTab);

    // Filter exams based on selected tab and filters
    const filteredExams = useMemo(() => {
        if (!exams || isUpdatesOnlyTab) return [];

        let result = [...exams];

        // Tab filtering
        switch (selectedTab) {
            case "notification":
                result = exams.filter(exam => {
                    const badge = getBadgeConfig(getExamStatusType(exam.ai_cached_response));
                    return badge.label === "Notification" ||
                        badge.label === "Upcoming" ||
                        badge.label === "Exam Date Announced";
                });
                break;

            case "admit_card":
                result = exams.filter(exam => {
                    const badge = getBadgeConfig(getExamStatusType(exam.ai_cached_response));
                    return badge.label === "Admit Card Released" ||
                        badge.label === "Admit Card Pending" ||
                        badge.label === "Exam Scheduled";
                });
                break;

            case "result":
                result = exams.filter(exam => {
                    const badge = getBadgeConfig(getExamStatusType(exam.ai_cached_response));
                    return badge.label === "Result Released";
                });
                break;

            case "all":
            default:
                result = exams;
        }

        // Apply category filter
        if (selectedCategories.length > 0) {
            result = result.filter(exam => {
                const examCategory = exam.category?.toLowerCase() || "";
                const examName = exam.name?.toLowerCase() || "";
                const conductingBody = exam.conducting_body?.toLowerCase() || "";
                const searchText = `${examName} ${conductingBody}`;

                return selectedCategories.some(cat =>
                    examCategory.includes(cat.toLowerCase()) ||
                    searchText.includes(cat.toLowerCase())
                );
            });
        }

        // Apply location filter
        if (selectedLocations.length > 0) {
            result = result.filter(exam => {
                const searchStr = `${exam.name} ${exam.conducting_body} ${exam.description}`.toLowerCase();
                const category = exam.category?.toLowerCase() || "";

                return selectedLocations.some(loc => {
                    if (loc === "All India") {
                        const centralCats = ["upsc", "ssc", "railways", "defence", "banking"];
                        return centralCats.includes(category) || searchStr.includes("all india");
                    }
                    const abbrs = STATE_ABBREVIATIONS[loc] || [loc];
                    return abbrs.some(abbr => searchStr.includes(abbr.toLowerCase()));
                });
            });
        }

        // Apply latest sorting
        if (latestFilter) {
            result = [...result].sort((a, b) => {
                const dateA = new Date(a.ai_last_updated_at || 0).getTime();
                const dateB = new Date(b.ai_last_updated_at || 0).getTime();
                return dateB - dateA;
            });
        }

        // Text search across the exam's name, conducting body, category & AI summary
        const search = debouncedSearch.trim();
        if (search) {
            const tokens = tokenizeQuery(search);
            result = result.filter((exam) =>
                scoreUpdateForQuery(
                    {
                        title: exam.name,
                        conducting_body: exam.conducting_body,
                        category: exam.category,
                        description: exam.description,
                        summary: exam.ai_cached_response?.summary,
                        ai: exam.ai_cached_response,
                    },
                    tokens
                ) > 0
            );
        }

        return result;
    }, [exams, selectedTab, selectedCategories, selectedLocations, latestFilter, isUpdatesOnlyTab, debouncedSearch]);

    // Filter exam updates for display — deep search across ALL update fields.
    // While searching, the cached feed (newest 100 rows ≈ a few hours) is merged
    // with the server-side search over the whole table, so a query for an exam
    // that was not scraped today still answers with that exam's posts.
    const filteredUpdates = useMemo(() => {
        const search = debouncedSearch.trim();
        if (!search) return examUpdates || [];

        const merged = [...(examUpdates || [])];
        const seen = new Set(merged.map((u) => u.id));
        for (const u of searchResults || []) {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                merged.push(u);
            }
        }
        const ranked = searchUpdates(merged, search);
        // Tab filters apply to the server results too — they are unfiltered.
        return updateCategory ? ranked.filter((u) => u.category === updateCategory) : ranked;
    }, [examUpdates, searchResults, debouncedSearch, updateCategory]);

    // Updates scraped in the last 24h — surfaced at top (hidden while searching so
    // results aren't split across two sections)
    const recentUpdates = useMemo(() => {
        if (!examUpdates || debouncedSearch.trim()) return [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return examUpdates.filter((u) => new Date(u.scraped_at).getTime() > cutoff);
    }, [examUpdates, debouncedSearch]);

    const isSearching = !!debouncedSearch.trim();
    // The server search can still be in flight after the local feed has been
    // filtered — showing "No matches found" in that gap is just wrong.
    const searchPending = isSearching && searchFetching && filteredUpdates.length === 0;

    const activeFilterCount = selectedCategories.length + selectedLocations.length;
    const hasActiveFilters = activeFilterCount > 0;

    const clearAllFilters = useCallback(() => {
        setSelectedCategories([]);
        setSelectedLocations([]);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 flex flex-col">
            {/* App Header */}
            <div className="md:hidden">
                <AppHeader
                    title="Updates"
                    variant="primary"
                    showMenu={true}
                    showRefresh={true}
                    showLogo={false}
                    showTitleLogo={true}
                    onRefresh={() => refetch()}
                    isRefreshing={isRefetching}
                />
            </div>

            {/* Desktop hero */}
            <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.55)_52%,hsl(var(--primary)/0.12)_100%)]">
                <div className="mx-auto max-w-6xl px-6 py-9 lg:px-8">
                    <div className="flex items-start justify-between gap-10">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                                </span>
                                Live Update Feed
                            </div>
                            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
                                Every exam update, the moment it drops.
                            </h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground lg:text-base">
                                Notifications, admit cards, answer keys, results and cutoffs from every
                                major recruiting body — collected from official sources into one clean,
                                searchable feed.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                {TABS.slice(1, 5).map((tab) => {
                                    const TabIcon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => { setSelectedTab(tab.id); setShowAllUpdates(false); }}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                                                selectedTab === tab.id
                                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                                    : "border-border bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                            )}
                                        >
                                            <TabIcon className="h-3.5 w-3.5" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-4">
                            <div className="grid min-w-[320px] grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">In Feed Now</p>
                                    <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{filteredExams.length + filteredUpdates.length}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">updates &amp; tracked exams</p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">New in 24h</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <p className="text-3xl font-bold tabular-nums text-foreground">{recentUpdates.length}</p>
                                        {recentUpdates.length > 0 && (
                                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">fresh from sources</p>
                                </div>
                            </div>
                            <Button onClick={() => refetch()} variant="outline" className="rounded-xl" disabled={isRefetching}>
                                <RefreshCw className={cn("mr-2 h-4 w-4", isRefetching && "animate-spin")} />
                                {isRefetching ? "Refreshing…" : "Refresh Feed"}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Animated Filter Bar */}
            <motion.div
                initial={{ y: 0 }}
                animate={{ y: filterVisible ? 0 : -100 }}
                transition={{ duration: 0.2 }}
                className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm shrink-0 md:top-16"
            >
                {/* Search Bar */}
                <div className="mx-auto px-4 pt-3 md:max-w-6xl md:px-6 lg:px-8">
                    <div className="relative">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            inputMode="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search updates — result, admit card, exam name…"
                            className="w-full h-10 pl-10 pr-9 rounded-full bg-card border border-border text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="mx-auto flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide md:max-w-6xl md:px-6 lg:px-8">
                    {/* Latest Toggle */}
                    <button
                        onClick={() => setLatestFilter(!latestFilter)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                            latestFilter
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        )}
                    >
                        <Clock className="h-3.5 w-3.5" />
                        Latest
                    </button>

                    {/* Category Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                                    selectedCategories.length > 0
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                )}
                            >
                                <Grid3X3 className="h-3.5 w-3.5" />
                                Category
                                {selectedCategories.length > 0 && (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[10px] font-bold tabular-nums">
                                        {selectedCategories.length}
                                    </span>
                                )}
                                <ChevronDown className="h-3 w-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>Select Categories</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {EXAM_CATEGORIES.map((category) => (
                                <DropdownMenuCheckboxItem
                                    key={category}
                                    checked={selectedCategories.includes(category)}
                                    onCheckedChange={() => toggleCategory(category)}
                                >
                                    {category}
                                </DropdownMenuCheckboxItem>
                            ))}
                            {selectedCategories.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <button
                                        onClick={() => setSelectedCategories([])}
                                        className="w-full px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-sm"
                                    >
                                        Clear All
                                    </button>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Location Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                                    selectedLocations.length > 0
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                )}
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Location
                                {selectedLocations.length > 0 && (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[10px] font-bold tabular-nums">
                                        {selectedLocations.length}
                                    </span>
                                )}
                                <ChevronDown className="h-3 w-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 max-h-64 overflow-y-auto">
                            <DropdownMenuLabel>Select Location</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {EXAM_LOCATIONS.map((location) => (
                                <DropdownMenuCheckboxItem
                                    key={location}
                                    checked={selectedLocations.includes(location)}
                                    onCheckedChange={() => toggleLocation(location)}
                                >
                                    {location}
                                </DropdownMenuCheckboxItem>
                            ))}
                            {selectedLocations.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <button
                                        onClick={() => setSelectedLocations([])}
                                        className="w-full px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-sm"
                                    >
                                        Clear All
                                    </button>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Tab Navigation */}
                <div className="mx-auto flex gap-1.5 overflow-x-auto border-t border-border/50 px-4 py-2.5 scrollbar-hide md:max-w-6xl md:px-6 lg:px-8">
                    {TABS.map((tab) => {
                        const TabIcon = tab.icon;
                        const isActive = selectedTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setSelectedTab(tab.id); setShowAllUpdates(false); }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                <TabIcon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {/* Content */}
            <main
                ref={containerRef}
                className="mx-auto flex-1 w-full max-w-6xl overflow-y-auto px-4 py-6 pb-24 md:px-6 lg:px-8"
            >
                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filters</span>
                        {selectedCategories.map((category) => (
                            <button
                                key={`cat-${category}`}
                                onClick={() => toggleCategory(category)}
                                className="group inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                                {category}
                                <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                            </button>
                        ))}
                        {selectedLocations.map((location) => (
                            <button
                                key={`loc-${location}`}
                                onClick={() => toggleLocation(location)}
                                className="group inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                                <MapPin className="h-3 w-3" />
                                {location}
                                <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                            </button>
                        ))}
                        <button
                            onClick={clearAllFilters}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                        >
                            <FilterX className="h-3 w-3" />
                            Clear all
                        </button>
                    </div>
                )}

                {error ? (
                    <EmptyState
                        icon={TrendingUp}
                        title="Couldn't load updates"
                        description="Something went wrong while fetching the feed. Check your connection and try again."
                        action={
                            <Button onClick={() => refetch()} className="rounded-xl">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry
                            </Button>
                        }
                    />
                ) : isUpdatesOnlyTab ? (
                    /* Updates-only tabs (Answer Key, Cutoff, Syllabus, News) */
                    updatesLoading || searchPending ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[1, 2, 3, 4].map((i) => (
                                <UpdateCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : filteredUpdates.length > 0 ? (
                        <div className="space-y-3">
                            {isSearching && (
                                <SectionHeading icon={SearchIcon} title="Search Results" count={filteredUpdates.length} hint="Newest first" />
                            )}
                            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                                {filteredUpdates.map((update, index) => (
                                    <ExamUpdateCard key={update.id} update={update} index={index} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            icon={debouncedSearch.trim() ? SearchX : Newspaper}
                            title={debouncedSearch.trim() ? "No matches found" : "No updates found"}
                            description={
                                debouncedSearch.trim()
                                    ? `Nothing matched “${debouncedSearch.trim()}”. Try a different keyword.`
                                    : `No ${selectedTab.replace(/_/g, " ")} updates available yet. New ones land here as soon as they're published.`
                            }
                        />
                    )
                ) : (
                    /* Combined view: Exam updates + Exam cards */
                    <div className="space-y-8">
                        {/* Exam Updates Section / Skeleton */}
                        {updatesLoading || searchPending ? (
                            <div className="space-y-3">
                                <SectionHeading icon={isSearching ? SearchIcon : Newspaper} title={isSearching ? "Search Results" : "Latest Updates"} />
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {[1, 2, 3, 4].map((i) => (
                                        <UpdateCardSkeleton key={i} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Just Added — priority section for updates from last 24h */}
                                {selectedTab === "all" && recentUpdates.length > 0 && (
                                    <div className="space-y-3">
                                        <SectionHeading icon={Sparkles} title="Just Added" count={recentUpdates.length} accent />
                                        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                                            {recentUpdates.map((update, index) => (
                                                <ExamUpdateCard key={update.id} update={update} index={index} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Exam Updates Section (shown at top for relevant tabs) */}
                                {filteredUpdates.length > 0 && selectedTab !== "notification" && (() => {
                                    const isAllTab = selectedTab === "all";
                                    // Show every match while searching; otherwise cap the "all" tab at 10.
                                    const visibleLimit = isAllTab && !showAllUpdates && !isSearching ? 10 : filteredUpdates.length;
                                    const visibleUpdates = filteredUpdates.slice(0, visibleLimit);
                                    const hasMore = isAllTab && !showAllUpdates && !isSearching && filteredUpdates.length > 10;

                                    return (
                                        <div className="space-y-3">
                                            <SectionHeading
                                                icon={isSearching ? SearchIcon : Newspaper}
                                                title={isSearching ? "Search Results" : isAllTab ? "Latest Updates" : `${selectedTab.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Updates`}
                                                count={filteredUpdates.length}
                                                hint={isSearching ? "Newest first" : undefined}
                                            />
                                            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                                                {visibleUpdates.map((update, index) => (
                                                    <ExamUpdateCard key={update.id} update={update} index={index} />
                                                ))}
                                            </div>
                                            {hasMore && (
                                                <button
                                                    onClick={() => setShowAllUpdates(true)}
                                                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
                                                >
                                                    Show all {filteredUpdates.length} updates
                                                    <ChevronDown className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </>
                        )}

                        {/* Exam Cards Section / Skeleton */}
                        {isLoading ? (
                            <div className="space-y-3 pt-2">
                                <SectionHeading icon={TrendingUp} title="Tracked Exams" />
                                <div className="space-y-4">
                                    {[1, 2].map((i) => (
                                        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
                                    ))}
                                </div>
                            </div>
                        ) : filteredExams.length > 0 ? (
                            <div className="space-y-4">
                                {(filteredUpdates.length > 0 || updatesLoading) && selectedTab !== "notification" && (
                                    <SectionHeading icon={TrendingUp} title="Tracked Exams" count={filteredExams.length} />
                                )}
                                {filteredExams.map((exam, index) => (
                                    <TrendingExamCard
                                        key={exam.id}
                                        exam={{
                                            ...exam,
                                            logo_url: getLogoByName(exam.conducting_body) || exam.logo_url
                                        }}
                                        index={index}
                                        initialExpanded={expandedExamId === exam.id}
                                    />
                                ))}
                            </div>
                        ) : (!updatesLoading && filteredUpdates.length === 0) ? (
                            <EmptyState
                                icon={debouncedSearch.trim() ? SearchX : hasActiveFilters ? FilterX : TrendingUp}
                                title={
                                    debouncedSearch.trim()
                                        ? "No matches found"
                                        : hasActiveFilters
                                            ? "Nothing matches these filters"
                                            : "No updates yet"
                                }
                                description={
                                    debouncedSearch.trim()
                                        ? `Nothing matched “${debouncedSearch.trim()}”. Try a different keyword.`
                                        : hasActiveFilters
                                            ? "No updates match your current category or location filters. Try broadening them."
                                            : "Exams will appear here once users start tracking and refreshing status updates."
                                }
                                action={
                                    hasActiveFilters ? (
                                        <Button onClick={clearAllFilters} variant="outline" className="rounded-xl">
                                            <FilterX className="mr-2 h-4 w-4" />
                                            Clear All Filters
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : null}
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
