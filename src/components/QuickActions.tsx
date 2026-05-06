import { FileText, Search, Briefcase, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

const actions = [
  { icon: FileText, label: "Track an Exam", color: "text-primary", to: "/tracker" },
  { icon: Search, label: "Find an Exam", color: "text-warning", to: "/search" },
  { icon: Briefcase, label: "Jobs For You", color: "text-success", to: "/for-you" },
  { icon: BookOpen, label: "Syllabus Finder", color: "text-primary", to: "/syllabus" },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.to}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
        >
          <action.icon className={`h-7 w-7 ${action.color}`} />
          <span className="text-sm font-medium text-foreground">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
