import { useState, useMemo, useCallback, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Bookmark, ChevronDown, ChevronUp, ExternalLink, FileText, Clock, BarChart3, Download, Share2, Check, Loader2 } from "lucide-react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";

// ─── Types ───────────────────────────────────────────────────────────────

interface SyllabusItem {
    subject?: string;
    section_title?: string;
    topics: string[];
    marks_weightage?: string;
    marks?: number;
    stage_name?: string;
    exam_type?: string;
    total_marks?: number;
    duration_mins?: number;
}

interface SyllabusData {
    exam_name: string;
    syllabus: SyllabusItem[];
    stages?: { stage_name: string; exam_type?: string; total_marks?: number; duration_mins?: number; sections: SyllabusItem[] }[];
    grounding_sources?: string[];
    confidence?: number;
    year?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

const SECTION_COLORS = ["#3B82F6", "#14B8A6", "#22C55E", "#F97316", "#8B5CF6", "#EF4444"];

const getSubjectIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("intelligence") || lower.includes("reasoning")) return "🧠";
    if (lower.includes("awareness") || lower.includes("general knowledge") || lower.includes("gk")) return "🌍";
    if (lower.includes("quantitative") || lower.includes("aptitude") || lower.includes("math")) return "🔢";
    if (lower.includes("english") || lower.includes("comprehension")) return "📖";
    if (lower.includes("computer")) return "💻";
    if (lower.includes("economics") || lower.includes("finance")) return "📊";
    return "📚";
};

// ─── Main Component ──────────────────────────────────────────────────────

