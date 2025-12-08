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
    <Link to="/tracker" className="block flex-shrink-0 group">
      <div className="p-4 rounded-2xl bg-card border border-border/40 shadow-soft w-[150px] sm:w-[180px] h-[120px] sm:h-[140px] flex flex-col transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5 hover:border-primary/20">
        <div className="flex items-center mb-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
        </div>
        <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-auto line-clamp-2 group-hover:text-primary transition-colors">
          {exam?.name || "Unknown Exam"}
        </h3>
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-primary mt-auto bg-primary/5 rounded-lg px-2.5 py-1.5 w-fit">
          <Calendar className="h-3.5 w-3.5" />
          {attempt.year}
        </div>
      </div>
    </Link>
  );
}
