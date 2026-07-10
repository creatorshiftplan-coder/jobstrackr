import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTrendingExams, CATEGORY_GRADIENTS } from "@/hooks/useTrendingExams";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { TrendingExamCard } from "@/components/TrendingExamCard";
import { ExamUpdateCard } from "@/components/ExamUpdateCard";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, X, Check, ChevronDown, MapPin, Grid3X3, Clock, Newspaper, Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getExamStatusType, getBadgeConfig } from "@/lib/examStatus";
import { useAllExamUpdates } from "@/hooks/useExamUpdates";
import { searchUpdates, scoreUpdateForQuery, tokenizeQuery } from "@/lib/updateSearch";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";



// Tab options
const TABS = [
    { id: "all", label: "📋 All" },
    { id: "notification", label: "🔔 Notification" },
    { id: "admit_card", label: "🎫 Admit Card" },
    { id: "result", label: "🏆 Result" },
    { id: "answer_key", label: "🔑 Answer Key" },
    { id: "cutoff", label: "📊 Cutoff" },
    { id: "syllabus", label: "📖 Syllabus" },
    { id: "news", label: "📰 News" },
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

    // Filter exam updates for display — deep search across ALL update fields
    const filteredUpdates = useMemo(() => {
        if (!examUpdates) return [];
        return debouncedSearch.trim() ? searchUpdates(examUpdates as any[], debouncedSearch) : examUpdates;
    }, [examUpdates, debouncedSearch]);

    // Updates scraped in the last 24h — surfaced at top (hidden while searching so
    // results aren't split across two sections)
    const recentUpdates = useMemo(() => {
        if (!examUpdates || debouncedSearch.trim()) return [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return examUpdates.filter((u) => new Date(u.scraped_at).getTime() > cutoff);
    }, [examUpdates, debouncedSearch]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 flex flex-col">
            {/* App Header */}
            <div className="md:hidden">
                <AppHeader
                    title="Trending"
                    variant="primary"
                    showMenu={true}
                    showRefresh={true}
                    showLogo={false}
                    showTitleLogo={true}
                    onRefresh={() => refetch()}
                    isRefreshing={isRefetching}
                />
            </div>

            <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.55)_52%,hsl(var(--primary)/0.12)_100%)]">
                <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
                    <div className="flex items-end justify-between gap-8">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                                <TrendingUp className="h-3.5 w-3.5" />
                                Live Update Feed
                            </div>
                            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
                                Latest government exam updates in a clearer, more professional desktop view.
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                                Follow notifications, admit cards, and results in one refined workspace built for fast scanning and better filtering.
                            </p>
                        </div>

                        <div className="grid min-w-[320px] grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Visible Updates</p>
                                <p className="mt-2 text-3xl font-bold text-foreground">{filteredExams.length + filteredUpdates.length}</p>
                                <p className="mt-1 text-sm text-muted-foreground">matching current filters</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Filter State</p>
                                <p className="mt-2 text-3xl font-bold text-foreground">{selectedCategories.length + selectedLocations.length + (latestFilter ? 1 : 0)}</p>
                                <p className="mt-1 text-sm text-muted-foreground">active refinements</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-sm text-muted-foreground">Notifications</span>
                            <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-sm text-muted-foreground">Admit Cards</span>
                            <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-sm text-muted-foreground">Results</span>
                        </div>
                        <Button onClick={() => refetch()} variant="outline" className="rounded-xl" disabled={isRefetching}>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            {isRefetching ? "Refreshing..." : "Refresh Feed"}
                        </Button>
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
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            inputMode="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search updates — result, admit card, exam name…"
                            className="w-full h-10 pl-10 pr-9 rounded-full bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
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
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
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
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                )}
                            >
                                <Grid3X3 className="h-3.5 w-3.5" />
                                Category {selectedCategories.length > 0 && `(${selectedCategories.length})`}
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
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                )}
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Location {selectedLocations.length > 0 && `(${selectedLocations.length})`}
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
                <div className="mx-auto flex gap-2 overflow-x-auto border-t border-border/50 px-4 pb-3 scrollbar-hide md:max-w-6xl md:px-6 lg:px-8">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setSelectedTab(tab.id); setShowAllUpdates(false); }}
                            className={cn(
                                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                                selectedTab === tab.id
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Content */}
            <main
                ref={containerRef}
                className="mx-auto flex-1 w-full max-w-6xl overflow-y-auto px-4 py-6 pb-24 md:px-6 lg:px-8"
            >
                {error ? (
                    <div className="text-center py-12">
                        <p className="text-destructive">Failed to load trending exams</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                        >
                            Retry
                        </button>
                    </div>
                ) : isUpdatesOnlyTab ? (
                    /* Updates-only tabs (Answer Key, Cutoff, Syllabus, News) */
                    updatesLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                            ))}
                        </div>
                    ) : filteredUpdates.length > 0 ? (
                        <div className="space-y-4">
                            {filteredUpdates.map((update, index) => (
                                <ExamUpdateCard key={update.id} update={update} index={index} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                                <TrendingUp className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground mb-2">No Updates Found</h2>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                No {selectedTab.replace(/_/g, " ")} updates available yet.
                            </p>
                        </div>
                    )
                ) : (
                    /* Combined view: Exam updates + Exam cards */
                    <div className="space-y-6">
                        {/* Exam Updates Section / Skeleton */}
                        {updatesLoading ? (
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Newspaper className="h-4 w-4" />
                                    Loading Latest Updates...
                                </h2>
                                <div className="space-y-3">
                                    {[1, 2].map((i) => (
                                        <Skeleton key={i} className="h-32 w-full rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Just Added — priority section for updates from last 24h */}
                                {selectedTab === "all" && recentUpdates.length > 0 && (
                                    <div className="space-y-3">
                                        <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wider flex items-center gap-2">
                                            <Newspaper className="h-4 w-4" />
                                            Just Added
                                            <Badge variant="secondary" className="text-[10px] ml-1">{recentUpdates.length}</Badge>
                                        </h2>
                                        <div className="space-y-3">
                                            {recentUpdates.map((update, index) => (
                                                <ExamUpdateCard key={update.id} update={update} index={index} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Exam Updates Section (shown at top for relevant tabs) */}
                                {filteredUpdates.length > 0 && selectedTab !== "notification" && (() => {
                                    const isSearching = !!debouncedSearch.trim();
                                    const isAllTab = selectedTab === "all";
                                    // Show every match while searching; otherwise cap the "all" tab at 10.
                                    const visibleLimit = isAllTab && !showAllUpdates && !isSearching ? 10 : filteredUpdates.length;
                                    const visibleUpdates = filteredUpdates.slice(0, visibleLimit);
                                    const hasMore = isAllTab && !showAllUpdates && !isSearching && filteredUpdates.length > 10;

                                    return (
                                        <div className="space-y-3">
                                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <Newspaper className="h-4 w-4" />
                                                {isSearching ? "Search Results" : isAllTab ? "Latest Updates" : `${selectedTab.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Updates`}
                                                <Badge variant="secondary" className="text-[10px] ml-1">{filteredUpdates.length}</Badge>
                                            </h2>
                                            <div className="space-y-3">
                                                {visibleUpdates.map((update, index) => (
                                                    <ExamUpdateCard key={update.id} update={update} index={index} />
                                                ))}
                                            </div>
                                            {hasMore && (
                                                <button
                                                    onClick={() => setShowAllUpdates(true)}
                                                    className="w-full py-2.5 text-sm font-medium text-primary hover:text-primary/80 bg-secondary/40 hover:bg-secondary/60 rounded-xl transition-colors"
                                                >
                                                    Show all {filteredUpdates.length} updates
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
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Loading Tracked Exams...
                                </h2>
                                <div className="space-y-4">
                                    {[1, 2].map((i) => (
                                        <Skeleton key={i} className="h-48 w-full rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ) : filteredExams.length > 0 ? (
                            <div className="space-y-4">
                                {(filteredUpdates.length > 0 || updatesLoading) && selectedTab !== "notification" && (
                                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pt-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Tracked Exams
                                    </h2>
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
                            <div className="text-center py-16">
                                <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                                    <TrendingUp className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h2 className="text-lg font-semibold text-foreground mb-2">
                                    {debouncedSearch.trim()
                                        ? "No matches found"
                                        : selectedCategories.length > 0 || selectedLocations.length > 0
                                            ? "No Exams Found"
                                            : "No Trending Exams Yet"
                                    }
                                </h2>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    {debouncedSearch.trim()
                                        ? `Nothing matched “${debouncedSearch.trim()}”. Try a different keyword.`
                                        : selectedCategories.length > 0 || selectedLocations.length > 0
                                            ? "No updates available. Try changing your filters."
                                            : "Exams will appear here once users start tracking and refreshing status updates."
                                    }
                                </p>
                                {(selectedCategories.length > 0 || selectedLocations.length > 0) && (
                                    <button
                                        onClick={() => {
                                            setSelectedCategories([]);
                                            setSelectedLocations([]);
                                        }}
                                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
                                    >
                                        Clear All Filters
                                    </button>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