export default function SyllabusResult() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();

    const [syllabusData, setSyllabusData] = useState<SyllabusData | null>(
        (location.state?.syllabusData as SyllabusData) || null
    );
    const [loading, setLoading] = useState(false);
    const [activeStageIndex, setActiveStageIndex] = useState(0);
    const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
    const [shared, setShared] = useState(false);

    // ─── Load from cache when opened via shared URL ──────────────────

    useEffect(() => {
        if (syllabusData) return; // already have data from route state
        const examParam = searchParams.get("exam");
        if (!examParam) return;

        const fetchFromCache = async () => {
            setLoading(true);
            try {
                const normalized = examParam.replace(/\s*\d{4}\s*/g, " ").replace(/\s+/g, " ").trim().toUpperCase();

                // Exact match
                let { data } = await (supabase as any)
                    .from("syllabus_cache")
                    .select("syllabus_data, source_urls, year")
                    .eq("exam_name", normalized)
                    .gt("expires_at", new Date().toISOString())
                    .limit(1)
                    .maybeSingle();

                // Fallback ilike
                if (!data) {
                    const words = normalized.split(" ").filter((w: string) => w.length > 2);
                    const pattern = words.length >= 2 ? `%${words[0]}%${words[1]}%` : `${normalized}%`;
                    const { data: fallback } = await (supabase as any)
                        .from("syllabus_cache")
                        .select("syllabus_data, source_urls, year")
                        .ilike("exam_name", pattern)
                        .gt("expires_at", new Date().toISOString())
                        .limit(1)
                        .maybeSingle();
                    if (fallback) data = fallback;
                }

                if (data?.syllabus_data) {
                    const result = data.syllabus_data as SyllabusData;
                    result.grounding_sources = data.source_urls || result.grounding_sources;
                    result.year = result.year || data.year;
                    setSyllabusData(result);
                }
            } catch (e) {
                console.error("Error loading shared syllabus:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchFromCache();
    }, [searchParams, syllabusData]);

    // ─── Generate text summary for sharing ───────────────────────────

    const generateTextSummary = useCallback(() => {
        if (!syllabusData) return "";
        const lines: string[] = [
            `📋 ${syllabusData.exam_name}${syllabusData.year ? ` (${syllabusData.year})` : ""}`,
            "",
        ];
        const sections = syllabusData.stages?.flatMap(s => s.sections) || syllabusData.syllabus || [];
        for (const section of sections) {
            const name = section.subject || section.section_title || "Section";
            lines.push(`📚 ${name}${section.marks ? ` — ${section.marks} marks` : ""}`);
            for (const topic of (section.topics || []).slice(0, 5)) {
                lines.push(`  • ${topic}`);
            }
            if ((section.topics?.length || 0) > 5) lines.push(`  ... and ${section.topics!.length - 5} more topics`);
            lines.push("");
        }
        lines.push("Powered by JobsTrackr — Syllabus Finder");
        return lines.join("\n");
    }, [syllabusData]);

    // ─── Download as PDF ─────────────────────────────────────────────

    const handleDownloadPdf = useCallback(() => {
        if (!syllabusData) return;

        // Build all stages data
        const allStages = syllabusData.stages?.length
            ? syllabusData.stages.map((s) => ({
                name: s.stage_name || "General",
                exam_type: s.exam_type,
                total_marks: s.total_marks,
                duration_mins: s.duration_mins,
                sections: s.sections || [],
            }))
            : (() => {
                const map = new Map<string, { items: SyllabusItem[]; exam_type?: string; total_marks?: number; duration_mins?: number }>();
                for (const item of syllabusData.syllabus || []) {
                    const name = item.stage_name || "General";
                    if (!map.has(name)) map.set(name, { items: [], exam_type: item.exam_type, total_marks: item.total_marks, duration_mins: item.duration_mins });
                    map.get(name)!.items.push(item);
                }
                return Array.from(map.entries()).map(([name, d]) => ({ name, exam_type: d.exam_type, total_marks: d.total_marks, duration_mins: d.duration_mins, sections: d.items }));
            })();

        const stagesHtml = allStages.map((stage, si) => {
            const stageMarks = stage.sections.reduce((s, i) => s + (i.marks || 0), 0);
            const sectionsHtml = stage.sections.map((section, i) => {
                const name = (section.subject || section.section_title || "Section").replace(`${section.stage_name} - `, "");
                const topicsHtml = (section.topics || []).filter(Boolean).map(t => `<li>${t}</li>`).join("");
                return `
                    <div class="section">
                        <div class="section-header">
                            <span class="section-name">${name}</span>
                            ${section.marks ? `<span class="section-marks">${section.marks} Marks</span>` : ""}
                        </div>
                        ${topicsHtml ? `<ul class="topics">${topicsHtml}</ul>` : '<p class="no-topics">No topics listed</p>'}
                    </div>
                `;
            }).join("");

            return `
                <div class="stage">
                    ${allStages.length > 1 ? `<h2 class="stage-title">📋 ${stage.name}</h2>` : ""}
                    <div class="stats-row">
                        <div class="stat"><span class="stat-label">Type</span><span class="stat-value">${stage.exam_type || "Objective"}</span></div>
                        <div class="stat"><span class="stat-label">Total Marks</span><span class="stat-value">${stage.total_marks || stageMarks || "—"}</span></div>
                        <div class="stat"><span class="stat-label">Duration</span><span class="stat-value">${stage.duration_mins ? `${stage.duration_mins} min` : "—"}</span></div>
                        <div class="stat"><span class="stat-label">Sections</span><span class="stat-value">${stage.sections.length}</span></div>
                    </div>
                    ${sectionsHtml}
                </div>
            `;
        }).join('<hr class="stage-divider">');

        const sourcesHtml = (syllabusData.grounding_sources || []).slice(0, 5).map(url =>
            `<li><a href="${url}">${url.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}</a></li>`
        ).join("");

        const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${syllabusData.exam_name} — Syllabus</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 32px; max-width: 900px; margin: 0 auto; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; color: #111; margin-bottom: 6px; }
    .header .meta { display: flex; justify-content: center; gap: 12px; font-size: 12px; color: #666; }
    .header .meta span { background: #f0f4ff; color: #2563eb; padding: 2px 10px; border-radius: 12px; font-weight: 600; }
    .stage { margin-bottom: 8px; }
    .stage-title { font-size: 18px; color: #2563eb; margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .stage-divider { border: none; border-top: 2px dashed #d1d5db; margin: 28px 0; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .stat-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; font-weight: 600; }
    .stat-value { display: block; font-size: 15px; font-weight: 700; color: #111; margin-top: 2px; }
    .section { background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 12px; break-inside: avoid; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .section-name { font-size: 14px; font-weight: 700; color: #111; }
    .section-marks { font-size: 11px; font-weight: 600; background: #e8f0fe; color: #2563eb; padding: 3px 10px; border-radius: 6px; }
    .topics { list-style: none; padding: 0; columns: 2; column-gap: 24px; }
    .topics li { font-size: 12px; color: #444; padding: 3px 0 3px 16px; position: relative; break-inside: avoid; }
    .topics li::before { content: "•"; position: absolute; left: 0; color: #2563eb; font-weight: bold; }
    .no-topics { font-size: 12px; color: #999; font-style: italic; }
    .sources { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    .sources h3 { font-size: 13px; color: #666; margin-bottom: 8px; }
    .sources li { font-size: 11px; color: #2563eb; margin-bottom: 4px; list-style: none; }
    .sources a { color: #2563eb; text-decoration: none; }
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print { body { padding: 16px; } .section { break-inside: avoid; } }
</style>
</head><body>
    <div class="header">
        <h1>${syllabusData.exam_name}</h1>
        <div class="meta">
            ${syllabusData.year ? `<span>${syllabusData.year}</span>` : ""}
            ${syllabusData.confidence && syllabusData.confidence >= 0.8 ? '<span>✓ Verified</span>' : ""}
            <span>${allStages.length} Stage${allStages.length > 1 ? "s" : ""}</span>
        </div>
    </div>
    ${stagesHtml}
    ${sourcesHtml ? `<div class="sources"><h3>📎 Sources</h3><ul>${sourcesHtml}</ul></div>` : ""}
    <div class="footer">Generated by JobsTrackr — Syllabus Finder</div>
</body></html>`;

        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.onload = () => {
                setTimeout(() => printWindow.print(), 300);
            };
        }
    }, [syllabusData]);

    // ─── Share ───────────────────────────────────────────────────────

    const handleShare = useCallback(async () => {
        if (!syllabusData) return;
        const examSlug = encodeURIComponent(syllabusData.exam_name);
        const shareUrl = `${window.location.origin}/syllabus/result?exam=${examSlug}`;
        const shareTitle = `${syllabusData.exam_name} — Syllabus`;

        const shareData = {
            title: shareTitle,
            text: `Check out the syllabus for ${syllabusData.exam_name}`,
            url: shareUrl,
        };

        try {
            if (navigator.share && navigator.canShare?.(shareData)) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                toast({ title: "Link copied!", description: "Shareable syllabus link copied to clipboard." });
                setTimeout(() => setShared(false), 2000);
            }
        } catch (e: any) {
            if (e?.name !== "AbortError") {
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                toast({ title: "Link copied!", description: "Shareable syllabus link copied to clipboard." });
                setTimeout(() => setShared(false), 2000);
            }
        }
    }, [syllabusData, toast]);

    // Loading state (when opened via shared link)
    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 pb-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading syllabus...</p>
                <BottomNav />
            </div>
        );
    }

    // No data found
    if (!syllabusData) {
        const examParam = searchParams.get("exam");
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 pb-20">
                <p className="text-muted-foreground">{examParam ? `No cached syllabus found for "${examParam}".` : "No syllabus data found."}</p>
                <button onClick={() => navigate("/syllabus")} className="text-primary text-sm font-medium hover:underline">
                    ← Back to Syllabus Finder
                </button>
                <BottomNav />
            </div>
        );
    }

    // ─── Compute stages ────────────────────────────────────────────────

    const stages = useMemo(() => {
        if (syllabusData.stages?.length) {
            return syllabusData.stages.map((s) => ({
                name: s.stage_name || "General",
                exam_type: s.exam_type,
                total_marks: s.total_marks,
                duration_mins: s.duration_mins,
                sections: s.sections || [],
            }));
        }
        const stageMap = new Map<string, { items: SyllabusItem[]; exam_type?: string; total_marks?: number; duration_mins?: number }>();
        for (const item of syllabusData.syllabus || []) {
            const name = item.stage_name || "General";
            if (!stageMap.has(name)) stageMap.set(name, { items: [], exam_type: item.exam_type, total_marks: item.total_marks, duration_mins: item.duration_mins });
            stageMap.get(name)!.items.push(item);
        }
        return Array.from(stageMap.entries()).map(([name, d]) => ({ name, exam_type: d.exam_type, total_marks: d.total_marks, duration_mins: d.duration_mins, sections: d.items }));
    }, [syllabusData]);

    const activeStage = stages.length > 0 ? stages[activeStageIndex] || stages[0] : null;
    const activeSections = activeStage?.sections || syllabusData.syllabus || [];
    const totalMarks = useMemo(() => activeSections.reduce((s, i) => s + (i.marks || 0), 0), [activeSections]);

    const toggleSection = (index: number) => setExpandedSections((prev) => ({ ...prev, [index]: !prev[index] }));

    // ─── Render ────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-2">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate("/syllabus")}
                        className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 text-primary-foreground dark:text-foreground" />
                    </button>
                    <div className="flex items-center gap-2">
                        <img src={logoColor} alt="JobsTrackr" className="h-7 sm:h-8 w-auto dark:hidden" />
                        <img src={logoWhite} alt="JobsTrackr" className="h-7 sm:h-8 w-auto hidden dark:block" />
                        <span className="font-display font-bold text-base sm:text-lg text-primary-foreground dark:text-foreground tracking-wider">SYLLABUS</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadPdf}
                            className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
                            title="Download PDF"
                        >
                            <Download className="h-4 w-4 text-primary-foreground dark:text-foreground" />
                        </button>
                        <button
                            onClick={handleShare}
                            className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
                            title="Share"
                        >
                            {shared ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4 text-primary-foreground dark:text-foreground" />}
                        </button>
                    </div>
                </div>
            </header>

            <main id="syllabus-content" className="px-4 py-4 space-y-4">
                {/* Exam Header */}
                <div className="border-b border-border pb-4">
                    <h2 className="text-lg font-bold text-foreground">{syllabusData.exam_name}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {syllabusData.year && (
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">{syllabusData.year}</span>
                        )}
                        {syllabusData.confidence && syllabusData.confidence >= 0.8 && (
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center gap-1">
                                ✓ Verified
                            </span>
                        )}
                    </div>
                </div>

                {/* Stage Tabs */}
                {stages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {stages.map((stage, i) => (
                            <button
                                key={i}
                                onClick={() => { setActiveStageIndex(i); setExpandedSections({}); }}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${activeStageIndex === i
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                                    }`}
                            >
                                {stage.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card border border-border rounded-xl p-3">
                        <FileText className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wide">TYPE</p>
                        <p className="text-sm font-bold text-foreground">{activeStage?.exam_type || "Objective"}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3">
                        <BarChart3 className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wide">MARKS</p>
                        <p className="text-sm font-bold text-foreground">{activeStage?.total_marks || totalMarks || "—"}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3">
                        <Clock className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wide">TIME</p>
                        <p className="text-sm font-bold text-foreground">{activeStage?.duration_mins ? `${activeStage.duration_mins}m` : "—"}</p>
                    </div>
                </div>

                {/* Weightage Chart */}
                {activeSections.length > 0 && totalMarks > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1">WEIGHTAGE ANALYSIS</p>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-lg font-bold text-foreground">{activeSections.length} Sections</span>
                            <span className="text-xs font-semibold text-primary">
                                {activeSections.every((s) => s.marks === activeSections[0]?.marks) ? "Equal Distribution" : "Weighted"}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {activeSections.map((section, i) => {
                                const pct = totalMarks > 0 ? ((section.marks || 0) / totalMarks) * 100 : 0;
                                const name = (section.subject || section.section_title || "Section").replace(`${section.stage_name} - `, "");
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-24 truncate">{name}</span>
                                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: SECTION_COLORS[i % SECTION_COLORS.length] }} />
                                        </div>
                                        <span className="text-xs font-semibold text-muted-foreground w-8 text-right">{section.marks || 0}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Section Cards */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-foreground">Detailed Syllabus</h3>
                        {syllabusData.year && <span className="text-xs text-muted-foreground">Updated: {syllabusData.year}</span>}
                    </div>

                    <div className="space-y-3">
                        {activeSections.map((item, i) => {
                            const isExpanded = expandedSections[i] ?? false;
                            const name = (item.subject || item.section_title || "Section").replace(`${item.stage_name} - `, "");
                            const topicCount = item.topics?.length || 0;
                            const preview = item.topics?.slice(0, 3).join(", ") || "";
                            const icon = getSubjectIcon(name);
                            const color = SECTION_COLORS[i % SECTION_COLORS.length];

                            return (
                                <div key={i} className="bg-card border border-border rounded-xl p-4">
                                    {/* Section Header */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${color}20` }}>
                                            {icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-foreground truncate">{name}</h4>
                                        </div>
                                        {item.marks && (
                                            <span className="text-xs font-semibold bg-secondary text-foreground px-3 py-1 rounded-lg shrink-0">
                                                {item.marks} Marks
                                            </span>
                                        )}
                                    </div>

                                    {/* Preview */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                        {preview ? `${preview}...` : "No topics available"}
                                    </p>

                                    {/* Expanded Topics */}
                                    {isExpanded && (
                                        <div className="border-t border-border pt-3 mb-3 space-y-2">
                                            {item.topics?.filter(Boolean).map((topic, ti) => (
                                                <div key={ti} className="flex items-start gap-2.5">
                                                    <div className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                                                    <span className="text-sm text-muted-foreground leading-relaxed">{String(topic)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Toggle Button */}
                                    <button
                                        className="flex items-center justify-between w-full pt-3 border-t border-border"
                                        onClick={() => toggleSection(i)}
                                    >
                                        <span className="text-xs font-bold text-primary tracking-wider">
                                            {isExpanded ? "HIDE TOPICS" : `VIEW ${topicCount} TOPICS`}
                                        </span>
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sources */}
                {syllabusData.grounding_sources && syllabusData.grounding_sources.length > 0 && (
                    <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" /> Sources
                        </h4>
                        <div className="space-y-2">
                            {syllabusData.grounding_sources.slice(0, 3).map((url, i) => (
                                <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-primary/5 text-primary text-sm px-3 py-2.5 rounded-lg hover:bg-primary/10 transition-colors"
                                >
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{url.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
