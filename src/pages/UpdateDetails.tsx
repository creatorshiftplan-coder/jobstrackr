import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useUpdateBySlug, useRelatedUpdates } from "@/hooks/useUpdateBySlug";
import { useJobForExam } from "@/hooks/useJobForExam";
import { getExamStatusType, getBadgeConfig as getStatusBadgeConfig } from "@/lib/examStatus";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
    ArrowLeft, Calendar, ExternalLink, Lightbulb, Share2, BookOpen,
    Award, Clock, Users, BadgeDollarSign, ChevronRight
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function UpdateDetails() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data: exam, isLoading, error } = useUpdateBySlug(slug || "");
    const { data: matchingJob } = useJobForExam(exam?.name);
    const { data: relatedUpdates } = useRelatedUpdates(
        exam?.id || "",
        exam?.category || null,
        exam?.conducting_body || null
    );

    // Redirect to slug if loaded by UUID
    useEffect(() => {
        if (exam && (exam as any).update_slug && slug !== (exam as any).update_slug) {
            navigate(`/updates/${(exam as any).update_slug}`, { replace: true });
        }
    }, [exam, slug, navigate]);

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/updates/${slug}`;
        const shareText = exam ? `${exam.name} — Check latest updates on JobsTrackr` : 'Check latest updates on JobsTrackr';
        const shareData = { title: exam?.name || 'Update', text: shareText, url: shareUrl };

        if (navigator.share && navigator.canShare?.(shareData)) {
            try { await navigator.share(shareData); } catch { }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                toast({ title: "Link copied to clipboard!" });
            } catch {
                toast({ title: "Failed to copy link", variant: "destructive" });
            }
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    if (error || !exam) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <h2 className="text-xl font-bold">Update Not Found</h2>
                    <p className="text-muted-foreground">This update may have been removed or the link is incorrect.</p>
                    <button onClick={() => navigate('/trending')} className="px-4 py-2 bg-primary text-white rounded-lg">
                        Back to Trending
                    </button>
                </div>
            </div>
        );
    }

    const aiData = exam.ai_cached_response || {} as any;
    const statusType = getExamStatusType(aiData);
    const badge = getStatusBadgeConfig(statusType);
    const timeAgo = exam.ai_last_updated_at
        ? formatDistanceToNow(new Date(exam.ai_last_updated_at), { addSuffix: true })
        : null;

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Back button */}
                <button onClick={() => navigate('/trending')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Trending
                </button>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <Card className="p-5 border-l-4" style={{ borderLeftColor: badge.color }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: badge.color }}>
                                        {badge.label}
                                    </span>
                                    {exam.conducting_body && (
                                        <span className="text-xs text-muted-foreground">{exam.conducting_body}</span>
                                    )}
                                    {timeAgo && (
                                        <span className="text-xs text-muted-foreground">• {timeAgo}</span>
                                    )}
                                </div>
                                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                                    {exam.name}
                                </h1>
                            </div>
                            <button onClick={handleShare} className="p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors flex-shrink-0" title="Share">
                                <Share2 className="h-5 w-5" />
                            </button>
                        </div>
                    </Card>
                </motion.div>

                {/* Latest News */}
                {aiData.summary && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-blue-500" /> Latest News
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">{aiData.summary}</p>
                        </Card>
                    </motion.div>
                )}

                {/* Updates Timeline */}
                {aiData.latest_updates && aiData.latest_updates.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <Card className="p-5 space-y-4">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Clock className="h-5 w-5 text-purple-500" /> Updates Timeline
                            </h2>
                            <div className="space-y-0 relative ml-3">
                                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-border" />
                                {aiData.latest_updates.map((update: any, i: number) => {
                                    const text = typeof update === 'string' ? update : (update.description || update.title || '');
                                    const title = typeof update === 'object' && update.title ? update.title : null;
                                    return (
                                        <div key={i} className="relative pl-6 pb-4">
                                            <span className="absolute left-[-4px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: badge.color }} />
                                            {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
                                            <p className="text-sm text-muted-foreground">{text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Phase Details */}
                {aiData.predicted_events && aiData.predicted_events.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-orange-500" /> Phase Details & Expected Dates
                            </h2>
                            <div className="space-y-2">
                                {aiData.predicted_events.map((event: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-secondary/30">
                                        <span className="text-sm font-medium text-foreground">{event.event_type}</span>
                                        <span className="text-sm text-muted-foreground">{event.predicted_date || 'TBA'}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Important Dates */}
                {aiData.exam_dates && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <Card className="p-5 space-y-2">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-red-500" /> Important Dates
                            </h2>
                            <p className="text-sm text-muted-foreground">{aiData.exam_dates}</p>
                        </Card>
                    </motion.div>
                )}

                {/* Eligibility */}
                {aiData.eligibility && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Card className="p-5 space-y-2">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Award className="h-5 w-5 text-green-500" /> Eligibility
                            </h2>
                            <p className="text-sm text-muted-foreground">{aiData.eligibility}</p>
                        </Card>
                    </motion.div>
                )}

                {/* Recommendations */}
                {aiData.recommendations && aiData.recommendations.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Lightbulb className="h-5 w-5 text-amber-500" /> Recommendations
                            </h2>
                            <ul className="space-y-3">
                                {aiData.recommendations.map((rec: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                        <Lightbulb className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-muted-foreground">{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </motion.div>
                )}

                {/* Linked Job Details */}
                {matchingJob && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <Card className="p-5 space-y-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-600" /> Job Details
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                {matchingJob.vacancies && (
                                    <div className="bg-white dark:bg-card rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground uppercase">Vacancies</p>
                                        <p className="font-semibold text-foreground">{matchingJob.vacancies}</p>
                                    </div>
                                )}
                                {(matchingJob.salary_min || matchingJob.salary_max) && (
                                    <div className="bg-white dark:bg-card rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground uppercase">Salary</p>
                                        <p className="font-semibold text-foreground">
                                            {matchingJob.salary_min && matchingJob.salary_max
                                                ? `₹${matchingJob.salary_min.toLocaleString('en-IN')} – ₹${matchingJob.salary_max.toLocaleString('en-IN')}`
                                                : matchingJob.salary_min ? `₹${matchingJob.salary_min.toLocaleString('en-IN')}+` : `Up to ₹${matchingJob.salary_max?.toLocaleString('en-IN')}`}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {matchingJob.slug && (
                                <Link to={`/jobs/${matchingJob.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                                    View Full Job Details <ExternalLink className="h-4 w-4" />
                                </Link>
                            )}
                        </Card>
                    </motion.div>
                )}

                {/* Related Updates */}
                {relatedUpdates && relatedUpdates.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground">Related Updates</h2>
                            <div className="space-y-2">
                                {relatedUpdates.map((re) => {
                                    const reStatus = getExamStatusType(re.ai_cached_response);
                                    const reBadge = getStatusBadgeConfig(reStatus);
                                    const reSlug = (re as any).update_slug || re.id;
                                    return (
                                        <Link key={re.id} to={`/updates/${reSlug}`} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground line-clamp-1">{re.name}</p>
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${reBadge.color}15`, color: reBadge.color }}>{reBadge.label}</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Official Website */}
                {exam.official_website && (
                    <div className="text-center">
                        <a href={exam.official_website} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors">
                            Visit Official Website <ExternalLink className="h-4 w-4" />
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
