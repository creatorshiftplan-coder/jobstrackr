import { useState, useCallback, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Bookmark, Search, X, Loader2, ChevronRight, RefreshCw, BookOpen, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import logoWhite from "@/assets/logo-white.png";
import { useSmartBack } from "@/hooks/useSmartBack";

// ─── Types ───────────────────────────────────────────────────────────────

interface ExamSuggestion {
    id: string;
    name: string;
    conducting_body?: string;
    isCached?: boolean;
    cacheId?: string;
}

interface SyllabusData {
    exam_name: string;
    syllabus: any[];
    stages?: any[];
    grounding_sources?: string[];
    confidence?: number;
    year?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

const POPULAR_EXAMS = [
    { id: "upsc", name: "UPSC Civil Services", badge: "UPSC", description: "Union Public Service Commission", color: "#3B82F6" },
    { id: "ssc_cgl", name: "SSC CGL", badge: "SSC", description: "Combined Graduate Level", color: "#22C55E" },
    { id: "ibps_po", name: "IBPS PO", badge: "IBPS", description: "Probationary Officer", color: "#14B8A6" },
    { id: "rrb_ntpc", name: "RRB NTPC", badge: "RRB", description: "Railway Recruitment Board", color: "#F97316" },
    { id: "sbi_clerk", name: "SBI Clerk", badge: "SBI", description: "Junior Associates", color: "#8B5CF6" },
    { id: "gate", name: "GATE 2025", badge: "GATE", description: "Engineering Aptitude Test", color: "#EF4444" },
];
// ─── Rate Limiting ───────────────────────────────────────────────────────

const DAILY_AI_LIMIT = 3;
const RATE_LIMIT_KEY = "syllabus_ai_usage";

function getAIUsageToday(): { count: number; date: string } {
    try {
        const raw = localStorage.getItem(RATE_LIMIT_KEY);
        if (!raw) return { count: 0, date: new Date().toDateString() };
        const parsed = JSON.parse(raw);
        if (parsed.date !== new Date().toDateString()) {
            return { count: 0, date: new Date().toDateString() };
        }
        return parsed;
    } catch {
        return { count: 0, date: new Date().toDateString() };
    }
}

function incrementAIUsage() {
    const usage = getAIUsageToday();
    usage.count += 1;
    usage.date = new Date().toDateString();
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(usage));
}

function getRemainingSearches(): number {
    return Math.max(0, DAILY_AI_LIMIT - getAIUsageToday().count);
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function SyllabusCheck() {
    const navigate = useNavigate();
    const handleBack = useSmartBack("/");
    const { user } = useAuth();
    const { showAuthRequired } = useAuthRequired();

    // Search state
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<ExamSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remainingSearches, setRemainingSearches] = useState(getRemainingSearches());

    // Cached exams state
    const [cachedExams, setCachedExams] = useState<any[]>([]);
    const [cachedLoading, setCachedLoading] = useState(true);
    const [showAllCached, setShowAllCached] = useState(false);

    // ─── Navigate to result page ───────────────────────────────────────

    const openResult = (data: SyllabusData) => {
        navigate("/syllabus/result", { state: { syllabusData: data } });
    };

    // ─── Fetch cached syllabi on mount ─────────────────────────────────

    useEffect(() => {
        const fetchCached = async () => {
            setCachedLoading(true);
            try {
                const { data, error } = await (supabase as any)
                    .from("syllabus_cache")
                    .select("id, exam_name, syllabus_data, year")
                    .gt("expires_at", new Date().toISOString())
                    .order("created_at", { ascending: false })
                    .limit(50);

                if (error) throw error;
                const unique = data?.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.exam_name === v.exam_name) === i) || [];
                setCachedExams(unique);
            } catch (e) {
                console.error("Error fetching cached syllabi:", e);
            } finally {
                setCachedLoading(false);
            }
        };
        fetchCached();
    }, []);

    // ─── Debounced suggestion search ───────────────────────────────────

    const searchSuggestions = useCallback(async (text: string) => {
        if (text.length < 2) {
            setSuggestions([]);
            return;
        }
        setSuggestionsLoading(true);
        try {
            const [jobsResult, cachedResult] = await Promise.all([
                supabase.from("jobs").select("id, title, department").ilike("title", `%${text}%`).limit(8),
                (supabase as any).from("syllabus_cache").select("id, exam_name").ilike("exam_name", `%${text}%`).gt("expires_at", new Date().toISOString()).limit(5),
            ]);

            const cachedSugs: ExamSuggestion[] = (cachedResult.data || []).map((item: any) => ({
                id: `cached_${item.id}`,
                name: item.exam_name,
                conducting_body: "Saved",
                isCached: true,
                cacheId: item.id,
            }));

            const jobSugs: ExamSuggestion[] = (jobsResult.data || []).map((item: any) => ({
                id: item.id,
                name: item.title.replace(/\s*\d{4}\s*$/g, "").trim(),
                conducting_body: item.department || "",
                isCached: false,
            }));

            const all: ExamSuggestion[] = [...cachedSugs];
            const seen = new Set(cachedSugs.map((s) => s.name.toLowerCase()));
            for (const j of jobSugs) {
                const lower = j.name.toLowerCase();
                if (!seen.has(lower)) {
                    seen.add(lower);
                    all.push(j);
                }
            }
            setSuggestions(all.slice(0, 8));
        } catch {
            setSuggestions([]);
        } finally {
            setSuggestionsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                searchSuggestions(query);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, searchSuggestions]);

    // ─── Search / Load syllabus ────────────────────────────────────────

    const searchSyllabus = async (examName: string) => {
        setShowSuggestions(false);
        setSearching(true);
        setError(null);

        try {
            const normalizedName = examName.replace(/\s*\d{4}\s*/g, " ").replace(/\s+/g, " ").trim().toUpperCase();

            // Check cache first (exact)
            let { data: cachedData } = await (supabase as any)
                .from("syllabus_cache")
                .select("id, syllabus_data, source_urls, year")
                .eq("exam_name", normalizedName)
                .gt("expires_at", new Date().toISOString())
                .limit(1)
                .maybeSingle();

            // Fallback ilike
            if (!cachedData) {
                const words = normalizedName.split(" ").filter((w: string) => w.length > 2);
                const pattern = words.length >= 2 ? `%${words[0]}%${words[1]}%` : `${normalizedName}%`;
                const { data: fallback } = await (supabase as any)
                    .from("syllabus_cache")
                    .select("id, syllabus_data, source_urls, year")
                    .ilike("exam_name", pattern)
                    .gt("expires_at", new Date().toISOString())
                    .limit(1)
                    .maybeSingle();
                if (fallback) cachedData = fallback;
            }

            if (cachedData?.syllabus_data) {
                const data = cachedData.syllabus_data as SyllabusData;
                data.grounding_sources = cachedData.source_urls || data.grounding_sources;
                data.year = data.year || cachedData.year;
                openResult(data);
                return;
            }

            // Rate limit check — only for AI edge function calls
            if (!user) {
                setError(null);
                showAuthRequired("Login to use AI-powered syllabus search");
                return;
            }

            if (getRemainingSearches() <= 0) {
                setError("You've used all 3 AI searches for today. Try again tomorrow, or search for a cached exam.");
                setRemainingSearches(0);
                return;
            }

            // Not cached — call edge function
            const { data: fnData, error: fnError } = await supabase.functions.invoke("syllabus-search", {
                body: { exam_name: examName },
            });

            if (fnError) throw fnError;
            if (fnData?.error) throw new Error(fnData.error);

            if (fnData?.syllabus) {
                incrementAIUsage();
                setRemainingSearches(getRemainingSearches());
                openResult(fnData.syllabus as SyllabusData);
            } else {
                setError("No syllabus found. Try a more specific query.");
            }
        } catch (e: any) {
            console.error("Syllabus search error:", e);
            setError(e?.message || "Failed to fetch syllabus. Please try again.");
        } finally {
            setSearching(false);
        }
    };

    const loadFromCache = (item: any) => {
        if (item.syllabus_data) {
            const data = item.syllabus_data as SyllabusData;
            data.year = data.year || item.year;
            openResult(data);
        } else {
            searchSyllabus(item.exam_name);
        }
    };

    const selectSuggestion = (suggestion: ExamSuggestion) => {
        setQuery(suggestion.name);
        setShowSuggestions(false);
        if (suggestion.isCached && suggestion.cacheId) {
            const cached = cachedExams.find((c) => c.id === suggestion.cacheId);
            if (cached) {
                loadFromCache(cached);
                return;
            }
        }
        searchSyllabus(suggestion.name);
    };

    const handleSubmit = () => {
        if (query.length >= 3) {
            setError(null);
            searchSyllabus(query);
        }
    };

    // ─── Render ────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-2">
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 text-primary-foreground dark:text-foreground" />
                    </button>
                    <div className="flex items-center gap-2">
                        <img src={logoWhite} alt="JobsTrackr" className="h-7 sm:h-8 w-auto" />
                        <span className="font-display font-bold text-base sm:text-lg text-primary-foreground dark:text-foreground tracking-wider">SYLLABUS FINDER</span>
                    </div>
                    <Link to="/saved">
                        <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
                            <Bookmark className="h-4 w-4 text-primary-foreground dark:text-foreground" />
                        </div>
                    </Link>
                </div>
            </header>

            {/* Search Bar */}
            <div className="sticky top-[48px] z-30 bg-background dark:bg-card px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-secondary dark:bg-secondary/50 border border-border rounded-xl h-11 px-3">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                            type="text"
                            placeholder="Search exam syllabus..."
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            autoFocus
                        />
                        {query.length > 0 && (
                            <button onClick={() => { setQuery(""); setShowSuggestions(false); }}>
                                <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                    <button
                        className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center disabled:opacity-50 transition-opacity shrink-0"
                        onClick={handleSubmit}
                        disabled={query.length < 3 || searching}
                    >
                        {searching ? <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" /> : <Search className="h-5 w-5 text-primary-foreground" />}
                    </button>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-4 right-4 top-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
                        {suggestionsLoading && (
                            <div className="flex items-center justify-center p-3">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                        )}
                        {suggestions.map((s) => (
                            <button
                                key={s.id}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                                onClick={() => selectSuggestion(s)}
                            >
                                <Search className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-sm text-foreground truncate flex-1">{s.name}</span>
                                {s.isCached && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Saved</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Remaining AI searches indicator */}
            <div className="px-4 pt-2">
                <p className={`text-xs ${remainingSearches === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {remainingSearches === 0
                        ? "⚠️ Daily AI search limit reached. Cached exams are still available."
                        : `✨ ${remainingSearches}/${DAILY_AI_LIMIT} AI searches left today`
                    }
                </p>
            </div>

            <main className="px-4 py-4">
                {/* Loading State */}
                {searching && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Searching official sources...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !searching && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-3 mb-3">
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive flex-1">{error}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
                                onClick={() => { setError(null); if (query.length >= 3) handleSubmit(); }}
                            >
                                <RefreshCw className="h-4 w-4" /> Retry
                            </button>
                            <button className="text-sm text-muted-foreground px-3 py-2" onClick={() => setError(null)}>Dismiss</button>
                        </div>
                    </div>
                )}

                {/* Search View */}
                {!searching && !error && (
                    <div className="space-y-6">
                        {/* Popular Exams */}
                        <div>
                            <h3 className="text-base font-semibold text-foreground mb-4">Popular Exams</h3>
                            <div className="space-y-2.5">
                                {POPULAR_EXAMS.map((exam) => (
                                    <button
                                        key={exam.id}
                                        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow text-left"
                                        onClick={() => { setQuery(exam.name); searchSyllabus(exam.name); }}
                                    >
                                        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${exam.color}15` }}>
                                            <span className="text-sm font-bold" style={{ color: exam.color }}>{exam.badge}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground">{exam.name}</p>
                                            <p className="text-xs text-muted-foreground">{exam.description}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recently Cached */}
                        {cachedLoading ? (
                            <div>
                                <h3 className="text-base font-semibold text-foreground mb-4">Recently Viewed</h3>
                                <div className="space-y-2.5">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ) : cachedExams.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-semibold text-foreground">Recently Viewed</h3>
                                    {cachedExams.length > 3 && (
                                        <button className="text-xs font-medium text-primary flex items-center gap-1" onClick={() => setShowAllCached(true)}>
                                            View All ({cachedExams.length}) <ChevronRight className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2.5">
                                    {cachedExams.slice(0, 3).map((exam, i) => (
                                        <button
                                            key={exam.id || i}
                                            className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow text-left"
                                            onClick={() => loadFromCache(exam)}
                                        >
                                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                <BookOpen className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{exam.exam_name}</p>
                                                <p className="text-xs text-muted-foreground">{exam.year || "2025"} • Saved</p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* View All Cached Dialog */}
            {showAllCached && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowAllCached(false)}>
                    <div
                        className="bg-card w-full max-h-[70vh] rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold text-foreground">All Saved Syllabi</h3>
                            <button onClick={() => setShowAllCached(false)}>
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2.5">
                            {cachedExams.map((exam, i) => (
                                <button
                                    key={exam.id || i}
                                    className="w-full flex items-center gap-3 bg-secondary/50 rounded-xl p-4 hover:bg-secondary transition-colors text-left"
                                    onClick={() => { setShowAllCached(false); loadFromCache(exam); }}
                                >
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{exam.exam_name}</p>
                                        <p className="text-xs text-muted-foreground">{exam.year || "2025"} • Saved</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    );
}
