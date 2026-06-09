import { Link } from "react-router-dom";
import { Bookmark, Building2 } from "lucide-react";
import { Job } from "@/types/job";
import { SaveJobButton } from "@/components/SaveJobButton";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { OrganizationLogo } from "@/components/OrganizationLogo";
import { inferCategory, shortenQualification } from "@/lib/jobUtils";

interface RecommendedJobRowProps {
  job: Job;
}

export function RecommendedJobRow({ job }: RecommendedJobRowProps) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(job.department);
  const category = inferCategory(job.department, job.title);
  const shortQual = shortenQualification(job.qualification);

  return (
    <Link to={`/jobs/${job.slug || job.id}`} className="block">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]">
        <OrganizationLogo
          logoUrl={logoUrl}
          name={job.department}
          containerClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden"
          imageClassName="h-7 w-7 object-contain"
          iconClassName="h-5 w-5 text-primary"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{job.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.department}</p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {category}
            </span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {shortQual}
            </span>
          </div>
        </div>
        <div onClick={(e) => e.preventDefault()} className="shrink-0">
          <SaveJobButton jobId={job.id} />
        </div>
      </div>
    </Link>
  );
}
