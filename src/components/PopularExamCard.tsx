import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OrganizationLogo } from "@/components/OrganizationLogo";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { TrendingExam } from "@/hooks/useTrendingExams";

/** Compact 1000 → 1k formatter for the tracking count. */
function formatCount(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(num);
}

/**
 * Compact exam card for the homepage "Popular Exams" row. Styled to match the
 * app's other exam/job cards (ActiveExamCard): a conducting-body logo, the exam
 * name, and a category badge on a clean card surface. Tapping it opens the
 * exam's updates page, matching TrendingExamCard's navigation target.
 */
export function PopularExamCard({ exam }: { exam: TrendingExam }) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(exam.conducting_body || "") || exam.logo_url || null;

  return (
    <Link
      to={`/updates/${exam.update_slug || exam.id}`}
      className="block flex-shrink-0 snap-start no-underline"
      aria-label={exam.name}
    >
      <div className="w-[160px] sm:w-[180px] h-[150px] sm:h-[160px] p-3 sm:p-4 rounded-2xl bg-white dark:bg-card shadow-lg border border-border/50 flex flex-col transition-all hover:bg-gray-50 dark:hover:bg-card/90 hover:scale-[1.02]">
        <div className="flex items-center justify-between mb-2">
          <OrganizationLogo
            logoUrl={logoUrl}
            name={exam.conducting_body || exam.name}
            containerClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden"
            imageClassName="w-6 h-6 sm:w-8 sm:h-8 object-contain"
            iconClassName="h-4 w-4 sm:h-5 sm:w-5 text-primary"
          />
          {exam.tracking_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Users className="h-3 w-3" />
              {formatCount(exam.tracking_count)}
            </span>
          )}
        </div>

        <h3 className="font-bold text-foreground text-xs sm:text-sm leading-tight flex-1 line-clamp-3">
          {exam.name}
        </h3>

        {exam.category ? (
          <Badge
            variant="secondary"
            className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full w-fit mt-2 shrink-0 capitalize"
          >
            {exam.category}
          </Badge>
        ) : exam.conducting_body ? (
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-2 shrink-0">
            {exam.conducting_body}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default PopularExamCard;
