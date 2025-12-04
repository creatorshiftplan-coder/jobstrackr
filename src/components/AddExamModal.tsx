import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExams, Exam } from "@/hooks/useExams";
import { Plus, Search, Loader2 } from "lucide-react";

interface AddExamModalProps {
  trigger?: React.ReactNode;
}

export function AddExamModal({ trigger }: AddExamModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newExamName, setNewExamName] = useState("");
  const [newExamBody, setNewExamBody] = useState("");

  const { exams, isLoading, addExamAttempt, createExam } = useExams();

  const filteredExams = exams.filter(
    (exam) =>
      exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.conducting_body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddExam = async () => {
    if (isCreatingNew) {
      if (!newExamName) return;
      const newExam = await createExam.mutateAsync({
        name: newExamName,
        conducting_body: newExamBody || undefined,
      });
      if (newExam) {
        await addExamAttempt.mutateAsync({ examId: newExam.id, year });
      }
    } else {
      if (!selectedExamId) return;
      await addExamAttempt.mutateAsync({ examId: selectedExamId, year });
    }
    setIsOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSearchQuery("");
    setSelectedExamId("");
    setYear(new Date().getFullYear());
    setIsCreatingNew(false);
    setNewExamName("");
    setNewExamBody("");
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Exam
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Exam to Tracker</DialogTitle>
          <DialogDescription>
            Search for an existing exam or create a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isCreatingNew ? (
            <>
              <div className="space-y-2">
                <Label>Search Exams</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or conducting body..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {filteredExams.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">No exams found</p>
                        <Button
                          variant="link"
                          onClick={() => {
                            setIsCreatingNew(true);
                            setNewExamName(searchQuery);
                          }}
                        >
                          Create new exam
                        </Button>
                      </div>
                    ) : (
                      filteredExams.map((exam) => (
                        <div
                          key={exam.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedExamId === exam.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-secondary/80"
                          }`}
                          onClick={() => setSelectedExamId(exam.id)}
                        >
                          <p className="font-medium text-sm">{exam.name}</p>
                          {exam.conducting_body && (
                            <p className="text-xs opacity-80">{exam.conducting_body}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}

              {filteredExams.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsCreatingNew(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Exam
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Exam Name *</Label>
                <Input
                  placeholder="e.g., SSC CGL, UPSC CSE"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Conducting Body</Label>
                <Input
                  placeholder="e.g., SSC, UPSC, State PSC"
                  value={newExamBody}
                  onChange={(e) => setNewExamBody(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => setIsCreatingNew(false)}>
                Back to Search
              </Button>
            </>
          )}

          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddExam}
            disabled={
              addExamAttempt.isPending ||
              createExam.isPending ||
              (isCreatingNew ? !newExamName : !selectedExamId)
            }
          >
            {addExamAttempt.isPending || createExam.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Add to Tracker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
