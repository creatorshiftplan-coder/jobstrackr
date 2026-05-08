import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExamUpdateItem } from "@/hooks/useExamUpdates";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ExternalLink, FileText, Award, BarChart3, Newspaper, Calendar, Download, Key } from "lucide-react";
import { motion } from "framer-motion";

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

export function ExamUpdateCard({ update, index }: ExamUpdateCardProps) {
    const catConfig = getCategoryConfig(update.category);
    const CatIcon = catConfig.icon;
    const timeAgo = getTimeAgo(update.scraped_at);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
        >
            <Card className={cn("overflow-hidden border shadow-md hover:shadow-lg transition-all duration-300 group")}>
                {/* Gradient accent bar */}
                <div className={cn("h-1 bg-gradient-to-r", catConfig.gradient)} />

                <div className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                        <div className={cn("flex-shrink-0 rounded-lg p-2", catConfig.bg)}>
                            <CatIcon className={cn("h-5 w-5", catConfig.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge
                                    variant="outline"
                                    className={cn("text-[10px] font-semibold capitalize", catConfig.text, catConfig.border)}
                                >
                                    {catConfig.label}
                                </Badge>
                                {update.status && (
                                    <Badge variant="secondary" className="text-[10px]">
                                        {update.status}
                                    </Badge>
                                )}
                                {timeAgo && (
                                    <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
                                )}
                            </div>
                            <h3 className="font-semibold text-foreground leading-tight line-clamp-2 text-sm sm:text-base">
                                {update.title}
                            </h3>
                        </div>
                    </div>

                    {/* Summary */}
                    {update.summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 pl-[44px]">
                            {update.summary}
                        </p>
                    )}

                    {/* Important Dates */}
                    {update.important_dates && update.important_dates.length > 0 && (
                        <div className="pl-[44px] space-y-1.5">
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Important Dates
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {update.important_dates.slice(0, 4).map((d, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs bg-secondary/40 rounded-md px-2.5 py-1.5">
                                        <span className="text-muted-foreground flex-1 line-clamp-1">{d.event}</span>
                                        <span className="font-medium text-foreground whitespace-nowrap">{d.date}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Overview fields */}
                    {update.overview && update.overview.length > 0 && (
                        <div className="pl-[44px]">
                            <div className="grid grid-cols-2 gap-1.5">
                                {update.overview.slice(0, 4).map((item, i) => (
                                    <div key={i} className="text-xs bg-secondary/30 rounded-md px-2.5 py-1.5">
                                        <span className="text-muted-foreground">{item.field}: </span>
                                        <span className="font-medium text-foreground">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Download Links */}
                    {update.download_links && update.download_links.length > 0 && (
                        <div className="pl-[44px] space-y-1.5">
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                Quick Links
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {update.download_links.slice(0, 4).map((dl, i) => (
                                    <a
                                        key={i}
                                        href={dl.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        {dl.text.length > 30 ? dl.text.slice(0, 30) + "..." : dl.text}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer with source link */}
                    {update.url && (
                        <div className="pl-[44px] pt-1 border-t border-border/40">
                            <a
                                href={update.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                View Full Details
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    );
}

export default ExamUpdateCard;
