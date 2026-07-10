import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface SlimPromptCardProps {
  to: string;
  title: string;
  subtitle: string;
  cta?: string;
}

/**
 * Slim, single-row nudge used between homepage card rows to point new users at
 * a personalization page (Jobs For You, My Exams, …).
 */
export function SlimPromptCard({ to, title, subtitle, cta = "Open" }: SlimPromptCardProps) {
  return (
    <div className="px-5 md:px-0">
      <Link
        to={to}
        className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2.5 no-underline transition-colors hover:from-primary/15 hover:to-primary/10"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-1">{subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary shrink-0">
          {cta}
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}

export default SlimPromptCard;
