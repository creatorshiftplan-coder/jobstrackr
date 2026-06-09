import { FileText, Search, Briefcase, BookOpen } from "lucide-react";

const actions = [
  { icon: FileText, label: "Track an Exam", color: "text-primary" },
  { icon: Search, label: "Find an Exam", color: "text-warning" },
  { icon: Briefcase, label: "Jobs For You", color: "text-success" },
  { icon: BookOpen, label: "Syllabus Finder", color: "text-primary" },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {actions.map((action) => (
        <button
          key={action.label}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
        >
          <action.icon className={`h-7 w-7 ${action.color}`} />
          <span className="text-sm font-medium text-foreground">{action.label}</span>
        </button>
      ))}
    </div>
  );
}