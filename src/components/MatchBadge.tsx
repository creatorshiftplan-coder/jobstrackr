import { Badge } from "@/components/ui/badge";
import { Star, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchBadgeProps {
  score: number;
}

export function MatchBadge({ score }: MatchBadgeProps) {
  if (score < 50) return null;

  let label = "";
  let icon: any = null;
  let styleClass = "";

  if (score >= 90) {
    label = "Strong Match";
    icon = Star;
    styleClass = "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25";
  } else if (score >= 70) {
    label = "Good Match";
    icon = Check;
    styleClass = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25";
  } else {
    label = "Partial Match";
    icon = AlertCircle;
    styleClass = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25";
  }

  const IconComponent = icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border shadow-sm select-none",
        styleClass
      )}
    >
      <IconComponent className="h-3 w-3 shrink-0" />
      <span>{label}</span>
      <span className="text-[9px] opacity-75 ml-0.5">({score}%)</span>
    </Badge>
  );
}
