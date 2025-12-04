import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, GraduationCap, Banknote, Sparkles, Save, X } from "lucide-react";
import { AIJobResult } from "@/hooks/useAIJobSearch";

interface AISearchResultProps {
  job: AIJobResult;
  onSave: () => void;
  onDismiss: () => void;
  isSaving: boolean;
}

export function AISearchResult({ job, onSave, onDismiss, isSaving }: AISearchResultProps) {
  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && max) return `₹${(min / 1000).toFixed(0)}K - ₹${(max / 1000).toFixed(0)}K/month`;
    if (min) return `From ₹${(min / 1000).toFixed(0)}K/month`;
    if (max) return `Up to ₹${(max / 1000).toFixed(0)}K/month`;
    return "Not specified";
  };

  const confidenceColor = job.confidence >= 0.7 ? "bg-green-500" : job.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500";

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
        <p className="text-xs text-muted-foreground">
          Confidence: <span className={`inline-block w-2 h-2 rounded-full ${confidenceColor} mr-1`}></span>
          {Math.round(job.confidence * 100)}%
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <h3 className="font-semibold">{job.title}</h3>
          <p className="text-sm text-muted-foreground">{job.department}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {job.location}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <GraduationCap className="h-3 w-3 mr-1" />
            {job.qualification}
          </Badge>
          {job.vacancies && (
            <Badge variant="secondary" className="text-xs">
              {job.vacancies} Vacancies
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
              <span>Due: {new Date(job.last_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {job.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{job.description}</p>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        <Button onClick={onSave} disabled={isSaving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save to Database"}
        </Button>
      </CardFooter>
    </Card>
  );
}
