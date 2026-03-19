import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEducation, EducationQualification } from "@/hooks/useEducation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSmartBack } from "@/hooks/useSmartBack";

const QUALIFICATION_TYPES = [
  { value: "10th", label: "Class 10 (Matriculation)" },
  { value: "12th", label: "Class 12 (Intermediate)" },
  { value: "diploma", label: "Diploma" },
  { value: "graduation", label: "Graduation (Bachelor's)" },
  { value: "post_graduation", label: "Post Graduation (Master's)" },
  { value: "phd", label: "PhD / Doctorate" },
  { value: "other", label: "Other" },
];

export default function EditEducation() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
  const { user, loading } = useAuth();
  const { education, isLoading, addEducation, updateEducation, deleteEducation } = useEducation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEducation, setEditingEducation] = useState<EducationQualification | null>(null);
  const [formData, setFormData] = useState<Partial<EducationQualification>>({});

  const resetForm = () => {
    setFormData({});
    setEditingEducation(null);
    setShowAddModal(false);
  };

  const handleSave = async () => {
    if (!formData.qualification_type) return;

    if (editingEducation) {
      await updateEducation.mutateAsync({ id: editingEducation.id, ...formData });
    } else {
      await addEducation.mutateAsync(formData);
    }
    resetForm();
  };

  const handleEdit = (edu: EducationQualification) => {
    setEditingEducation(edu);
    setFormData({
      qualification_type: edu.qualification_type,
      qualification_name: edu.qualification_name,
      board_university: edu.board_university,
      institute_name: edu.institute_name,
      date_of_passing: edu.date_of_passing,
      marks_obtained: edu.marks_obtained,
      maximum_marks: edu.maximum_marks,
      percentage: edu.percentage,
      cgpa: edu.cgpa,
      roll_number: edu.roll_number,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this education record?")) {
      await deleteEducation.mutateAsync(id);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-foreground">Education</h1>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-4">
        {education.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No education records added yet</p>
              <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Education
              </Button>
            </CardContent>
          </Card>
        ) : (
          education.map((edu) => (
            <Card key={edu.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEdit(edu)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {QUALIFICATION_TYPES.find((t) => t.value === edu.qualification_type)?.label || edu.qualification_type}
                      </p>
                      {edu.qualification_name && (
                        <p className="text-sm text-muted-foreground">{edu.qualification_name}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {edu.board_university || edu.institute_name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {edu.date_of_passing && (
                          <span>Passed: {new Date(edu.date_of_passing).getFullYear()}</span>
                        )}
                        {edu.percentage && <span>{edu.percentage}%</span>}
                        {edu.cgpa && <span>CGPA: {edu.cgpa}</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(edu.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEducation ? "Edit Education" : "Add Education"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Qualification Type *</Label>
              <Select
                value={formData.qualification_type || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, qualification_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select qualification" />
                </SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Degree/Course Name</Label>
              <Input
                value={formData.qualification_name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, qualification_name: e.target.value }))}
                placeholder="e.g., B.Tech Computer Science"
              />
            </div>

            <div className="space-y-2">
              <Label>Board/University</Label>
              <Input
                value={formData.board_university || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, board_university: e.target.value }))}
                placeholder="e.g., CBSE, Delhi University"
              />
            </div>

            <div className="space-y-2">
              <Label>Institute Name</Label>
              <Input
                value={formData.institute_name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, institute_name: e.target.value }))}
                placeholder="e.g., ABC School, XYZ College"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year/Date of Passing</Label>
                <Input
                  value={formData.date_of_passing || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date_of_passing: e.target.value }))}
                  placeholder="e.g., 2020, May 2020, 15-05-2020"
                />
                <p className="text-xs text-muted-foreground">Enter year only, month & year, or full date</p>
              </div>
              <div className="space-y-2">
                <Label>Roll Number</Label>
                <Input
                  value={formData.roll_number || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, roll_number: e.target.value }))}
                  placeholder="Roll number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marks Obtained</Label>
                <Input
                  type="number"
                  value={formData.marks_obtained?.toString() || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, marks_obtained: parseFloat(e.target.value) || null }))}
                  placeholder="450"
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Marks</Label>
                <Input
                  type="number"
                  value={formData.maximum_marks?.toString() || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maximum_marks: parseFloat(e.target.value) || null }))}
                  placeholder="500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Percentage</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.percentage?.toString() || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, percentage: parseFloat(e.target.value) || null }))}
                  placeholder="90.5"
                />
              </div>
              <div className="space-y-2">
                <Label>CGPA (if applicable)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cgpa?.toString() || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cgpa: parseFloat(e.target.value) || null }))}
                  placeholder="8.5"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.qualification_type || addEducation.isPending || updateEducation.isPending}
            >
              {(addEducation.isPending || updateEducation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
