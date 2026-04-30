import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, GraduationCap, Banknote, Sparkles, Eye, X, Users, Clock, CheckCircle } from "lucide-react";
import { AIJobResult } from "@/hooks/useAIJobSearch";
import { parseJobDeadline } from "@/lib/jobUtils";

interface AISearchResultProps {
  job: AIJobResult;
  onDismiss: () => void;
  savedJobId?: string;
}

export function AISearchResult({ job, onDismiss, savedJobId }: AISearchResultProps) {
  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && max) {
      if (min === max) return `₹${(min / 1000).toFixed(0)}K/month`;
      return `₹${(min / 1000).toFixed(0)}K - ₹${(max / 1000).toFixed(0)}K/month`;
    }
    if (min) return `From ₹${(min / 1000).toFixed(0)}K/month`;
    if (max) return `Up to ₹${(max / 1000).toFixed(0)}K/month`;
    return "Not specified";
  };

  const formatFees = (fees: { general: number; obc: number; sc_st: number; female: number } | null | undefined) => {
    if (!fees) return null;
    const parts: string[] = [];
    if (fees.general != null && fees.general > 0) parts.push(`Gen: ₹${fees.general}`);
    if (fees.obc != null && fees.obc > 0 && fees.obc !== fees.general) parts.push(`OBC: ₹${fees.obc}`);
    if (fees.sc_st != null && fees.sc_st === 0) parts.push(`SC/ST: Free`);
    else if (fees.sc_st != null && fees.sc_st > 0) parts.push(`SC/ST: ₹${fees.sc_st}`);
    if (fees.female != null && fees.female === 0) parts.push(`Female: Free`);
    else if (fees.female != null && fees.female > 0) parts.push(`Female: ₹${fees.female}`);
    return parts.length > 0 ? parts.join(" | ") : "Check notification";
  };

  return (
    <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Found Result</CardTitle>
          </div>
          <Button size="icon" variant="ghost" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500 text-white text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Auto-saved
          </Badge>
          <span className="text-xs text-muted-foreground">
            Confidence: {Math.round(job.confidence * 100)}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <h3 className="font-semibold">{job.exam_name}</h3>
          <p className="text-sm text-muted-foreground">{job.agency}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {job.location}
          </Badge>
          {job.requirements && (
            <Badge variant="secondary" className="text-xs">
              <GraduationCap className="h-3 w-3 mr-1" />
              {job.requirements}
            </Badge>
          )}
          {job.age_limit && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {job.age_limit}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Banknote className="h-4 w-4" />
            <span>{formatSalary(job.salary_min, job.salary_max)}</span>
          </div>
          {job.last_date && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due: {(() => { const d = parseJobDeadline(job.last_date); return d ? d.toLocaleDateString() : job.last_date; })()}</span>
            </div>
          )}
        </div>

        {job.exam_date && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Exam: {new Date(job.exam_date).toLocaleDateString()}</span>
          </div>
        )}

        {job.application_fees && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            <strong>Fees:</strong> {formatFees(job.application_fees)}
          </p>
        )}

        {job.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
        )}

        {job.highlights && (
          <p className="text-xs text-primary/80 italic">{job.highlights}</p>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        {savedJobId ? (
          <Link to={`/jobs/${savedJobId}`} className="w-full">
            <Button variant="default" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            Saving...
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
