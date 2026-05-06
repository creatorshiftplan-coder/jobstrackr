import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useUpdateBySlug, useRelatedUpdates } from "@/hooks/useUpdateBySlug";
import { useJobForExam } from "@/hooks/useJobForExam";
import { getExamStatusType, getBadgeConfig as getStatusBadgeConfig, ExamStatusType } from "@/lib/examStatus";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
    ArrowLeft, Calendar, ExternalLink, Lightbulb, Share2, BookOpen,
    Award, Clock, Users, Briefcase, GraduationCap, IndianRupee,
    ChevronRight, Bell, FileText, ClipboardCheck, PenLine, Trophy, AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";

// ── Milestone timeline config ─────────────────────────────────────
const MILESTONES = [
    { key: "notification", icon: Bell, label: "Notification Released", color: "#3b82f6" },
    { key: "application", icon: PenLine, label: "Application Started", color: "#8b5cf6" },
    { key: "admit_card", icon: FileText, label: "Admit Card Released", color: "#f59e0b" },
    { key: "exam_scheduled", icon: ClipboardCheck, label: "Exam Scheduled", color: "#a855f7" },
    { key: "result", icon: Trophy, label: "Result Declared", color: "#22c55e" },
];

// Map status type to milestone progress
function getMilestoneProgress(statusType: ExamStatusType): number {
    const progressMap: Record<string, number> = {
        upcoming: 0, notification: 1, admit_pending: 2,
        date_change: 2, exam_date_released: 3,
        admit_card: 3, exam_scheduled: 4, result: 5,
    };
    return progressMap[statusType] ?? 1;
}

// ── Animated section wrapper ──────────────────────────────────────
function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
            {children}
        </motion.div>
    );
}

