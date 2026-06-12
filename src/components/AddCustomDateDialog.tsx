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
import { CalendarPlus, Loader2 } from "lucide-react";
import {
  useUserCalendarEvents,
  UserCalendarEventType,
} from "@/hooks/useUserCalendarEvents";

interface AddCustomDateDialogProps {
  trigger?: React.ReactNode;
}

const TYPE_OPTIONS: { value: UserCalendarEventType; label: string }[] = [
  { value: "exam_date", label: "Exam Date" },
  { value: "apply_end", label: "Form Fill-up / Last Date" },
  { value: "admit_card", label: "Admit Card" },
  { value: "result", label: "Result" },
];

export function AddCustomDateDialog({ trigger }: AddCustomDateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<UserCalendarEventType>("exam_date");
  const [eventDate, setEventDate] = useState("");
  const [note, setNote] = useState("");

  const { addEvent } = useUserCalendarEvents();

  const resetForm = () => {
    setTitle("");
    setEventType("exam_date");
    setEventDate("");
    setNote("");
  };

  const handleSave = async () => {
    if (!title.trim() || !eventDate) return;
    await addEvent.mutateAsync({
      title,
      event_type: eventType,
      event_date: eventDate,
      note,
    });
    setIsOpen(false);
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Add a Date
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Your Own Date</DialogTitle>
          <DialogDescription>
            Add a personal exam date, form fill-up deadline, or reminder to your calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-date-title">Title</Label>
            <Input
              id="custom-date-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., SSC CGL form fill-up"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as UserCalendarEventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-date-date">Date</Label>
            <Input
              id="custom-date-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-date-note">Note (optional)</Label>
            <Input
              id="custom-date-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything to remember"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !eventDate || addEvent.isPending}
          >
            {addEvent.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="mr-2 h-4 w-4" />
            )}
            Add to Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
