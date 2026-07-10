import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Slim nudge shown on the homepage in place of the "My Active Exams" row when
 * the user hasn't tracked any exams yet — points them at the "Jobs For You"
 * (/for-you) personalization page. Disappears once they track an exam.
 */
export function JobsForYouPrompt() {
  return (
    <div className="px-5 md:px-0">
      <Link
        to="/for-you"
        className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2.5 no-underline transition-colors hover:from-primary/15 hover:to-primary/10"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Find jobs made for you
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-1">
            Get jobs matched to your qualification, age &amp; sector
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary shrink-0">
          Set up
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}

export default JobsForYouPrompt;
