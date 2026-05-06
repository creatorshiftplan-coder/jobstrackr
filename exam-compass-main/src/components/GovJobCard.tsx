import { Bookmark, MapPin, Calendar, Building2 } from "lucide-react";

interface GovJobCardProps {
  title: string;
  org: string;
  vacancies: number;
  type: string;
  date: string;
  location: string;
}

export function GovJobCard({ title, org, vacancies, type, date, location }: GovJobCardProps) {
  return (
    <div className="job-card-gradient relative flex min-w-[280px] flex-col justify-between rounded-xl p-5 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg">
      <button className="absolute right-4 top-4 rounded-md p-1 transition-colors hover:bg-white/20">
        <Bookmark className="h-5 w-5" />
      </button>
      <div>
        <div className="flex items-start gap-3 pr-8">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />
          <div>
            <h3 className="text-[15px] font-bold leading-snug">{title}</h3>
            <p className="mt-1 text-xs opacity-80">{org}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold">
            {vacancies} {vacancies === 1 ? "Vacancy" : "Vacancies"}
          </span>
          <span className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold">{type}</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs opacity-80">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" /> {date}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {location}
        </span>
      </div>
    </div>
  );
}