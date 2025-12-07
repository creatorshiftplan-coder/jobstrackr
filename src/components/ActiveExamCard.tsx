import { Link } from "react-router-dom";
import { BookOpen, Calendar } from "lucide-react";

interface ActiveExamCardProps {
  attempt: {
    id: string;
    year: number;
    exams?: {
      name: string;
      conducting_body?: string | null;
    } | null;
  };
}

export function ActiveExamCard({ attempt }: ActiveExamCardProps) {
  const exam = attempt.exams;

  return (
    <Link to="/tracker" className="block">
      <div className="p-3 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-white/50 h-[140px] sm:h-[160px] flex flex-col transition-all hover:bg-white/90 hover:scale-[1.02]">
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-[#0A4174] flex items-center justify-center mb-2 sm:mb-3">
          <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
        </div>
        <h3 className="font-bold text-[#0A4174] text-xs sm:text-sm mb-auto line-clamp-2">
          {exam?.name || "Unknown Exam"}
        </h3>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-[#0A4174] mt-auto">
          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
          {attempt.year}
        </div>
      </div>
    </Link>
  );
}
