import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Sparkles, BookOpen, Loader2, Plus } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { useExams } from "@/hooks/useExams";
import { useAIJobSearch } from "@/hooks/useAIJobSearch";
import { toast } from "sonner";

interface ExamSearchSheetProps {
  trigger?: React.ReactNode;
}

export function ExamSearchSheet({ trigger }: ExamSearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const { data: jobs = [] } = useJobs();
  const { addExamAttempt, createExam } = useExams();
  const { isSearching, aiResults, searchWithAI, clearAIResults } = useAIJobSearch();

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  // Filter jobs based on search query
  const filteredJobs = searchQuery.trim() 
    ? jobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleAddJob = async () => {
    if (!selectedJobId) {
      toast.error("Please select an exam first");
      return;
    }

    const selectedJob = jobs.find(j => j.id === selectedJobId);
    if (!selectedJob) {
      toast.error("Job not found");
      return;
    }

    try {
      // Create an exam entry from the job
      const newExam = await createExam.mutateAsync({
        name: selectedJob.title,
        conducting_body: selectedJob.department,
        category: "Government",
        description: selectedJob.description,
        official_website: selectedJob.apply_link,
      });

      // Then add to tracker
      await addExamAttempt.mutateAsync({
        examId: newExam.id,
        year: parseInt(selectedYear),
      });

      toast.success("Exam added to tracker!");
      setOpen(false);
      resetState();
    } catch (error) {
      toast.error("Failed to add exam");
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter an exam name to search");
      return;
    }
    await searchWithAI(searchQuery);
  };

  const handleAddAIResult = async (result: any) => {
    try {
      // Create the exam first
      const newExam = await createExam.mutateAsync({
        name: result.exam_name,
        conducting_body: result.agency,
        category: result.category || "Government",
        description: result.description,
        official_website: result.apply_link,
      });

      // Then add to tracker
      await addExamAttempt.mutateAsync({
        examId: newExam.id,
        year: parseInt(selectedYear),
      });

      toast.success("Exam discovered and added to tracker!");
      setOpen(false);
      resetState();
    } catch (error) {
      toast.error("Failed to add exam");
    }
  };

  const resetState = () => {
    setSearchQuery("");
    setSelectedJobId(null);
    clearAIResults();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <SheetTrigger asChild>
        {trigger || (
          <button className="fixed bottom-24 left-6 z-50 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-95">
            <Plus className="h-7 w-7 text-white" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">Search Exam to Track</SheetTitle>
        </SheetHeader>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by exam name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-muted/50 border-0"
          />
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-2 mb-4">
          {/* Database Results */}
          {searchQuery && filteredJobs.length > 0 && (
            <>
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selectedJobId === job.id 
                      ? "bg-blue-100 border-2 border-blue-500" 
                      : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.department}</p>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* No results message */}
          {searchQuery && filteredJobs.length === 0 && !isSearching && aiResults.length === 0 && (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No exams found in database</p>
            </div>
          )}

          {/* AI Search Button - Always visible when there's a search query */}
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
              <p className="text-sm font-medium text-muted-foreground px-1">AI Discovered Exams</p>
              {aiResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleAddAIResult(result)}
                  className="w-full p-4 rounded-xl text-left bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors border border-purple-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-purple-600" />
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
        {selectedJobId && (
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
              onClick={handleAddJob}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={addExamAttempt.isPending || createExam.isPending}
            >
              {(addExamAttempt.isPending || createExam.isPending) ? (
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
