import { Link } from "react-router-dom";
import { BookOpen, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "applied":
        return <Badge className="bg-blue-500/20 text-blue-700 text-[8px] sm:text-[10px] px-1.5 py-0">Applied</Badge>;
      case "result":
        return <Badge className="bg-green-500/20 text-green-700 text-[8px] sm:text-[10px] px-1.5 py-0">Result</Badge>;
      case "tracking":
      default:
        return <Badge className="bg-amber-500/20 text-amber-700 text-[8px] sm:text-[10px] px-1.5 py-0">Tracking</Badge>;
    }
  };

  return (
    <Link to="/tracker" className="block flex-shrink-0">
      <div className="p-3 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-white/50 w-[150px] sm:w-[180px] h-[140px] sm:h-[160px] flex flex-col transition-all hover:bg-white/90 hover:scale-[1.02]">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#0A4174] flex items-center justify-center">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          {getStatusBadge(attempt.status)}
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
