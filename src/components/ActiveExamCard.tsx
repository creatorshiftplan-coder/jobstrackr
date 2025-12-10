import { Link } from "react-router-dom";
import { BookOpen, Calendar } from "lucide-react";

interface ActiveExamCardProps {
  attempt: {
    id: string;
    year: number;
    status?: string | null;
    exams?: {
      name: string;
      conducting_body?: string | null;
    } | null;
  };
}

export function ActiveExamCard({ attempt }: ActiveExamCardProps) {
  const exam = attempt.exams;

  return (
    <Link to="/tracker" className="block flex-shrink-0">
      <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 backdrop-blur-md shadow-lg border border-blue-200/50 dark:border-blue-800/30 w-[150px] sm:w-[180px] h-[120px] sm:h-[140px] flex flex-col transition-all hover:from-blue-100 hover:to-sky-200 dark:hover:from-blue-900/50 dark:hover:to-sky-800/30 hover:scale-[1.02]">
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
        </div>
        <h3 className="font-bold text-foreground text-xs sm:text-sm mb-auto line-clamp-2">
          {exam?.name || "Unknown Exam"}
        </h3>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-primary mt-auto">
          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
          {attempt.year}
        </div>
      </div>
    </Link>
  );
}
