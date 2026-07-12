import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useAllExamUpdates, ExamUpdateItem } from "@/hooks/useExamUpdates";
import { useSimilarJobs, SimilarJob } from "@/hooks/useSimilarJobs";
import { sortByTitleMatch } from "@/lib/titleMatcher";
import { SITE_URL } from "@/lib/seoConfig";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { Award, FileText, Briefcase, ChevronLeft, ChevronRight, Calendar, Users, Sparkles, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExamUpdateRelatedRailsProps {
    currentUpdate: ExamUpdateItem;
    /** The recruitment linked to this update, if any — seeds the Similar Jobs rail. */
    jobId?: string | null;
}

const normCat = (c: string | null | undefined) => c?.toLowerCase().replace(/[_\s]+/g, "") || "";
const isResultCat = (c: string) => c.includes("result") || c.includes("merit") || c.includes("score");
const isAdmitCat = (c: string) => c.includes("admit") || c.includes("hall") || c.includes("ticket");

function timeAgo(dateStr?: string | null): string {
    if (!dateStr) return "";
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); } catch { return ""; }
}

function formatLastDate(dateStr?: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : format(d, "d MMM yyyy");
}

// ── Horizontal rail shell (snap scroll + desktop arrows, FeedShelf-style) ──
function Rail({ title, icon, accentClass, seeAllTo, children }: {
    title: string;
    icon: React.ReactNode;
    accentClass: string;
    seeAllTo: string;
    children: React.ReactNode;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const scroll = (dir: "left" | "right") => {
        scrollRef.current?.scrollBy({ left: dir === "left" ? -540 : 540, behavior: "smooth" });
    };

    return (
        <section aria-label={title} className="relative group/rail">
            <div className="flex items-center justify-between mb-3">
                <h2 className={cn("text-sm font-bold text-foreground flex items-center gap-2", accentClass)}>
                    {icon}<span className="text-foreground">{title}</span>
                </h2>
                <Link to={seeAllTo} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                    See all
                </Link>
            </div>
            <div className="absolute left-0 top-[55%] -translate-y-1/2 z-10 hidden md:group-hover/rail:block">
                <Button variant="outline" size="icon" onClick={() => scroll("left")} aria-label={`Scroll ${title} left`}
                    className="h-8 w-8 rounded-full bg-background/90 shadow-md border-border/60 hover:bg-background">
                    <ChevronLeft className="h-4 w-4 text-foreground" />
                </Button>
            </div>
            <div className="absolute right-0 top-[55%] -translate-y-1/2 z-10 hidden md:group-hover/rail:block">
                <Button variant="outline" size="icon" onClick={() => scroll("right")} aria-label={`Scroll ${title} right`}
                    className="h-8 w-8 rounded-full bg-background/90 shadow-md border-border/60 hover:bg-background">
                    <ChevronRight className="h-4 w-4 text-foreground" />
                </Button>
            </div>
            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            >
                {children}
            </div>
            {/* Right-edge fade: hints there's more to swipe on touch screens */}
            <div className="pointer-events-none absolute top-9 bottom-2 -right-4 w-10 bg-gradient-to-l from-background to-transparent md:hidden" />
        </section>
    );
}

// Scraped date tables often start with a header row ({event:"Event", date:"Date"}),
// and some rows carry link text ("Click Here") instead of an actual date.
const HEADER_CELL_RE = /^(events?|dates?|particulars?|details?|links?|job openings?|last date)$/i;
const JUNK_DATE_RE = /click\s*here|^links?$|download|^here$/i;

function firstRealDate(update: ExamUpdateItem) {
    return update.important_dates?.find(
        (d) =>
            d.event?.trim() &&
            d.date?.trim() &&
            !JUNK_DATE_RE.test(d.date.trim()) &&
            !(HEADER_CELL_RE.test(d.event.trim()) && HEADER_CELL_RE.test(d.date.trim()))
    );
}

function isNewItem(createdAt?: string | null): boolean {
    if (!createdAt) return false;
    const t = new Date(createdAt).getTime();
    return !isNaN(t) && Date.now() - t < 24 * 60 * 60 * 1000;
}

function UpdateMiniCard({ update }: { update: ExamUpdateItem }) {
    const cat = normCat(update.category);
    const isResult = isResultCat(cat);
    const accent = isResult ? "#16a34a" : isAdmitCat(cat) ? "#2563eb" : "#6b7280";
    const label = isResult ? "Result" : isAdmitCat(cat) ? "Admit Card" : "Update";
    const Icon = isResult ? Award : isAdmitCat(cat) ? FileText : Newspaper;
    const badgeClass = isResult
        ? "text-green-600 dark:text-green-400 border-green-500/30"
        : "text-blue-600 dark:text-blue-400 border-blue-500/30";
    const ago = timeAgo(update.scraped_at);
    const topDate = firstRealDate(update);

    return (
        <Link
            to={`/exam-update/${update.slug || update.id}`}
            className="flex-shrink-0 w-[260px] snap-start group"
        >
            <Card className="h-full flex flex-col overflow-hidden border border-border/40 bg-card/60 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all">
                <div className="h-1 w-full" style={{ backgroundColor: accent, opacity: 0.7 }} />
                <div className="p-3.5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}1a` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] font-semibold", badgeClass)}>{label}</Badge>
                        {isNewItem(update.created_at) && (
                            <Badge className="bg-green-100 text-green-700 border-0 text-[9px] px-1.5">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" />New
                            </Badge>
                        )}
                        {ago && <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">{ago}</span>}
                    </div>
                    <h3 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{update.title}</h3>
                    <div className="mt-auto pt-2.5 flex items-center justify-between gap-2">
                        {topDate ? (
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{topDate.event}</span>
                                <span className="font-semibold text-foreground whitespace-nowrap flex-shrink-0">{topDate.date}</span>
                            </p>
                        ) : <span className="text-[10px] text-muted-foreground">View update</span>}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                </div>
            </Card>
        </Link>
    );
}

