import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Sparkles, BookOpen, Loader2, Plus, Briefcase } from "lucide-react";
import { useExams } from "@/hooks/useExams";
import { useJobs } from "@/hooks/useJobs";
import { useAIJobSearch } from "@/hooks/useAIJobSearch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";

interface ExamSearchSheetProps {
  trigger?: React.ReactNode;
}

export function ExamSearchSheet({ trigger }: ExamSearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isAddingAIResult, setIsAddingAIResult] = useState(false);
  const [isAddingJob, setIsAddingJob] = useState(false);

  const { exams, addExamAttempt } = useExams();
  const { data: jobs = [] } = useJobs();
  const { isSearching, aiResults, searchWithAI, clearAIResults } = useAIJobSearch();
  const { trackExamTracked, trackAISearchUsed } = useAnalytics();

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  // Filter exams based on search query
  const filteredExams = searchQuery.trim()
    ? exams.filter(exam =>
      exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.conducting_body?.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : [];

  // Filter jobs based on search query
  const filteredJobs = searchQuery.trim()
    ? jobs.filter(job =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  const hasResults = filteredExams.length > 0 || filteredJobs.length > 0;

  const handleSelectExam = (examId: string) => {
    setSelectedExamId(examId);
    setSelectedJobId(null);
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedExamId(null);
  };

  const handleAddExam = async () => {
    if (!selectedExamId) {
      toast.error("Please select an exam first");
      return;
    }

    try {
      await addExamAttempt.mutateAsync({
        examId: selectedExamId,
        year: parseInt(selectedYear),
      });

      toast.success("Exam added to tracker!");
      const exam = exams.find(e => e.id === selectedExamId);
      trackExamTracked(selectedExamId, exam?.name || "");
      setOpen(false);
      resetState();
    } catch (error) {
      toast.error("Failed to add exam");
    }
  };

  const handleAddJob = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job first");
      return;
    }

    setIsAddingJob(true);
    try {
      const selectedJob = jobs.find(j => j.id === selectedJobId);
      if (!selectedJob) throw new Error("Job not found");

      // Check if exam already exists (case-insensitive match)
      const { data: existingExam } = await supabase
        .from("exams")
        .select("id")
        .ilike("name", selectedJob.title)
        .limit(1)
        .maybeSingle();

      let examId: string;

      if (existingExam) {
        examId = existingExam.id;
      } else {
        // Create new exam directly in database
        const { data: newExam, error: examError } = await supabase
          .from("exams")
          .insert({
            name: selectedJob.title,
            conducting_body: selectedJob.department,
            category: "Government",
            description: selectedJob.description,
            official_website: selectedJob.apply_link,
            is_active: true,
          })
          .select("id")
          .single();

        if (examError) throw examError;
        examId = newExam.id;
      }

      // Add exam attempt using existing mutation
      await addExamAttempt.mutateAsync({
        examId,
        year: parseInt(selectedYear),
      });

      toast.success("Job added to tracker!");
      trackExamTracked(examId, selectedJob.title);
      setOpen(false);
      resetState();
    } catch (error: any) {
      console.error("Add job error:", error);
      if (error.message?.includes("duplicate") || error.code === "23505") {
        toast.error("This exam is already in your tracker");
      } else {
        toast.error("Failed to add job");
      }
    } finally {
      setIsAddingJob(false);
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter an exam name to search");
      return;
    }
    await searchWithAI(searchQuery);
    trackAISearchUsed(searchQuery, aiResults.length);
  };

  const handleAddAIResult = async (result: any) => {
    setIsAddingAIResult(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `https://fdxksytpdfgmbkttipdf.supabase.co/functions/v1/ai-job-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            createExam: true,
            examData: {
              name: result.exam_name,
              conducting_body: result.agency,
              category: result.category || "Government",
              description: result.description,
              official_website: result.apply_link,
            },
            year: parseInt(selectedYear),
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success("Exam discovered and added to tracker!");
      setOpen(false);
      resetState();
    } catch (error) {
      console.error("Add AI result error:", error);
      toast.error("Failed to add exam");
    } finally {
      setIsAddingAIResult(false);
    }
  };

  const resetState = () => {
    setSearchQuery("");
    setSelectedExamId(null);
    setSelectedJobId(null);
    clearAIResults();
  };

  const isSelected = selectedExamId || selectedJobId;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      {trigger ? (
        <SheetTrigger asChild>
          {trigger}
        </SheetTrigger>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <SheetTrigger asChild>
                <button className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-95">
                  <Plus className="h-7 w-7 text-white" />
                </button>
              </SheetTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Add Exam</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">Search Exam to Track</SheetTitle>
        </SheetHeader>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search exams or jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-muted/50 border-0"
          />
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-4 mb-4">
          {/* Exams Section */}
          {searchQuery && filteredExams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">From Exams</p>
              {filteredExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => handleSelectExam(exam.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${selectedExamId === exam.id
                      ? "bg-blue-100 border-2 border-blue-500"
                      : "bg-muted/30 hover:bg-muted/50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{exam.name}</h3>
                      <p className="text-sm text-muted-foreground">{exam.conducting_body}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Jobs Section */}
          {searchQuery && filteredJobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">From Job Listings ({filteredJobs.length})</p>
              {filteredJobs.slice(0, 10).map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleSelectJob(job.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${selectedJobId === job.id
                      ? "bg-green-100 border-2 border-green-500"
                      : "bg-muted/30 hover:bg-muted/50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground truncate">{job.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{job.department}</p>
                      <p className="text-xs text-muted-foreground">{job.location}</p>
                    </div>
                  </div>
                </button>
              ))}
              {filteredJobs.length > 10 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  +{filteredJobs.length - 10} more results
                </p>
              )}
            </div>
          )}

          {/* No results message */}
          {searchQuery && !hasResults && !isSearching && aiResults.length === 0 && (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No exams or jobs found</p>
            </div>
          )}

          {/* AI Search Button */}
          {searchQuery && !isSearching && aiResults.length === 0 && (
            <div className="flex justify-center py-4 border-t border-dashed">
              <Button
                onClick={handleAISearch}
                variant="outline"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Search with AI
              </Button>
            </div>
          )}

          {/* AI Search Loading */}
          {isSearching && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Searching with AI...</span>
            </div>
          )}

          {/* AI Results */}
          {aiResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wide">AI Discovered</p>
              {aiResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleAddAIResult(result)}
                  disabled={isAddingAIResult}
                  className="w-full p-4 rounded-xl text-left bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors border border-purple-200 disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      {isAddingAIResult ? (
                        <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{result.exam_name}</h3>
                      <p className="text-sm text-muted-foreground">{result.agency}</p>
                      <span className="text-xs text-purple-600 font-medium">Tap to add</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Year Selector and Add Button */}
        {isSelected && (
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Select Year:</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={selectedExamId ? handleAddExam : handleAddJob}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={addExamAttempt.isPending || isAddingJob}
            >
              {(addExamAttempt.isPending || isAddingJob) ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Add to Tracker"
              )}
            </Button>
          </div>
        )}

        {/* Empty state when no search */}
        {!searchQuery && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Search for an exam to track</p>
            <p className="text-sm mt-1">We'll help you stay updated on admit cards, exam dates, and results</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
