import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OCRResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedData: Record<string, any>;
  onConfirm: (selectedFields: Record<string, any>) => void;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full Name",
  date_of_birth: "Date of Birth",
  gender: "Gender",
  father_name: "Father's Name",
  mother_name: "Mother's Name",
  address: "Address",
  aadhar_number: "Aadhaar Number",
  pan_number: "PAN Number",
  passport_number: "Passport Number",
  category: "Category",
  caste_name: "Caste Name",
  caste_certificate_number: "Caste Certificate Number",
  caste_issuing_authority: "Caste Issuing Authority",
  caste_issue_date: "Caste Issue Date",
  roll_number: "Roll Number",
  institute_name: "Institute Name",
  board_university: "Board/University",
  qualification_name: "Qualification",
  qualification_type: "Qualification Type",
  date_of_passing: "Date of Passing",
  percentage: "Percentage",
  cgpa: "CGPA",
  marks_obtained: "Marks Obtained",
  maximum_marks: "Maximum Marks",
  marital_status: "Marital Status",
  pincode: "PIN Code",
  ews_certificate_number: "EWS Certificate Number",
  ews_issuing_authority: "EWS Issuing Authority",
  sub_category: "Sub-Category",
  disability_type: "Disability Type",
  disability_certificate_number: "Disability Certificate Number",
  disability_percentage: "Disability Percentage",
  current_status: "Current Status",
};

export function OCRResultModal({ isOpen, onClose, extractedData, onConfirm }: OCRResultModalProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(Object.keys(extractedData).filter((key) => extractedData[key] !== null))
  );

  const toggleField = (field: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(field)) {
      newSelected.delete(field);
    } else {
      newSelected.add(field);
    }
    setSelectedFields(newSelected);
  };

  const handleConfirm = () => {
    const fieldsToUpdate: Record<string, any> = {};
    selectedFields.forEach((field) => {
      if (extractedData[field] !== null && extractedData[field] !== undefined) {
        fieldsToUpdate[field] = extractedData[field];
      }
    });
    onConfirm(fieldsToUpdate);
    onClose();
  };

  const validFields = Object.entries(extractedData).filter(
    ([key, value]) => value !== null && value !== undefined && !["photo_uploaded", "signature_uploaded", "raw_text"].includes(key)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>OCR Results</DialogTitle>
          <DialogDescription>
            Select the fields you want to update in your profile
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 p-1">
            {validFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No extractable data found</p>
            ) : (
              validFields.map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 p-2 rounded-lg bg-secondary">
                  <Checkbox
                    id={key}
                    checked={selectedFields.has(key)}
                    onCheckedChange={() => toggleField(key)}
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={key} className="text-sm font-medium">
                      {FIELD_LABELS[key] || key.replace(/_/g, " ")}
                    </Label>
                    <p className="text-sm text-muted-foreground truncate">{String(value)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedFields.size === 0}>
            Update Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
