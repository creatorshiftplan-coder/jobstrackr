import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuickActions } from "@/components/QuickActions";
import { SectionHeader } from "@/components/SectionHeader";
import { GovJobCard } from "@/components/GovJobCard";
import { ExamCard } from "@/components/ExamCard";
import { RecommendedJobRow } from "@/components/RecommendedJobRow";

const govJobs = [
  { title: "Library and Information Officer", org: "NITI Aayog, Government of India", vacancies: 1, type: "Govt", date: "31 Mar 2026", location: "All India" },
  { title: "Angul Forest Guard Recruitment", org: "Angul Forest Division", vacancies: 15, type: "Govt", date: "19 Mar 2026", location: "Odisha" },
  { title: "DRDO Scientist 'B' Recruitment", org: "Defence Research & Development Organisation", vacancies: 290, type: "Govt", date: "25 Apr 2026", location: "All India" },
  { title: "RBI Grade B Officer 2026", org: "Reserve Bank of India", vacancies: 120, type: "Govt", date: "10 May 2026", location: "All India" },
];

const exams = [
  { title: "Indian Railways – RRB NTPC Graduate Posts", status: "Admit Card Released", statusColor: "green" as const, emoji: "🚂" },
  { title: "SSC Stenographer Grade 'C' and 'D' Examination 2026", status: "Application Pending", statusColor: "orange" as const, emoji: "📝" },
  { title: "WBPSC Clerkship Recruitment 2026", status: "Result Awaited", statusColor: "blue" as const, emoji: "🏛️" },
  { title: "UPSC Civil Services Prelims 2026", status: "Exam Scheduled", statusColor: "green" as const, emoji: "🏛️" },
];

const recommended = [
  { title: "SSC Combined Graduate Level (CGL) Examination 2026", org: "Staff Selection Commission (SSC)", tags: ["SSC", "Graduate"] },
  { title: "IBPS PO Recruitment 2026", org: "Institute of Banking Personnel Selection", tags: ["Banking", "Graduate"] },
  { title: "NTA UGC NET June 2026", org: "National Testing Agency", tags: ["UGC", "Post Graduate"] },
];

export default function Index() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-[960px] space-y-8 p-6 lg:p-8">
      {/* Quick Actions */}
      <section className="animate-fade-in-up">
        <QuickActions />
      </section>

      {/* New Government Jobs */}
      <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
        <SectionHeader title="New Government Jobs" />
        <div className="relative mt-4">
          <button
            onClick={() => scroll("left")}
            className="absolute -left-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all hover:shadow-lg active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          >
            {govJobs.map((job) => (
              <GovJobCard key={job.title} {...job} />
            ))}
          </div>
          <button
            onClick={() => scroll("right")}
            className="absolute -right-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all hover:shadow-lg active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* My Active Exams */}
      <section className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
        <SectionHeader title="My Active Exams" />
        <div className="mt-4 grid grid-cols-4 gap-4">
          {exams.map((exam) => (
            <ExamCard key={exam.title} {...exam} />
          ))}
        </div>
      </section>

      {/* Recommended Jobs */}
      <section className="animate-fade-in-up" style={{ animationDelay: "240ms" }}>
        <SectionHeader title="Recommended Jobs" />
        <div className="mt-4 space-y-3">
          {recommended.map((job) => (
            <RecommendedJobRow key={job.title} {...job} />
          ))}
        </div>
      </section>
    </div>
  );
}