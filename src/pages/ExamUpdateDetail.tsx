import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useExamUpdateById } from "@/hooks/useExamUpdates";
import { useJob } from "@/hooks/useJobs";
import { useJobForExam } from "@/hooks/useJobForExam";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { OrganizationLogo } from "@/components/OrganizationLogo";
import { formatDistanceToNow, format } from "date-fns";
import { motion } from "framer-motion";
import {
    ArrowLeft, Calendar, ExternalLink, Download, Newspaper,
    FileText, Award, BarChart3, Key, Sparkles, ChevronDown, AlertCircle, Tag, Share2,
    Globe, Send, Copy, BellRing, MessageCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";
import { isPdfOrWebsiteLink, getExamPdfWebsiteLinks, isFreeJobAlertUrl } from "@/lib/urlUtils";
import { ExamUpdateRelatedRails } from "@/components/ExamUpdateRelatedRails";
import { SITE_URL } from "@/lib/seoConfig";

// ── Category config (same as card) ───────────────────────────────────
function getCategoryConfig(category: string) {
    const cat = category?.toLowerCase().replace(/[_\s]+/g, "") || "";
    if (cat.includes("result") || cat.includes("merit") || cat.includes("score"))
        return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30", label: "Result", icon: Award, gradient: "from-green-500/20 to-emerald-500/10", accent: "#16a34a", cta: "Check Result" };
    if (cat.includes("admit") || cat.includes("hall") || cat.includes("ticket"))
        return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Admit Card", icon: FileText, gradient: "from-blue-500/20 to-sky-500/10", accent: "#2563eb", cta: "Download Admit Card" };
    if (cat.includes("answer") || cat.includes("key"))
        return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", label: "Answer Key", icon: Key, gradient: "from-purple-500/20 to-violet-500/10", accent: "#7c3aed", cta: "View Answer Key" };
    if (cat.includes("cutoff") || cat.includes("cut"))
        return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", label: "Cutoff", icon: BarChart3, gradient: "from-orange-500/20 to-amber-500/10", accent: "#ea580c", cta: "View Cutoff" };
    if (cat.includes("syllabus") || cat.includes("pattern"))
        return { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30", label: "Syllabus", icon: FileText, gradient: "from-indigo-500/20 to-blue-500/10", accent: "#4f46e5", cta: "View Syllabus" };
    return { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", border: "border-gray-500/30", label: "News", icon: Newspaper, gradient: "from-gray-500/10 to-slate-500/5", accent: "#6b7280", cta: "View Update" };
}

// Green for "live" statuses, red for closed ones, neutral otherwise.
function getDateStatusClasses(status: string) {
    const s = status.toLowerCase();
    if (/declar|out|released|available|active|start|open|live/.test(s))
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
    if (/clos|over|expir|end|last/.test(s))
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    return "bg-secondary text-muted-foreground border-border/50";
}

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}>
            {children}
        </motion.div>
    );
}

