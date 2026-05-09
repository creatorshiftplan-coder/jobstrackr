import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useExamUpdateById } from "@/hooks/useExamUpdates";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
    ArrowLeft, Calendar, ExternalLink, Download, Newspaper,
    FileText, Award, BarChart3, Key, Sparkles, ChevronDown, AlertCircle, Tag
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";

// ── Category config (same as card) ───────────────────────────────────
function getCategoryConfig(category: string) {
    const cat = category?.toLowerCase().replace(/[_\s]+/g, "") || "";
    if (cat.includes("result") || cat.includes("merit") || cat.includes("score"))
        return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30", label: "Result", icon: Award, gradient: "from-green-500/20 to-emerald-500/10", accent: "#22c55e" };
    if (cat.includes("admit") || cat.includes("hall") || cat.includes("ticket"))
        return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Admit Card", icon: FileText, gradient: "from-blue-500/20 to-sky-500/10", accent: "#3b82f6" };
    if (cat.includes("answer") || cat.includes("key"))
        return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", label: "Answer Key", icon: Key, gradient: "from-purple-500/20 to-violet-500/10", accent: "#8b5cf6" };
    if (cat.includes("cutoff") || cat.includes("cut"))
        return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", label: "Cutoff", icon: BarChart3, gradient: "from-orange-500/20 to-amber-500/10", accent: "#f97316" };
    if (cat.includes("syllabus") || cat.includes("pattern"))
        return { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30", label: "Syllabus", icon: FileText, gradient: "from-indigo-500/20 to-blue-500/10", accent: "#6366f1" };
    return { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", border: "border-gray-500/30", label: "News", icon: Newspaper, gradient: "from-gray-500/10 to-slate-500/5", accent: "#6b7280" };
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
    const [expandedSection, setExpandedSection] = useState<number | null>(null);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    if (error || !update) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
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
    const isNew = update.created_at
        ? Date.now() - new Date(update.created_at).getTime() < 24 * 60 * 60 * 1000
        : false;
    const timeAgo = update.scraped_at
        ? formatDistanceToNow(new Date(update.scraped_at), { addSuffix: true })
        : "";

    return (
        <div className="min-h-screen bg-background pb-20">
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                {/* Back */}
                <button
                    onClick={() => navigate("/trending")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Trending
                </button>

                {/* ── Header ───────────────────────────────────── */}
                <Section>
                    <Card className={cn("overflow-hidden border-l-4")} style={{ borderLeftColor: catConfig.accent }}>
                        <div className={cn("h-1 bg-gradient-to-r", catConfig.gradient)} />
                        <div className="p-4 space-y-2">
                            <div className="flex items-start gap-3">
                                <div className={cn("flex-shrink-0 rounded-lg p-2 mt-0.5", catConfig.bg)}>
                                    <CatIcon className={cn("h-5 w-5", catConfig.text)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <Badge variant="outline" className={cn("text-[10px] font-semibold capitalize", catConfig.text, catConfig.border)}>
                                            {catConfig.label}
                                        </Badge>
                                        {update.status && (
                                            <Badge variant="secondary" className="text-[10px]">{update.status}</Badge>
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
                                    {update.published_date && (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Published: {update.published_date}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </Section>

                {/* ── Summary ──────────────────────────────────── */}
                {update.summary && (
                    <Section delay={0.05}>
                        <Card className="p-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">{update.summary}</p>
                        </Card>
                    </Section>
                )}

                {/* ── Tags ─────────────────────────────────────── */}
                {update.tags && update.tags.length > 0 && (
                    <Section delay={0.07}>
                        <div className="flex flex-wrap gap-1.5 items-center">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            {update.tags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ── Important Dates ───────────────────────────── */}
                {update.important_dates && update.important_dates.length > 0 && (
                    <Section delay={0.1}>
                        <Card className="p-4 space-y-3">
                            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-500" /> Important Dates
                            </h2>
                            <div className="space-y-1.5">
                                {update.important_dates.map((d, i) => (
                                    <div key={i} className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-xs", i % 2 === 0 ? "bg-secondary/30" : "")}>
                                        <span className="flex-1 text-muted-foreground">{d.event}</span>
                                        <span className="font-semibold text-foreground whitespace-nowrap">{d.date}</span>
                                        {d.link && (
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
                        <Card className="p-4 space-y-3">
                            <h2 className="text-sm font-bold text-foreground">Overview</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {update.overview.map((item, i) => (
                                    <div key={i} className="flex gap-2 bg-secondary/30 rounded-md px-3 py-2 text-xs">
                                        <span className="text-muted-foreground min-w-[80px]">{item.field}</span>
                                        <span className="font-medium text-foreground">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Download Links ────────────────────────────── */}
                {update.download_links && update.download_links.length > 0 && (
                    <Section delay={0.14}>
                        <Card className="p-4 space-y-3">
                            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Download className="h-4 w-4 text-blue-500" /> Quick Links
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {update.download_links.map((dl, i) => (
                                    <a
                                        key={i}
                                        href={dl.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        {dl.text.length > 40 ? dl.text.slice(0, 40) + "…" : dl.text}
                                    </a>
                                ))}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Sections accordion ────────────────────────── */}
                {update.sections && update.sections.length > 0 && (
                    <Section delay={0.16}>
                        <Card className="p-4 space-y-2">
                            <h2 className="text-sm font-bold text-foreground">Details</h2>
                            <div className="space-y-1.5">
                                {update.sections.map((s, i) => (
                                    <div key={i} className="border border-border/40 rounded-lg overflow-hidden">
                                        <button
                                            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
                                            onClick={() => setExpandedSection(expandedSection === i ? null : i)}
                                        >
                                            <span className="line-clamp-1">{s.heading}</span>
                                            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform ml-2", expandedSection === i && "rotate-180")} />
                                        </button>
                                        {expandedSection === i && (
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

                {/* ── Related Articles ─────────────────────────── */}
                {update.related_articles && update.related_articles.length > 0 && (
                    <Section delay={0.18}>
                        <Card className="p-4 space-y-3">
                            <h2 className="text-sm font-bold text-foreground">Related Articles</h2>
                            <div className="space-y-1.5">
                                {update.related_articles.map((ra, i) => (
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

            </div>
            <BottomNav />
        </div>
    );
}
