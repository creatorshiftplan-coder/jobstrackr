import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Sparkles, BookOpen, Loader2, Plus } from "lucide-react";
import { useExams } from "@/hooks/useExams";
import { useAIJobSearch } from "@/hooks/useAIJobSearch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExamSearchSheetProps {
  trigger?: React.ReactNode;
}

export function ExamSearchSheet({ trigger }: ExamSearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isAddingAIResult, setIsAddingAIResult] = useState(false);
  
  const { exams, addExamAttempt } = useExams();
  const { isSearching, aiResults, searchWithAI, clearAIResults } = useAIJobSearch();

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  // Filter exams based on search query
  const filteredExams = searchQuery.trim() 
    ? exams.filter(exam => 
        exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exam.conducting_body?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleAddExam = async () => {
    if (!selectedExamId) {
      toast.error("Please select an exam first");
      return;
    }

    try {
      // Just add to tracker - exam already exists
      await addExamAttempt.mutateAsync({
        examId: selectedExamId,
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
    setIsAddingAIResult(true);
    try {
      // Call edge function to create exam server-side (bypasses RLS)
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
    clearAIResults();
  };

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
            placeholder="Search by exam name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-muted/50 border-0"
          />
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-2 mb-4">
          {/* Database Results - Now showing exams directly */}
          {searchQuery && filteredExams.length > 0 && (
            <>
              {filteredExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selectedExamId === exam.id 
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
            </>
          )}

          {/* No results message */}
          {searchQuery && filteredExams.length === 0 && !isSearching && aiResults.length === 0 && (
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
        {selectedExamId && (
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
              onClick={handleAddExam}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={addExamAttempt.isPending}
            >
              {addExamAttempt.isPending ? (
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