export default function ExamUpdateDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: update, isLoading, error } = useExamUpdateById(id);
    const { data: job } = useJob(update?.job_id || "");
    const { data: fuzzyJob } = useJobForExam(update?.title || "");
    const activeJob = job || fuzzyJob;
    const { getLogoByName } = useConductingBodyLogos();
    const logoUrl = getLogoByName(activeJob?.department || "");

    // First detail section open by default so the page never looks empty.
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
    const toggleSection = (i: number) =>
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i); else next.add(i);
            return next;
        });

    // seoConfig marks /exam-update/ as skipTitle/skipDescription — this page
    // owns its own head tags. NewsArticle JSON-LD rides along for crawlers.
    useEffect(() => {
        if (!update) return;
        document.title = `${update.title} | JobsTrackr`;
        const desc = (update.summary?.trim() || `Latest update: ${update.title}`).replace(/\s+/g, " ").slice(0, 160);
        const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
            let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
            if (!el) {
                el = document.createElement("meta");
                el.setAttribute(attr, key);
                document.head.appendChild(el);
            }
            el.setAttribute("content", content);
        };
        upsertMeta("name", "description", desc);
        upsertMeta("property", "og:title", update.title);
        upsertMeta("property", "og:description", desc);
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-exam-update-jsonld", "");
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: update.title.slice(0, 110),
            description: desc,
            datePublished: update.created_at,
            dateModified: update.updated_at || update.created_at,
            mainEntityOfPage: `${SITE_URL}/exam-update/${update.slug || update.id}`,
            publisher: { "@type": "Organization", name: "JobsTrackr", url: SITE_URL },
        });
        document.head.appendChild(script);
        return () => { script.remove(); };
    }, [update]);

    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/exam-update/${update?.slug || id}`;
    const shareText = update ? `${update.title} — Check latest updates on JobsTrackr` : "Check latest updates on JobsTrackr";

    const handleShare = async () => {
        const shareData = { title: update?.title || 'Update', text: shareText, url: shareUrl };
        if (navigator.share && navigator.canShare?.(shareData)) {
            try { await navigator.share(shareData); } catch { }
        } else {
            handleCopyLink();
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
            toast.success("Link copied to clipboard!");
        } catch {
            toast.error("Failed to copy link");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    if (error || !update) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="text-center space-y-4">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h2 className="text-xl font-bold">Update Not Found</h2>
                    <p className="text-muted-foreground text-sm">This update may have been removed or the link is incorrect.</p>
                    <button onClick={() => navigate("/trending")} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
                        Back to Trending
                    </button>
                </div>
            </div>
        );
    }

    const catConfig = getCategoryConfig(update.category);
    const CatIcon = catConfig.icon;
    // Only surface real PDF / official-website links — never WhatsApp or Telegram share links.
    const pdfLinks = getExamPdfWebsiteLinks(update);
    const websiteArticles = (update.related_articles || []).filter((ra) => isPdfOrWebsiteLink(ra.url) && !isFreeJobAlertUrl(ra.url));
    const isNew = update.created_at
        ? Date.now() - new Date(update.created_at).getTime() < 24 * 60 * 60 * 1000
        : false;
    const timeAgo = update.scraped_at
        ? formatDistanceToNow(new Date(update.scraped_at), { addSuffix: true })
        : "";
    const lastUpdated = update.updated_at
        ? formatDistanceToNow(new Date(update.updated_at), { addSuffix: true })
        : timeAgo;
    // published_date may be an ISO timestamp or free text ("9 July 2026") — never show raw ISO.
    const publishedDisplay = (() => {
        if (!update.published_date) return "";
        const d = new Date(update.published_date);
        return isNaN(d.getTime()) ? update.published_date : format(d, "d MMMM yyyy");
    })();

    // Some scraped sections have headings but no body (their data lives in the
    // overview table instead) — an expanded-empty panel just looks broken.
    // Source sites also inject their own subscribe/alert promos into article
    // bodies; those lines advertise the competitor, not the exam.
    const PROMO_LINE_RE = /custom govt job alerts|join (our )?(telegram|whatsapp)|follow us on|subscribe (to )?(our|us)/i;
    const contentSections = (update.sections || [])
        .map((s) => ({ ...s, content: (s.content || []).filter((line) => line.trim() && !PROMO_LINE_RE.test(line)) }))
        .filter((s) => s.content.length > 0);

    // Hero CTAs: the action link (PDF / result page) + the official website, competitor-style.
    const actionLink =
        pdfLinks.find((l) => /\.pdf(\?|$)/i.test(l.url) || /result|admit|answer|merit|list|cutoff|download|score/i.test(l.text)) ||
        pdfLinks[0];
    const officialLink = pdfLinks.find(
        (l) => l !== actionLink && (/official|website|home/i.test(l.text) || /\.(gov|nic)\.in/i.test(l.url))
    ) || pdfLinks.find((l) => l !== actionLink);

    return (
        <div className="min-h-screen bg-background pb-28">
            {/* Sticky Header */}
            <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-md border-b border-border/50 shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between px-4 py-3 gap-3 max-w-2xl mx-auto">
                    <button
                        onClick={() => navigate("/trending")}
                        className="p-2 -ml-2 rounded-full hover:bg-secondary active:scale-95 transition-all flex-shrink-0"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    </button>
                    <h1 className="flex-1 font-semibold text-sm text-foreground truncate">{update.title}</h1>
                    <button
                        onClick={handleShare}
                        className="p-2 -mr-2 rounded-full hover:bg-secondary active:scale-95 transition-all flex-shrink-0"
                        title="Share"
                    >
                        <Share2 className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    </button>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* ── Header ───────────────────────────────────── */}
                <Section>
                    <Card className={cn("overflow-hidden border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl border-l-4")} style={{ borderLeftColor: catConfig.accent }}>
                        <div className={cn("h-1 bg-gradient-to-r", catConfig.gradient)} />
                        <div className="p-4 flex items-start gap-4">
                            <OrganizationLogo
                                logoUrl={logoUrl}
                                name={activeJob?.department || update.title}
                                containerClassName="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
                                imageClassName="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                                iconClassName="h-6 w-6 sm:h-7 sm:w-7 text-primary"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <Badge variant="outline" className={cn("text-[10px] font-semibold capitalize", catConfig.text, catConfig.border)}>
                                        <CatIcon className="h-3 w-3 mr-1" />{catConfig.label}
                                    </Badge>
                                    {update.status && (
                                        <Badge variant="outline" className={cn("text-[10px] font-semibold capitalize", catConfig.bg, catConfig.text, catConfig.border)}>
                                            {update.status}
                                        </Badge>
                                    )}
                                    {isNew && (
                                        <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                                            <Sparkles className="h-3 w-3 mr-1" />New
                                        </Badge>
                                    )}
                                    {timeAgo && <span className="text-[11px] text-muted-foreground">{timeAgo}</span>}
                                </div>
                                <h1 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                                    {update.title}
                                </h1>
                                {activeJob?.department && (
                                    <p className="text-xs text-muted-foreground font-semibold mt-1">
                                        {activeJob.department}
                                    </p>
                                )}
                                {publishedDisplay && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Published: {publishedDisplay}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Primary actions — the #1 reason users open this page */}
                        {actionLink && (
                            <div className="px-4 pb-4 flex flex-col sm:flex-row gap-2">
                                <a
                                    href={actionLink.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                                    style={{ backgroundColor: catConfig.accent }}
                                >
                                    <Download className="h-4 w-4" />
                                    {catConfig.cta}
                                </a>
                                {officialLink && (
                                    <a
                                        href={officialLink.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border bg-secondary/40 text-foreground hover:bg-secondary active:scale-[0.98] transition-all"
                                    >
                                        <Globe className="h-4 w-4" />
                                        Official Website
                                    </a>
                                )}
                            </div>
                        )}
                    </Card>
                </Section>

                {/* ── Connected Job Details Banner ──────────────── */}
                {activeJob && (
                    <Section delay={0.03}>
                        <Link
                            to={`/jobs/${activeJob.slug || activeJob.id}`}
                            className="block"
                        >
                            <Card className="p-4 border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-950/10 dark:to-indigo-950/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground/80 font-medium">Recruitment Details</p>
                                    <h3 className="text-sm font-bold text-foreground line-clamp-1">{activeJob.title}</h3>
                                    {activeJob.vacancies_display && (
                                        <p className="text-[11px] text-primary font-semibold">{activeJob.vacancies_display} Vacancies</p>
                                    )}
                                </div>
                                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                                    View Job Details <ExternalLink className="h-3.5 w-3.5" />
                                </div>
                            </Card>
                        </Link>
                    </Section>
                )}

                {/* ── Summary ──────────────────────────────────── */}
                {update.summary && (
                    <Section delay={0.05}>
                        <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5">
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{update.summary}</p>
                        </Card>
                    </Section>
                )}


                {/* ── Important Dates ───────────────────────────── */}
                {update.important_dates && update.important_dates.length > 0 && (
                    <Section delay={0.1}>
                        <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-500" /> Important Dates
                            </h2>
                            <div className="divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden">
                                {update.important_dates.map((d, i) => (
                                    <div key={i} className={cn("flex items-start gap-2 px-3 py-2.5 text-xs", i % 2 === 0 ? "bg-secondary/20" : "bg-transparent")}>
                                        <span className="flex-1 min-w-0 break-words text-muted-foreground">{d.event}</span>
                                        {d.status && (
                                            <span className={cn("px-1.5 py-0.5 rounded-full border text-[9px] font-semibold capitalize whitespace-nowrap flex-shrink-0", getDateStatusClasses(d.status))}>
                                                {d.status}
                                            </span>
                                        )}
                                        <span className="flex-shrink-0 font-semibold text-foreground whitespace-nowrap">{d.date}</span>
                                        {d.link && isPdfOrWebsiteLink(d.link) && !isFreeJobAlertUrl(d.link) && (
                                            <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Overview ─────────────────────────────────── */}
                {update.overview && update.overview.length > 0 && (
                    <Section delay={0.12}>
                        <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-bold text-foreground">Overview</h2>
                            <div className="divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden">
                                {update.overview.map((item, i) => (
                                    <div key={i} className={cn("flex gap-3 px-3 py-2.5 text-xs", i % 2 === 0 ? "bg-secondary/20" : "bg-transparent")}>
                                        <span className="text-muted-foreground w-[38%] flex-shrink-0">{item.field}</span>
                                        <span className="font-medium text-foreground flex-1 break-words">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Sections accordion ────────────────────────── */}
                {contentSections.length > 0 && (
                    <Section delay={0.16}>
                        <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-bold text-foreground">Details</h2>
                            <div className="space-y-1.5">
                                {contentSections.map((s, i) => (
                                    <div key={i} className="border border-border/40 rounded-lg overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
                                            onClick={() => toggleSection(i)}
                                        >
                                            <span className="line-clamp-1">{s.heading}</span>
                                            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform ml-2", expandedSections.has(i) && "rotate-180")} />
                                        </button>
                                        {expandedSections.has(i) && (
                                            <div className="px-3 py-2.5 text-xs text-muted-foreground space-y-1.5 bg-secondary/10">
                                                {s.content.map((line, li) => (
                                                    <p key={li} className="leading-relaxed">{line}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Important Links (repeated at bottom, competitor-style) ── */}
                {pdfLinks.length > 0 && (
                    <Section delay={0.18}>
                        <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Download className="h-4 w-4 text-blue-500" /> Important Links
                            </h2>
                            <div className="space-y-1.5">
                                {pdfLinks.map((dl, i) => (
                                    <a
                                        key={i}
                                        href={dl.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs font-medium text-foreground"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="line-clamp-1">{dl.text.length > 60 ? dl.text.slice(0, 60) + "…" : dl.text}</span>
                                        <ExternalLink className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                    </a>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Related Articles ─────────────────────────── */}
                {websiteArticles.length > 0 && (
                    <Section delay={0.2}>
                        <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5 space-y-4">
                            <h2 className="text-sm font-bold text-foreground">Related Articles</h2>
                            <div className="space-y-1.5">
                                {websiteArticles.map((ra, i) => (
                                    <a
                                        key={i}
                                        href={ra.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs font-medium text-foreground"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-3 w-3 text-primary flex-shrink-0" />
                                        <span className="line-clamp-1">{ra.title}</span>
                                    </a>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Share ────────────────────────────────────── */}
                <Section delay={0.22}>
                    <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-card rounded-2xl p-5 space-y-3">
                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-primary" /> Share this update
                        </h2>
                        <div className="grid grid-cols-3 gap-2">
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#25D366] hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                <MessageCircle className="h-4 w-4" /> WhatsApp
                            </a>
                            <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#229ED9] hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                <Send className="h-4 w-4" /> Telegram
                            </a>
                            <button
                                onClick={handleCopyLink}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-border bg-secondary/40 text-foreground hover:bg-secondary active:scale-[0.98] transition-all"
                            >
                                <Copy className="h-4 w-4" /> Copy Link
                            </button>
                        </div>
                    </Card>
                </Section>

                {/* ── Stay Updated CTA ─────────────────────────── */}
                <Section delay={0.24}>
                    <Card className="border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                                <BellRing className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Never miss an update</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Track your exams and get results, admit cards & answer keys in one place.</p>
                            </div>
                        </div>
                        <Link
                            to="/my-exams"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all shadow-sm flex-shrink-0"
                        >
                            Track Exams
                        </Link>
                    </Card>
                </Section>

                {/* ── Related rails: Results / Admit Cards / Similar Jobs ── */}
                <Section delay={0.26}>
                    <ExamUpdateRelatedRails currentUpdate={update} jobId={activeJob?.id} />
                </Section>

                {/* ── Tags + footnote ──────────────────────────── */}
                <Section delay={0.28}>
                    <div className="space-y-2 pt-2">
                        {update.tags && update.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                {update.tags.map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                                ))}
                            </div>
                        )}
                        {lastUpdated && (
                            <p className="text-[11px] text-muted-foreground">Last updated {lastUpdated}. Always verify details on the official website.</p>
                        )}
                    </div>
                </Section>

            </div>
            <BottomNav />
        </div>
    );
}
