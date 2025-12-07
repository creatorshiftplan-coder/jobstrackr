import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Building2 } from "lucide-react";

interface RecommendedJobCardProps {
  job: Job;
  colorVariant?: "pink" | "blue" | "green" | "orange";
}

export function RecommendedJobCard({ job }: RecommendedJobCardProps) {
  const formatSalary = (min: number | null, max: number | null) => {
    if (max) {
      return `₹${(max * 12 / 100000).toFixed(1)} LPA`;
    }
    if (min) {
      return `₹${(min * 12 / 100000).toFixed(1)} LPA`;
    }
    return "Negotiable";
  };

  return (
    <Link to={`/job/${job.id}`} className="block">
      <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-white/50 transition-all hover:bg-white/90 hover:scale-[1.02]">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#0A4174] flex items-center justify-center mb-3">
          <Building2 className="h-6 w-6 text-white" />
        </div>

        {/* Job Title */}
        <h3 className="font-bold text-[#0A4174] text-base mb-1 line-clamp-1">
          {job.title}
        </h3>

        {/* Department */}
        <p className="text-sm text-[#0A4174]/70 mb-3 line-clamp-1">
          {job.department}
        </p>

        {/* Salary */}
        <p className="text-sm font-semibold text-[#0A4174]">
          {formatSalary(job.salary_min, job.salary_max)}
        </p>
      </div>
    </Link>
  );
}
