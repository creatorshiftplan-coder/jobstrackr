import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Building2 } from "lucide-react";

interface RecommendedJobCardProps {
  job: Job;
  colorVariant?: "pink" | "blue" | "green" | "orange";
}

const colorVariants = {
  pink: "bg-pink-100 dark:bg-pink-950/30",
  blue: "bg-blue-100 dark:bg-blue-950/30",
  green: "bg-green-100 dark:bg-green-950/30",
  orange: "bg-orange-100 dark:bg-orange-950/30",
};

const iconVariants = {
  pink: "bg-pink-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
};

export function RecommendedJobCard({ job, colorVariant = "pink" }: RecommendedJobCardProps) {
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
      <div className={`p-4 rounded-2xl ${colorVariants[colorVariant]} transition-transform hover:scale-[1.02]`}>
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl ${iconVariants[colorVariant]} flex items-center justify-center mb-3`}>
          <Building2 className="h-6 w-6 text-white" />
        </div>

        {/* Job Title */}
        <h3 className="font-bold text-foreground text-base mb-1 line-clamp-1">
          {job.title}
        </h3>

        {/* Department */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
          {job.department}
        </p>

        {/* Salary */}
        <p className="text-sm font-semibold text-foreground">
          {formatSalary(job.salary_min, job.salary_max)}
        </p>
      </div>
    </Link>
  );
}
