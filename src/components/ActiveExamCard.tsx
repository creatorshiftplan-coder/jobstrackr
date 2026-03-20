import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { Badge } from "@/components/ui/badge";
import { getExamStatus, ExamAttempt } from "@/lib/examStatusUtils";
import { OrganizationLogo } from "@/components/OrganizationLogo";

interface ActiveExamCardProps {
  attempt: ExamAttempt;
}

export function ActiveExamCard({ attempt }: ActiveExamCardProps) {
  const exam = attempt.exams;
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(exam?.conducting_body || null);
  const status = getExamStatus(attempt);

  return (
    <Link
      to="/tracker"
      className="block flex-shrink-0"
      aria-label={`${exam?.name || "Unknown Exam"} - ${status.label}. Click to view details.`}
    >
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-card backdrop-blur-md shadow-lg border border-border/50 w-[150px] sm:w-[180px] md:w-[200px] h-[130px] sm:h-[150px] md:h-[160px] flex flex-col transition-all hover:bg-gray-50 dark:hover:bg-card/90 hover:scale-[1.02]">
        <div className="flex items-center justify-between mb-2">
          <OrganizationLogo
            logoUrl={logoUrl}
            name={exam?.conducting_body || "Exam"}
            containerClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden"
            imageClassName="w-6 h-6 sm:w-8 sm:h-8 object-contain"
            iconClassName="h-4 w-4 sm:h-5 sm:w-5 text-primary"
          />
        </div>
        <h3 className="font-bold text-foreground text-xs sm:text-sm md:text-sm leading-tight flex-1 line-clamp-3">
          {exam?.name || "Unknown Exam"}
        </h3>
        {/* Status Badge */}
        <Badge
          className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full w-fit mt-2 shrink-0 ${status.color}`}
          aria-label={`Status: ${status.label}`}
        >
          {status.label}
        </Badge>
      </div>
    </Link>
  );
}

