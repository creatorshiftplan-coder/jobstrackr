import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface Conflict {
  field: string;
  label: string;
  currentValue: string | null;
  newValue: string | null;
}

interface OCRConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: Conflict[];
  onResolve: (resolutions: Record<string, "keep" | "replace">) => void;
}

export function OCRConflictModal({ isOpen, onClose, conflicts, onResolve }: OCRConflictModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, "keep" | "replace">>(() => {
    const initial: Record<string, "keep" | "replace"> = {};
    conflicts.forEach((c) => {
      initial[c.field] = "replace"; // Default to replacing with OCR value
    });
    return initial;
  });

  const handleResolve = () => {
    onResolve(resolutions);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Data Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            Some extracted data conflicts with your existing profile. Choose which value to keep for each field.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 p-1">
            {conflicts.map((conflict) => (
              <div key={conflict.field} className="p-3 rounded-lg bg-secondary space-y-2">
                <p className="text-sm font-medium text-foreground">{conflict.label}</p>
                <RadioGroup
                  value={resolutions[conflict.field]}
                  onValueChange={(value) =>
                    setResolutions((prev) => ({ ...prev, [conflict.field]: value as "keep" | "replace" }))
                  }
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="keep" id={`${conflict.field}-keep`} />
                    <Label htmlFor={`${conflict.field}-keep`} className="text-sm cursor-pointer">
                      <span className="text-muted-foreground">Keep current: </span>
                      <span className="font-medium">{conflict.currentValue || "Not set"}</span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="replace" id={`${conflict.field}-replace`} />
                    <Label htmlFor={`${conflict.field}-replace`} className="text-sm cursor-pointer">
                      <span className="text-muted-foreground">Use OCR: </span>
                      <span className="font-medium text-primary">{conflict.newValue}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleResolve}>Apply Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