// ── Main Component ───────────────────────────────────────────────
export default function UpdateDetails() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data: exam, isLoading, error } = useUpdateBySlug(slug || "");
    const { data: matchingJob } = useJobForExam(exam?.name);
    const { data: relatedUpdates } = useRelatedUpdates(
        exam?.id || "", exam?.category || null, exam?.conducting_body || null
    );

    // Redirect to canonical slug URL
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

    // ── Loading / Error states ────────────────────────────────────
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
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
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
    const milestoneProgress = getMilestoneProgress(statusType);
    const year = new Date().getFullYear();
    const timeAgo = exam.ai_last_updated_at
        ? formatDistanceToNow(new Date(exam.ai_last_updated_at), { addSuffix: true })
        : null;

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

                {/* ── Back ─────────────────────────────────────────── */}
                <button onClick={() => navigate('/trending')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Trending
                </button>

                {/* ── Header Card ───────────────────────────────────── */}
                <Section>
                    <Card className="p-5 border-l-4" style={{ borderLeftColor: badge.color }}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: badge.color }}>
                                        {badge.label}
                                    </span>
                                    {exam.conducting_body && <span className="text-xs text-muted-foreground">{exam.conducting_body}</span>}
                                    {timeAgo && <span className="text-xs text-muted-foreground">• Updated {timeAgo}</span>}
                                </div>
                                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{exam.name}</h1>
                            </div>
                            <button onClick={handleShare} className="p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors flex-shrink-0" title="Share">
                                <Share2 className="h-5 w-5" />
                            </button>
                        </div>
                    </Card>
                </Section>

                {/* ══════════════════════════════════════════════════
                   SECTION 1: MILESTONE TIMELINE (SEO BOOST)
                   ══════════════════════════════════════════════════ */}
                <Section delay={0.05}>
                    <Card className="p-5 space-y-4">
                        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Clock className="h-5 w-5 text-indigo-500" /> Recruitment Progress
                        </h2>
                        <div className="relative">
                            {MILESTONES.map((ms, i) => {
                                const Icon = ms.icon;
                                const reached = i < milestoneProgress;
                                const isCurrent = i === milestoneProgress - 1;
                                return (
                                    <div key={ms.key} className="flex items-start gap-3 relative">
                                        {/* Vertical line */}
                                        {i < MILESTONES.length - 1 && (
                                            <div
                                                className="absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-8px)]"
                                                style={{ backgroundColor: reached ? ms.color : 'var(--border)' }}
                                            />
                                        )}
                                        {/* Icon circle */}
                                        <div
                                            className="relative z-10 flex items-center justify-center w-[30px] h-[30px] rounded-full flex-shrink-0"
                                            style={{
                                                backgroundColor: reached ? ms.color : 'transparent',
                                                border: reached ? 'none' : '2px solid var(--border)',
                                            }}
                                        >
                                            <Icon className="h-4 w-4" style={{ color: reached ? 'white' : 'var(--muted-foreground)' }} />
                                        </div>
                                        {/* Label */}
                                        <div className="pb-5 pt-1">
                                            <p className={`text-sm font-medium ${reached ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {ms.label}
                                                {isCurrent && (
                                                    <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full text-white" style={{ backgroundColor: ms.color }}>
                                                        Current
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </Section>

                {/* ══════════════════════════════════════════════════
                   SECTION 2: LATEST NEWS
                   ══════════════════════════════════════════════════ */}
                {aiData.summary && (
                    <Section delay={0.1}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-blue-500" /> Latest News
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{aiData.summary}</p>
                        </Card>
                    </Section>
                )}

                {/* ══════════════════════════════════════════════════
                   SECTION 3: UPDATES TIMELINE (Chronological)
                   ══════════════════════════════════════════════════ */}
                {aiData.latest_updates && aiData.latest_updates.length > 0 && (
                    <Section delay={0.15}>
                        <Card className="p-5 space-y-4">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Clock className="h-5 w-5 text-purple-500" /> Updates Timeline
                            </h2>
                            <div className="relative ml-3">
                                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-border" />
                                {aiData.latest_updates.map((update: any, i: number) => {
                                    const text = typeof update === 'string' ? update : (update.description || update.title || '');
                                    const title = typeof update === 'object' && update.title ? update.title : null;
                                    return (
                                        <div key={i} className="relative pl-6 pb-4">
                                            <span className="absolute left-[-4px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: badge.color }} />
                                            {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
                                            <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ══════════════════════════════════════════════════
                   SECTION 4: PHASE DETAILS (Part 1 / Part 2)
                   ══════════════════════════════════════════════════ */}
                {aiData.predicted_events && aiData.predicted_events.length > 0 && (
                    <Section delay={0.2}>
                        <Card className="p-5 space-y-4">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 text-orange-500" /> Phase Details
                            </h2>
                            {(() => {
                                // Separate Part 1 vs Part 2 vs Other events
                                const part1 = aiData.predicted_events.filter((e: any) =>
                                    /part.?1|phase.?1|tier.?1|prelim|stage.?1/i.test(e.event_type || '')
                                );
                                const part2 = aiData.predicted_events.filter((e: any) =>
                                    /part.?2|phase.?2|tier.?2|mains|stage.?2/i.test(e.event_type || '')
                                );
                                const other = aiData.predicted_events.filter((e: any) =>
                                    !part1.includes(e) && !part2.includes(e)
                                );

                                const renderPhaseTable = (title: string, events: any[]) => (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                                        <div className="rounded-lg border overflow-hidden">
                                            {events.map((event: any, i: number) => (
                                                <div key={i} className={`flex justify-between items-center px-3 py-2.5 text-sm ${i % 2 === 0 ? 'bg-secondary/20' : ''}`}>
                                                    <span className="font-medium text-foreground">{event.event_type}</span>
                                                    <span className="text-muted-foreground">{event.predicted_date || 'TBA'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );

                                return (
                                    <div className="space-y-4">
                                        {part1.length > 0 && renderPhaseTable("📝 Part 1 / Prelims Exam", part1)}
                                        {part2.length > 0 && renderPhaseTable("📋 Part 2 / Mains Exam", part2)}
                                        {other.length > 0 && renderPhaseTable(
                                            part1.length > 0 || part2.length > 0 ? "📅 Other Events" : "📅 Expected Schedule",
                                            other
                                        )}
                                    </div>
                                );
                            })()}
                        </Card>
                    </Section>
                )}

                {/* ══════════════════════════════════════════════════
                   SECTION 5: EXPECTED / IMPORTANT DATES
                   ══════════════════════════════════════════════════ */}
                {(aiData.exam_dates || aiData.last_date_to_apply) && (
                    <Section delay={0.25}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-red-500" /> Important Dates
                            </h2>
                            <div className="space-y-2">
                                {aiData.last_date_to_apply && (
                                    <div className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                                        <span className="text-sm font-medium text-foreground">Last Date to Apply</span>
                                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">{aiData.last_date_to_apply}</span>
                                    </div>
                                )}
                                {aiData.exam_dates && (
                                    <div className="px-3 py-2.5 rounded-lg bg-secondary/30">
                                        <p className="text-sm text-foreground"><strong>Exam Dates:</strong> {aiData.exam_dates}</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ══════════════════════════════════════════════════
                   SECTION 6: RECOMMENDATIONS
                   ══════════════════════════════════════════════════ */}
                {aiData.recommendations && aiData.recommendations.length > 0 && (
                    <Section delay={0.3}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Lightbulb className="h-5 w-5 text-amber-500" /> Recommendations for Candidates
                            </h2>
                            <ul className="space-y-3">
                                {aiData.recommendations.map((rec: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-bold mt-0.5">
                                            {i + 1}
                                        </span>
                                        <span className="text-muted-foreground leading-relaxed">{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </Section>
                )}

                {/* ══════════════════════════════════════════════════
                   SECTION 7: JOB DETAILS (Eligibility, Vacancy, Selection, Salary)
                   ══════════════════════════════════════════════════ */}
                {matchingJob && (
                    <Section delay={0.35}>
                        <Card className="p-5 space-y-4 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 border-blue-200 dark:border-blue-900/40">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-blue-600" /> Recruitment Details – {matchingJob.title || exam.name}
                            </h2>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Vacancies */}
                                <div className="bg-white dark:bg-card rounded-xl p-3 border">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Users className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Vacancies</span>
                                    </div>
                                    <p className="font-bold text-foreground text-lg">
                                        {matchingJob.vacancies_display || matchingJob.vacancies || 'Check notification'}
                                    </p>
                                </div>

                                {/* Salary */}
                                <div className="bg-white dark:bg-card rounded-xl p-3 border">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <IndianRupee className="h-3.5 w-3.5 text-green-500" />
                                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Salary</span>
                                    </div>
                                    <p className="font-bold text-foreground text-lg">
                                        {matchingJob.salary_min && matchingJob.salary_max
                                            ? `₹${matchingJob.salary_min.toLocaleString('en-IN')} – ₹${matchingJob.salary_max.toLocaleString('en-IN')}`
                                            : matchingJob.salary_min
                                                ? `₹${matchingJob.salary_min.toLocaleString('en-IN')}+`
                                                : 'Not disclosed'}
                                    </p>
                                </div>

                                {/* Age Limit */}
                                {(matchingJob.age_min || matchingJob.age_max) && (
                                    <div className="bg-white dark:bg-card rounded-xl p-3 border">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Award className="h-3.5 w-3.5 text-orange-500" />
                                            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Age Limit</span>
                                        </div>
                                        <p className="font-bold text-foreground text-lg">
                                            {matchingJob.age_min && matchingJob.age_max
                                                ? `${matchingJob.age_min} – ${matchingJob.age_max} years`
                                                : matchingJob.age_min ? `${matchingJob.age_min}+ years` : `Up to ${matchingJob.age_max} years`}
                                        </p>
                                    </div>
                                )}

                                {/* Qualification */}
                                {matchingJob.qualification && (
                                    <div className="bg-white dark:bg-card rounded-xl p-3 border">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <GraduationCap className="h-3.5 w-3.5 text-purple-500" />
                                            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Qualification</span>
                                        </div>
                                        <p className="font-semibold text-foreground text-sm">{matchingJob.qualification}</p>
                                    </div>
                                )}
                            </div>

                            {/* Eligibility */}
                            {(matchingJob.eligibility || aiData.eligibility) && (
                                <div className="bg-white dark:bg-card rounded-xl p-4 border space-y-1">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                        <Award className="h-4 w-4 text-green-500" /> Eligibility Criteria
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {matchingJob.eligibility || aiData.eligibility}
                                    </p>
                                </div>
                            )}

                            {/* Selection Process */}
                            {matchingJob.description && (
                                <div className="bg-white dark:bg-card rounded-xl p-4 border space-y-1">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                        <ClipboardCheck className="h-4 w-4 text-indigo-500" /> Selection Process
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{matchingJob.description}</p>
                                </div>
                            )}

                            {/* CTA */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {matchingJob.slug && (
                                    <Link to={`/jobs/${matchingJob.slug}`}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors">
                                        View Full Job Details <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                )}
                                {matchingJob.apply_link && (
                                    <a href={matchingJob.apply_link} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-colors">
                                        Apply Now <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                )}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* Eligibility fallback if no matching job but AI has it */}
                {!matchingJob && aiData.eligibility && (
                    <Section delay={0.35}>
                        <Card className="p-5 space-y-2">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Award className="h-5 w-5 text-green-500" /> Eligibility
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">{aiData.eligibility}</p>
                        </Card>
                    </Section>
                )}

                {/* ══════════════════════════════════════════════════
                   SECTION 8: RELATED UPDATES (SEO Internal Links)
                   ══════════════════════════════════════════════════ */}
                {relatedUpdates && relatedUpdates.length > 0 && (
                    <Section delay={0.4}>
                        <Card className="p-5 space-y-3">
                            <h2 className="text-base font-bold text-foreground">Related Updates</h2>
                            <div className="space-y-2">
                                {relatedUpdates.map((re) => {
                                    const reStatus = getExamStatusType(re.ai_cached_response);
                                    const reBadge = getStatusBadgeConfig(reStatus);
                                    const reSlug = (re as any).update_slug || re.id;
                                    // SEO keyword-rich anchor text
                                    const anchorText = `${re.name} ${reBadge.label} ${year} Details`;
                                    return (
                                        <Link key={re.id} to={`/updates/${reSlug}`}
                                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors group">
                                            <div className="space-y-1 min-w-0">
                                                <p className="text-sm font-medium text-primary group-hover:underline line-clamp-1" title={anchorText}>
                                                    {anchorText}
                                                </p>
                                                <span className="text-xs px-2 py-0.5 rounded-full inline-block"
                                                    style={{ backgroundColor: `${reBadge.color}15`, color: reBadge.color, border: `1px solid ${reBadge.color}30` }}>
                                                    {reBadge.label}
                                                </span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </Card>
                    </Section>
                )}

                {/* ── Official Website CTA ─────────────────────────── */}
                {exam.official_website && (
                    <div className="text-center py-2">
                        <a href={exam.official_website} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
                            Visit Official Website <ExternalLink className="h-4 w-4" />
                        </a>
                    </div>
                )}

                {/* ── Last Updated footer ──────────────────────────── */}
                <div className="text-center text-xs text-muted-foreground pb-4">
                    Last updated: {exam.ai_last_updated_at ? formatDistanceToNow(new Date(exam.ai_last_updated_at), { addSuffix: true }) : 'Recently'}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