function JobMiniCard({ job }: { job: SimilarJob }) {
    const daysLeft = (() => {
        if (!job.last_date) return null;
        const t = new Date(job.last_date).getTime();
        if (isNaN(t)) return null;
        return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
    })();
    const closingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

    return (
        <Link
            to={`/jobs/${job.slug || job.id}`}
            className="flex-shrink-0 w-[260px] snap-start group"
        >
            <Card className="h-full flex flex-col overflow-hidden border border-border/40 bg-card/60 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all">
                <div className="h-1 w-full bg-primary/70" />
                <div className="p-3.5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Briefcase className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            {job.department && (
                                <p className="text-[10px] text-muted-foreground font-medium line-clamp-1">{job.department}</p>
                            )}
                        </div>
                        {closingSoon && (
                            <Badge className="ml-auto bg-red-500/10 text-red-600 dark:text-red-400 border-0 text-[9px] px-1.5 whitespace-nowrap">
                                {daysLeft === 0 ? "Last day" : `${daysLeft}d left`}
                            </Badge>
                        )}
                    </div>
                    <h3 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{job.title}</h3>
                    <div className="mt-auto pt-2.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-3 min-w-0">
                            {job.vacancies != null && job.vacancies > 0 && (
                                <span className="flex items-center gap-1 text-primary font-semibold whitespace-nowrap">
                                    <Users className="h-3 w-3" />{job.vacancies} Posts
                                </span>
                            )}
                            {job.last_date && (
                                <span className={cn("flex items-center gap-1 truncate", closingSoon && "text-red-600 dark:text-red-400")}>
                                    <Calendar className="h-3 w-3 flex-shrink-0" />
                                    <span className={cn("font-semibold whitespace-nowrap", closingSoon ? "text-red-600 dark:text-red-400" : "text-foreground")}>{formatLastDate(job.last_date)}</span>
                                </span>
                            )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                </div>
            </Card>
        </Link>
    );
}

/**
 * Related-content rails for the exam-update detail page: latest Results,
 * Admit Cards (from the Redis-cached trending feed — no extra DB load) and
 * vector-similar Jobs. Emits ItemList JSON-LD for the update rails.
 */
export function ExamUpdateRelatedRails({ currentUpdate, jobId }: ExamUpdateRelatedRailsProps) {
    // Same cached endpoint the Trending page uses — typically already warm in
    // the react-query cache when the user navigates here from Trending.
    const { data: allUpdates } = useAllExamUpdates();
    const { data: similarJobs = [] } = useSimilarJobs(jobId || undefined, 8, !!jobId);

    // Vector similarity doesn't know about deadlines — drop expired jobs
    // (keep unparseable/missing last_date; the job page shows full status).
    const activeSimilarJobs = useMemo(() => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // last_date itself still counts
        return similarJobs.filter((j) => {
            if (!j.last_date) return true;
            const t = new Date(j.last_date).getTime();
            return isNaN(t) || t >= cutoff;
        });
    }, [similarJobs]);

    const { results, admitCards } = useMemo(() => {
        const pool = (allUpdates || []).filter((u) => u.id !== currentUpdate.id);
        const bucket = (test: (c: string) => boolean) => {
            const items = pool.filter((u) => test(normCat(u.category)));
            // Similar-to-this-exam first; sortByTitleMatch drops low scorers
            // (precision matcher), so backfill with the rest in recency order.
            const similar = sortByTitleMatch(currentUpdate.title, items, (u) => u.title);
            const similarIds = new Set(similar.map((u) => u.id));
            return [...similar, ...items.filter((u) => !similarIds.has(u.id))].slice(0, 10);
        };
        return { results: bucket(isResultCat), admitCards: bucket(isAdmitCat) };
    }, [allUpdates, currentUpdate.id, currentUpdate.title]);

    // ItemList JSON-LD — internal linking signal for crawlers that render JS.
    useEffect(() => {
        const items = [...results, ...admitCards].slice(0, 10);
        if (items.length === 0) return;
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-related-updates-jsonld", "");
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: items.map((u, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${SITE_URL}/exam-update/${u.slug || u.id}`,
                name: u.title,
            })),
        });
        document.head.appendChild(script);
        return () => { script.remove(); };
    }, [results, admitCards]);

    if (results.length === 0 && admitCards.length === 0 && activeSimilarJobs.length === 0) return null;

    return (
        <div className="space-y-6">
            {results.length > 0 && (
                <Rail title="Latest Results" icon={<Award className="h-4 w-4 text-green-600 dark:text-green-400" />} accentClass="" seeAllTo="/trending">
                    {results.map((u) => <UpdateMiniCard key={u.id} update={u} />)}
                </Rail>
            )}
            {admitCards.length > 0 && (
                <Rail title="Latest Admit Cards" icon={<FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />} accentClass="" seeAllTo="/trending">
                    {admitCards.map((u) => <UpdateMiniCard key={u.id} update={u} />)}
                </Rail>
            )}
            {activeSimilarJobs.length > 0 && (
                <Rail title="Similar Jobs" icon={<Briefcase className="h-4 w-4 text-primary" />} accentClass="" seeAllTo="/search">
                    {activeSimilarJobs.map((j) => <JobMiniCard key={j.id} job={j} />)}
                </Rail>
            )}
        </div>
    );
}

export default ExamUpdateRelatedRails;
