import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingExam, CATEGORY_GRADIENTS } from "@/hooks/useTrendingExams";
import { formatDistanceToNow, differenceInDays, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { TrendingUp, Users, Clock, Calendar, Lightbulb, ChevronDown } from "lucide-react";

interface TrendingExamCardProps {
    exam: TrendingExam;
    index: number;
}

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 1000) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (target === 0) return;

        const steps = 30;
        const increment = target / steps;
        const stepDuration = duration / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(current));
            }
        }, stepDuration);

        return () => clearInterval(timer);
    }, [target, duration]);

    return count;
}

// Format large numbers (1234 -> 1.2k)
function formatCount(num: number): string {
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return num.toString();
}

// Calculate countdown
function getCountdown(dateStr?: string): { days: number; label: string } | null {
    if (!dateStr) return null;

    try {
        const date = parseISO(dateStr);
        if (!isValid(date)) return null;

        const days = differenceInDays(date, new Date());
        if (days < 0) return null;

        return { days, label: days === 1 ? "day" : "days" };
    } catch {
        return null;
    }
}

export function TrendingExamCard({ exam, index }: TrendingExamCardProps) {
    const animatedCount = useAnimatedCounter(exam.tracking_count, 800);
    const gradient = CATEGORY_GRADIENTS[exam.category || "default"] || CATEGORY_GRADIENTS["default"];
    const [isExpanded, setIsExpanded] = useState(false);

    const statusData = exam.ai_cached_response;
    const countdown = getCountdown(statusData?.last_date_to_apply || statusData?.exam_dates);

    // Staggered animation delay
    const animationDelay = `${index * 100}ms`;

    return (
        <Card
            className={cn(
                "overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300",
                "hover:scale-[1.02] hover:-translate-y-1",
                "animate-fadeIn"
            )}
            style={{
                animationDelay,
                animationFillMode: 'forwards'
            }}
        >
            {/* Gradient Header - category based */}
            <div
                className="p-4 relative overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, ${gradient.fromColor}, ${gradient.toColor})`
                }}
            >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="relative flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {/* Category Icon */}
                        <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                            {exam.logo_url ? (
                                <img src={exam.logo_url} alt="" className="h-8 w-8 object-contain" />
                            ) : (
                                gradient.icon
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg sm:text-xl leading-tight">
                                {exam.name}
                            </h3>
                            {exam.conducting_body && (
                                <p className="text-white/80 text-sm sm:text-base mt-0.5">
                                    {exam.conducting_body}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Tracking Badge */}
                    <Badge className="bg-white/20 text-white border-0 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {formatCount(animatedCount)}
                    </Badge>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Summary */}
                {statusData?.summary && (
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-2">
                        {statusData.summary}
                    </p>
                )}

                {/* Bento Stats Grid */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {/* Countdown */}
                    {countdown && (
                        <div className="flex-1 min-w-[80px] bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-900/30 rounded-xl p-3 text-center shadow-sm">
                            <Calendar className="h-5 w-5 text-red-500 mx-auto mb-1" />
                            <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                                {countdown.days}
                            </p>
                            <p className="text-xs sm:text-sm text-red-600/80 dark:text-red-400/80 uppercase tracking-wide font-medium">
                                {countdown.label} left
                            </p>
                        </div>
                    )}

                    {/* Status */}
                    {statusData?.current_status && (
                        <div className="flex-1 min-w-[80px] bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-3 text-center flex flex-col justify-center shadow-sm">
                            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                            <p className="text-sm sm:text-base font-semibold text-primary capitalize leading-tight">
                                {statusData.current_status.replace(/_/g, " ")}
                            </p>
                        </div>
                    )}

                    {/* Tracking Count */}
                    <div className="flex-1 min-w-[80px] bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-3 text-center shadow-sm">
                        <Users className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="text-xl sm:text-2xl font-bold text-primary">
                            {formatCount(exam.tracking_count)}
                        </p>
                        <p className="text-xs sm:text-sm text-primary font-semibold uppercase tracking-wide">
                            tracking
                        </p>
                    </div>
                </div>

                {/* Recommendation Tip (collapsed) */}
                {!isExpanded && statusData?.recommendations?.[0] && (
                    <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-xl border border-border/50 shadow-sm">
                        <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground/80 leading-relaxed">
                            {statusData.recommendations[0]}
                        </p>
                    </div>
                )}

                {/* Expanded Content */}
                {isExpanded && statusData && (
                    <div className="space-y-4 pt-2 border-t border-border animate-fadeIn">
                        {/* Full Summary */}
                        {statusData.summary && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</h4>
                                <p className="text-sm text-foreground leading-relaxed">
                                    {statusData.summary}
                                </p>
                            </div>
                        )}

                        {/* All Recommendations */}
                        {statusData.recommendations && statusData.recommendations.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommendations</h4>
                                <ul className="space-y-2">
                                    {statusData.recommendations.map((rec, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-foreground">{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Exam Dates */}
                        {statusData.exam_dates && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Important Dates</h4>
                                <p className="text-sm text-foreground">{statusData.exam_dates}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    {exam.ai_last_updated_at && (
                        <p className="text-xs text-muted-foreground">
                            Updated {formatDistanceToNow(new Date(exam.ai_last_updated_at))} ago
                        </p>
                    )}

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline"
                    >
                        {isExpanded ? "Show less" : "View details"}
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                </div>
            </div>
        </Card >
    );
}
