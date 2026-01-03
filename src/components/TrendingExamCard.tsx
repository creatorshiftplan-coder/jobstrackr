import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingExam, CATEGORY_GRADIENTS } from "@/hooks/useTrendingExams";
import { formatDistanceToNow, differenceInDays, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { getExamStatusType, getBadgeConfig as getStatusBadgeConfig, ExamStatusType } from "@/lib/examStatus";
import { TrendingUp, Users, Clock, Calendar, Lightbulb, ChevronDown, ChevronRight, Bookmark, ExternalLink, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useSaveJob, useUnsaveJob, useIsJobSaved } from "@/hooks/useSavedJobs";
import { useAuth } from "@/hooks/useAuth";
import { useJobForExam } from "@/hooks/useJobForExam";

interface TrendingExamCardProps {
    exam: TrendingExam;
    index: number;
    initialExpanded?: boolean;
}

// Sector-specific images
const SECTOR_IMAGES: Record<string, string> = {
    Banking: "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=800&q=80",
    SSC: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80",
    Railways: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80",
    Defence: "https://images.unsplash.com/photo-1579912437766-7896df6d3cd3?w=800&q=80",
    UPSC: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80",
    Teaching: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80",
    State: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    default: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80",
};

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

// Get time ago string
function getTimeAgo(dateStr?: string | null): string {
    if (!dateStr) return "";
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: false }) + " ago";
    } catch {
        return "";
    }
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

