interface ExamCardProps {
  title: string;
  status: string;
  statusColor: "green" | "orange" | "blue" | "red";
  emoji: string;
}

const statusColors = {
  green: "bg-emerald-50 text-emerald-700",
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-blue-50 text-blue-600",
  red: "bg-red-50 text-red-600",
};

export function ExamCard({ title, status, statusColor, emoji }: ExamCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
      <span className="text-2xl">{emoji}</span>
      <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>
      <span
        className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${statusColors[statusColor]}`}
      >
        {status}
      </span>
    </div>
  );
}