import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExamUpdateItem } from "@/hooks/useExamUpdates";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { FileText, Award, BarChart3, Newspaper, Download, Key, Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { getExamPdfWebsiteLinks } from "@/lib/urlUtils";
import { ImportantDateChips } from "@/components/ImportantDatesList";
import { linkLabel } from "@/lib/linkLabels";

interface ExamUpdateCardProps {
    update: ExamUpdateItem;
    index: number;
}

function getCategoryConfig(category: string): { bg: string; text: string; border: string; label: string; icon: typeof FileText; gradient: string } {
    const cat = category?.toLowerCase().replace(/[_\s]+/g, "") || "";
    if (cat.includes("result") || cat.includes("merit") || cat.includes("score"))
        return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30", label: "Result", icon: Award, gradient: "from-green-500/20 to-emerald-500/10" };
    if (cat.includes("admit") || cat.includes("hall") || cat.includes("ticket"))
        return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Admit Card", icon: FileText, gradient: "from-blue-500/20 to-sky-500/10" };
    if (cat.includes("answer") || cat.includes("key"))
        return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", label: "Answer Key", icon: Key, gradient: "from-purple-500/20 to-violet-500/10" };
    if (cat.includes("cutoff") || cat.includes("cut"))
        return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", label: "Cutoff", icon: BarChart3, gradient: "from-orange-500/20 to-amber-500/10" };
    if (cat.includes("syllabus") || cat.includes("pattern"))
        return { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30", label: "Syllabus", icon: FileText, gradient: "from-indigo-500/20 to-blue-500/10" };
    return { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", border: "border-gray-500/30", label: "News", icon: Newspaper, gradient: "from-gray-500/10 to-slate-500/5" };
}

function getTimeAgo(dateStr?: string | null): string {
    if (!dateStr) return "";
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
        return "";
    }
}

function isNew(createdAt?: string | null): boolean {
    if (!createdAt) return false;
    try {
        const created = new Date(createdAt).getTime();
        return Date.now() - created < 24 * 60 * 60 * 1000;
    } catch {
        return false;
    }
}

export function ExamUpdateCard({ update, index }: ExamUpdateCardProps) {
    const navigate = useNavigate();
    const detailPath = `/exam-update/${update.id}`;
    const catConfig = getCategoryConfig(update.category);
    const CatIcon = catConfig.icon;
    const timeAgo = getTimeAgo(update.scraped_at);
    const newBadge = isNew(update.created_at);

    // Real exam PDF / official-website links only — WhatsApp/Telegram/source links dropped.
    const examLinks = getExamPdfWebsiteLinks(update);
    const topLinks = examLinks.slice(0, 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
        >
            {/* Card navigates via onClick (not a wrapping <Link>) so the external
                PDF/website <a> chips inside don't create invalid nested anchors. */}
            <Card
                onClick={() => navigate(detailPath)}
                className={cn("overflow-hidden border hover:shadow-md hover:scale-[1.005] hover:bg-muted/10 transition-all duration-200 cursor-pointer", newBadge && "ring-1 ring-green-500/30")}
            >
                    {/* Gradient accent bar */}
                    <div className={cn("h-0.5 bg-gradient-to-r", catConfig.gradient)} />

                    <div className="p-3 space-y-2">
                        {/* Header */}
                        <div className="flex items-start gap-2.5">
                            <div className={cn("flex-shrink-0 rounded-md p-1.5", catConfig.bg)}>
                                <CatIcon className={cn("h-4 w-4", catConfig.text)} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <Badge variant="outline" className={cn("text-[10px] font-semibold capitalize px-1.5 py-0", catConfig.text, catConfig.border)}>
                                        {catConfig.label}
                                    </Badge>
                                    {update.status && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                            {update.status}
                                        </Badge>
                                    )}
                                    {newBadge && (
                                        <Badge className="bg-green-100 text-green-700 border-0 text-[10px] px-1.5 py-0">
                                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />New
                                        </Badge>
                                    )}
                                    {timeAgo && (
                                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo}</span>
                                    )}
                                </div>
                                <h3 className="font-semibold text-foreground leading-snug line-clamp-2 text-sm">
                                    {update.title}
                                </h3>
                            </div>
                        </div>

                        {/* 1-line summary */}
                        {update.summary && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 pl-[34px]">
                                {update.summary}
                            </p>
                        )}

                        {/* Top 2 important dates — normalized, so the scraped
                            "Event — Date" header row never leads the card */}
                        <ImportantDateChips dates={update.important_dates} limit={2} className="pl-[34px]" />

                        {/* PDF / official-website link chips */}
                        {topLinks.length > 0 && (
                            <div className="pl-[34px] flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {topLinks.map((link, i) => {
                                    const isPdf = /\.pdf($|\?)/i.test(link.url);
                                    // Sources label nearly every link "Click here" — two of those
                                    // side by side are indistinguishable, so name the destination.
                                    const text = linkLabel(link.text, link.url, update.category);
                                    const label = text.length > 32 ? text.slice(0, 32) + "…" : text;
                                    return (
                                        <a
                                            key={i}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                        >
                                            {isPdf ? <FileText className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                                            {label}
                                        </a>
                                    );
                                })}
                            </div>
                        )}

                        {/* Footer — internal detail link only */}
                        <div className="pl-[34px] pt-1.5 border-t border-border/30">
                            <Link
                                to={detailPath}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                View Details <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                    </div>
                </Card>
        </motion.div>
    );
}

export default ExamUpdateCard;
