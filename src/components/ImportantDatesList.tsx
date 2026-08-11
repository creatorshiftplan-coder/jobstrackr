import { useMemo } from "react";
import { Calendar, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeImportantDates, type RawImportantDate } from "@/lib/importantDates";
import { isPdfOrWebsiteLink, isFreeJobAlertUrl } from "@/lib/urlUtils";

/** Green for "live" statuses, red for closed ones, neutral otherwise. */
function getDateStatusClasses(status: string) {
    const s = status.toLowerCase();
    if (/declar|out|released|available|active|start|open|live/.test(s))
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
    if (/clos|over|expir|end|last/.test(s))
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    return "bg-secondary text-muted-foreground border-border/50";
}

interface ImportantDatesListProps {
    dates: RawImportantDate[] | null | undefined;
    /** Rows to show; the rest are dropped (cards use this, detail pages don't). */
    limit?: number;
    className?: string;
}

/**
 * The one place scraped exam dates are rendered as a table.
 *
 * The layout is deliberately content-independent: both columns are `fr` tracks
 * with a zero minimum, so neither can be squeezed out by the other no matter
 * how long the scraped text is. The previous flex layout gave the date column
 * `flex-shrink-0 whitespace-nowrap`, so a sentence-length date (they are
 * common — see lib/importantDates) collapsed the event column to a single
 * character and the label wrapped vertically, one letter per line.
 *
 * Below `sm` the two cells stack — a 320px card cannot hold two readable
 * columns — which also keeps long values off a cramped shared line.
 */
export function ImportantDatesList({ dates, limit, className }: ImportantDatesListProps) {
    const rows = useMemo(() => {
        const clean = normalizeImportantDates(dates);
        return typeof limit === "number" ? clean.slice(0, limit) : clean;
    }, [dates, limit]);

    if (rows.length === 0) return null;

    return (
        <div
            className={cn(
                "divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden",
                className,
            )}
        >
            {rows.map((d, i) => {
                const showLink = d.link && isPdfOrWebsiteLink(d.link) && !isFreeJobAlertUrl(d.link);
                return (
                    <div
                        key={`${d.event}-${d.date}-${i}`}
                        className={cn("px-3 py-2.5", i % 2 === 0 ? "bg-secondary/20" : "bg-transparent")}
                    >
                        <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:items-baseline">
                            <span className="min-w-0 break-words text-xs leading-snug text-muted-foreground">
                                {d.event}
                            </span>
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 sm:justify-end">
                                {d.status && (
                                    <span
                                        className={cn(
                                            "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold capitalize",
                                            getDateStatusClasses(d.status),
                                        )}
                                    >
                                        {d.status}
                                    </span>
                                )}
                                <span className="min-w-0 break-words text-xs font-semibold text-foreground sm:text-right">
                                    {d.date}
                                </span>
                                {showLink && (
                                    <a
                                        href={d.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={`Open link for ${d.event}`}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                        {d.note && (
                            <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground/80">
                                {d.note}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Compact inline chips for card surfaces — same normalization, so a card can
 * never lead with the scraped "Event — Date" header row.
 */
export function ImportantDateChips({
    dates,
    limit = 2,
    className,
}: {
    dates: RawImportantDate[] | null | undefined;
    limit?: number;
    className?: string;
}) {
    const rows = useMemo(() => normalizeImportantDates(dates).slice(0, limit), [dates, limit]);
    if (rows.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-1.5", className)}>
            {rows.map((d, i) => (
                <div
                    key={`${d.event}-${d.date}-${i}`}
                    className="inline-flex max-w-full items-start gap-1.5 rounded bg-secondary/40 px-2 py-1 text-[11px]"
                >
                    <Calendar className="mt-px h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-muted-foreground">{d.event}</span>
                    <span className="min-w-0 break-words font-medium text-foreground">{d.date}</span>
                </div>
            ))}
        </div>
    );
}

export default ImportantDatesList;
