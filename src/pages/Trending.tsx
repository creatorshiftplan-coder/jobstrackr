import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTrendingExams, CATEGORY_GRADIENTS } from "@/hooks/useTrendingExams";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { TrendingExamCard } from "@/components/TrendingExamCard";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, X, Check, ChevronDown, MapPin, Grid3X3, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getExamStatusType, getBadgeConfig } from "@/lib/examStatus";
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
];

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
    const [latestFilter, setLatestFilter] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

    const { data: exams, isLoading, error, refetch, isRefetching } = useTrendingExams("All");
    const { getLogoByName } = useConductingBodyLogos();

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

    // Filter exams based on selected tab and filters
    const filteredExams = useMemo(() => {
        if (!exams) return [];

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

        return result;
    }, [exams, selectedTab, selectedCategories, selectedLocations, latestFilter]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 flex flex-col">
            {/* App Header */}
            <AppHeader
                title="Trending"
                variant="primary"
                showMenu={true}
                showRefresh={true}
                showLogo={false}
                showTitleLogo={true}
                onRefresh={refetch}
                isRefreshing={isRefetching}
            />

            {/* Animated Filter Bar */}
            <motion.div
                initial={{ y: 0 }}
                animate={{ y: filterVisible ? 0 : -100 }}
                transition={{ duration: 0.2 }}
                className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm shrink-0"
            >
                {/* Filter Pills */}
                <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
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
                <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide border-t border-border/50">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedTab(tab.id)}
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
                className="flex-1 overflow-y-auto px-4 py-6 pb-24"
            >
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-destructive">Failed to load trending exams</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredExams && filteredExams.length > 0 ? (
                    <div className="space-y-4">
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
                ) : (
                    <div className="text-center py-16">
                        <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                            <TrendingUp className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            {selectedCategories.length > 0 || selectedLocations.length > 0
                                ? "No Exams Found"
                                : "No Trending Exams Yet"
                            }
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            {selectedCategories.length > 0 || selectedLocations.length > 0
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
                )}
            </main>

            <BottomNav />
        </div>
    );
}