// Featured Card - for Notification/Upcoming badges (with hero image)
function FeaturedCard({ exam, index, initialExpanded = false }: TrendingExamCardProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const statusType = getExamStatusType(exam.ai_cached_response);
    const badge = getStatusBadgeConfig(statusType);
    const timeAgo = getTimeAgo(exam.ai_last_updated_at);
    const summary = exam.ai_cached_response?.summary || "Tap to view the latest updates for this exam.";
    const sectorImage = SECTOR_IMAGES[exam.category || "default"] || SECTOR_IMAGES.default;

    // Find matching job for this exam
    const { data: matchingJob, isLoading: isLoadingJob } = useJobForExam(exam.name);
    const jobId = matchingJob?.id;

    // Save job functionality - use matching job ID if found
    const { mutate: saveJob, isPending: isSaving } = useSaveJob();
    const { mutate: unsaveJob, isPending: isUnsaving } = useUnsaveJob();
    const isSaved = useIsJobSaved(jobId || "");
    const { user } = useAuth();

    const handleSaveToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
            toast({ title: "Please login to save jobs" });
            return;
        }
        if (!jobId) {
            toast({ title: "No matching job found to save" });
            return;
        }
        if (isSaved) {
            unsaveJob(jobId);
        } else {
            saveJob(jobId);
        }
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/trending?exam=${exam.id}`;
        const shareText = `${badge.label} for "${exam.name}" - View all the news and updates`;
        const shareData = { title: exam.name, text: shareText, url: shareUrl };

        if (navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                toast({ title: "Link copied to clipboard!" });
            } catch {
                toast({ title: "Failed to copy link", variant: "destructive" });
            }
        }
    };

    const handleViewDetails = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (jobId) {
            navigate(`/job/${jobId}`);
        } else if (exam.official_website) {
            window.open(exam.official_website, '_blank', 'noopener,noreferrer');
        } else {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(exam.name + ' official website')}`, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.1, 0.5) }}
        >
            <Card className="overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 group">
                {/* Hero Image with Gradient Overlay */}
                <div
                    className="relative h-48 sm:h-56 bg-cover bg-center"
                    style={{ backgroundImage: `url(${sectorImage})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                    {/* Content over image */}
                    <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end">
                        {/* Badge Row */}
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                                style={{ backgroundColor: badge.color }}
                            >
                                {badge.label}
                            </span>
                            {timeAgo && (
                                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                                    <span className="w-1 h-1 rounded-full bg-white/50" />
                                    {timeAgo}
                                </div>
                            )}
                        </div>

                        {/* Title */}
                        <h3 className="text-lg sm:text-xl font-bold text-white leading-tight mb-2 line-clamp-2">
                            {exam.name}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-white/80 line-clamp-2 mb-3">
                            {summary}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleViewDetails}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
                            >
                                View Details
                                <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                                onClick={handleSaveToggle}
                                disabled={isSaving || isUnsaving}
                                className={cn(
                                    "p-2 rounded-full backdrop-blur-sm transition-colors",
                                    isSaved
                                        ? "bg-primary text-white hover:bg-primary/90"
                                        : "bg-white/20 hover:bg-white/30"
                                )}
                            >
                                <Bookmark className={cn("h-5 w-5", isSaved ? "fill-current" : "text-white")} />
                            </button>
                            <button
                                onClick={handleShare}
                                className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors"
                                title="Share"
                            >
                                <Share2 className="h-5 w-5 text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}


// Simple Card - for other status types (clean white card)
function SimpleCard({ exam, index, initialExpanded = false }: TrendingExamCardProps) {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const navigate = useNavigate();
    const statusType = getExamStatusType(exam.ai_cached_response);
    const badge = getStatusBadgeConfig(statusType);
    const timeAgo = getTimeAgo(exam.ai_last_updated_at);
    const summary = exam.ai_cached_response?.summary || "Tap to view updates.";
    const statusData = exam.ai_cached_response;
    const countdown = getCountdown(statusData?.last_date_to_apply || statusData?.exam_dates);

    // Find matching job for this exam
    const { data: matchingJob } = useJobForExam(exam.name);
    const jobId = matchingJob?.id;

    // Sync expanded state when initialExpanded changes (e.g., from URL param)
    useEffect(() => {
        if (initialExpanded) {
            setIsExpanded(true);
        }
    }, [initialExpanded]);

    const handleViewDetails = () => {
        if (jobId) {
            navigate(`/job/${jobId}`);
        } else if (exam.official_website) {
            window.open(exam.official_website, '_blank', 'noopener,noreferrer');
        } else {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(exam.name + ' official website')}`, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.1, 0.5) }}
        >
            <Card className="overflow-hidden border shadow-lg hover:shadow-xl transition-all duration-300">
                {/* Header - Clickable to expand */}
                <div
                    className="p-4 border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            {/* Badge Row */}
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className="px-2 py-0.5 rounded-full text-xs font-medium border"
                                    style={{
                                        backgroundColor: `${badge.color}15`,
                                        borderColor: `${badge.color}30`,
                                        color: badge.color
                                    }}
                                >
                                    {badge.label}
                                </span>
                                {timeAgo && (
                                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                                )}
                            </div>

                            {/* Title */}
                            <h3 className="font-semibold text-foreground leading-tight line-clamp-1">
                                {exam.name}
                            </h3>
                        </div>

                        <div className="p-1">
                            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        </div>
                    </div>
                </div>

                {/* Content - only show when collapsed */}
                {!isExpanded && (
                    <div className="p-4 space-y-4">
                        {/* Summary */}
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {summary}
                        </p>

                        {/* Countdown Stats */}
                        {countdown && (
                            <div className="flex flex-wrap gap-2">
                                <div className="flex-1 min-w-[80px] max-w-[120px] bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-900/30 rounded-xl p-3 text-center">
                                    <Calendar className="h-4 w-4 text-red-500 mx-auto mb-1" />
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                        {countdown.days}
                                    </p>
                                    <p className="text-xs text-red-600/80 dark:text-red-400/80 uppercase tracking-wide font-medium">
                                        {countdown.label} left
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Expanded Content */}
                {isExpanded && statusData && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="px-4 pb-4 space-y-4 border-t border-border relative"
                    >
                        {/* Share Button */}
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                const shareUrl = `${window.location.origin}/trending?exam=${exam.id}`;
                                const shareText = `${badge.label} for "${exam.name}" - View all the news and updates`;
                                const shareData = {
                                    title: exam.name,
                                    text: shareText,
                                    url: shareUrl,
                                };

                                if (navigator.share && navigator.canShare?.(shareData)) {
                                    try {
                                        await navigator.share(shareData);
                                    } catch (err) {
                                        if ((err as Error).name !== 'AbortError') {
                                            console.error('Share failed:', err);
                                        }
                                    }
                                } else {
                                    // Fallback: copy to clipboard
                                    try {
                                        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                                        // Use document.createElement for toast-like notification
                                        const toast = document.createElement('div');
                                        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2 rounded-lg text-sm z-50';
                                        toast.textContent = 'Link copied to clipboard!';
                                        document.body.appendChild(toast);
                                        setTimeout(() => toast.remove(), 2000);
                                    } catch (err) {
                                        // Fallback for browsers without clipboard API
                                        const textArea = document.createElement("textarea");
                                        textArea.value = `${shareText}\n${shareUrl}`;
                                        textArea.style.position = "fixed";
                                        textArea.style.left = "-999999px";
                                        document.body.appendChild(textArea);
                                        textArea.select();
                                        document.execCommand("copy");
                                        document.body.removeChild(textArea);
                                    }
                                }
                            }}
                            className="absolute top-2 right-4 p-2.5 rounded-full bg-secondary/30 hover:bg-secondary/60 transition-colors"
                            title="Share this update"
                        >
                            <Share2 className="h-5 w-5 text-foreground" />
                        </button>

                        {/* Full Summary / News */}
                        {statusData.summary && (
                            <div className="space-y-2 pt-3 pr-10">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Latest News</h4>
                                <p className="text-sm text-foreground leading-relaxed">
                                    {statusData.summary}
                                </p>
                            </div>
                        )}

                        {/* Latest Updates */}
                        {statusData.latest_updates && statusData.latest_updates.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updates</h4>
                                <ul className="space-y-2">
                                    {statusData.latest_updates.map((update, i) => (
                                        <li key={i} className="text-sm text-foreground">
                                            • {typeof update === 'string' ? update : (update as any).description || (update as any).title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Recommendations */}
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

                        {/* Important Dates */}
                        {statusData.exam_dates && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Important Dates</h4>
                                <p className="text-sm text-foreground">{statusData.exam_dates}</p>
                            </div>
                        )}

                        {/* Eligibility */}
                        {statusData.eligibility && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eligibility</h4>
                                <p className="text-sm text-foreground">{statusData.eligibility}</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Footer */}
                <div className="px-4 pb-4 pt-2 border-t border-border flex items-center justify-between">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                        {isExpanded ? "Hide Updates" : "Read Updates"}
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                    </button>

                    <button
                        onClick={handleViewDetails}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                        View Full Details
                        <ExternalLink className="h-4 w-4" />
                    </button>
                </div>
            </Card>
        </motion.div>
    );
}

// Main exported component - chooses card type based on badge
export function TrendingExamCard({ exam, index, initialExpanded }: TrendingExamCardProps) {
    const statusType = getExamStatusType(exam.ai_cached_response);

    // Use FeaturedCard for Notification and Upcoming badges
    const useFeaturedStyle = statusType === 'notification' || statusType === 'upcoming';

    if (useFeaturedStyle) {
        return <FeaturedCard exam={exam} index={index} initialExpanded={initialExpanded} />;
    }

    return <SimpleCard exam={exam} index={index} initialExpanded={initialExpanded} />;
}

export default TrendingExamCard;
