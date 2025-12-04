import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useJobs } from "@/hooks/useJobs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Upload, Trash2, Edit, Loader2, AlertCircle, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Job } from "@/types/job";

interface JobFormData {
  title: string;
  department: string;
  location: string;
  qualification: string;
  experience: string;
  eligibility: string;
  salary_min: number | null;
  salary_max: number | null;
  age_min: number;
  age_max: number;
  application_fee: number;
  vacancies: number;
  last_date: string;
  is_featured: boolean;
  description: string;
  apply_link: string;
}

const emptyFormData: JobFormData = {
  title: "",
  department: "",
  location: "",
  qualification: "",
  experience: "",
  eligibility: "",
  salary_min: null,
  salary_max: null,
  age_min: 18,
  age_max: 65,
  application_fee: 0,
  vacancies: 1,
  last_date: "",
  is_featured: false,
  description: "",
  apply_link: "",
};

interface BulkUploadJob extends JobFormData {
  isDuplicate?: boolean;
  duplicateOf?: string;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<JobFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [bulkJobs, setBulkJobs] = useState<BulkUploadJob[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">Please login to access the admin panel.</p>
            <Link to="/auth">
              <Button>Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveJob = async () => {
    if (!formData.title || !formData.department || !formData.location || !formData.qualification || !formData.last_date) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingJob) {
        const { error } = await supabase
          .from("jobs")
          .update(formData)
          .eq("id", editingJob.id);
        if (error) throw error;
        toast({ title: "Job updated successfully!" });
      } else {
        const { error } = await supabase.from("jobs").insert(formData);
        if (error) throw error;
        toast({ title: "Job created successfully!" });
      }
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowAddDialog(false);
      setEditingJob(null);
      setFormData(emptyFormData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId);
      if (error) throw error;
      toast({ title: "Job deleted" });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const jobsArray = Array.isArray(json) ? json : [json];
        
        // Check for duplicates
        const processedJobs: BulkUploadJob[] = jobsArray.map((job: JobFormData) => {
          const duplicate = jobs?.find(
            (existingJob) =>
              existingJob.title.toLowerCase() === job.title?.toLowerCase() &&
              existingJob.department.toLowerCase() === job.department?.toLowerCase()
          );
          return {
            ...emptyFormData,
            ...job,
            isDuplicate: !!duplicate,
            duplicateOf: duplicate?.id,
          };
        });

        setBulkJobs(processedJobs);
        setShowBulkDialog(true);
      } catch (error) {
        toast({ title: "Error", description: "Invalid JSON file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBulkUpload = async () => {
    const jobsToUpload = bulkJobs.filter((job) => !job.isDuplicate);
    if (jobsToUpload.length === 0) {
      toast({ title: "No new jobs to upload", variant: "destructive" });
      return;
    }

    setBulkUploading(true);
    try {
      const cleanJobs = jobsToUpload.map(({ isDuplicate, duplicateOf, ...job }) => job);
      const { error } = await supabase.from("jobs").insert(cleanJobs);
      if (error) throw error;
      
      toast({ title: `${cleanJobs.length} jobs uploaded successfully!` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowBulkDialog(false);
      setBulkJobs([]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBulkUploading(false);
    }
  };

  const openEditDialog = (job: Job) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      department: job.department,
      location: job.location,
      qualification: job.qualification,
      experience: job.experience || "",
      eligibility: job.eligibility || "",
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      age_min: job.age_min || 18,
      age_max: job.age_max || 65,
      application_fee: job.application_fee || 0,
      vacancies: job.vacancies || 1,
      last_date: job.last_date,
      is_featured: job.is_featured || false,
      description: job.description || "",
      apply_link: job.apply_link || "",
    });
    setShowAddDialog(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-display font-bold text-xl text-foreground">Admin Panel</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button size="sm" onClick={() => { setEditingJob(null); setFormData(emptyFormData); setShowAddDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Jobs ({jobs?.length || 0})</CardTitle>
            <CardDescription>Manage government job listings</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Last Date</TableHead>
                      <TableHead>Vacancies</TableHead>
                      <TableHead>Featured</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs?.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{job.title}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{job.department}</TableCell>
                        <TableCell>{format(new Date(job.last_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{job.vacancies || 1}</TableCell>
                        <TableCell>
                          {job.is_featured && <Badge className="bg-warning text-warning-foreground">Featured</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(job)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteJob(job.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Job Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit Job" : "Add New Job"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="department">Department *</Label>
                <Input id="department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="qualification">Qualification *</Label>
                <Input id="qualification" value={formData.qualification} onChange={(e) => setFormData({ ...formData, qualification: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="experience">Experience</Label>
                <Input id="experience" value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="eligibility">Eligibility</Label>
                <Input id="eligibility" value={formData.eligibility} onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="salary_min">Salary Min</Label>
                <Input id="salary_min" type="number" value={formData.salary_min || ""} onChange={(e) => setFormData({ ...formData, salary_min: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
              <div>
                <Label htmlFor="salary_max">Salary Max</Label>
                <Input id="salary_max" type="number" value={formData.salary_max || ""} onChange={(e) => setFormData({ ...formData, salary_max: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
              <div>
                <Label htmlFor="age_min">Age Min</Label>
                <Input id="age_min" type="number" value={formData.age_min} onChange={(e) => setFormData({ ...formData, age_min: parseInt(e.target.value) || 18 })} />
              </div>
              <div>
                <Label htmlFor="age_max">Age Max</Label>
                <Input id="age_max" type="number" value={formData.age_max} onChange={(e) => setFormData({ ...formData, age_max: parseInt(e.target.value) || 65 })} />
              </div>
              <div>
                <Label htmlFor="application_fee">Application Fee</Label>
                <Input id="application_fee" type="number" value={formData.application_fee} onChange={(e) => setFormData({ ...formData, application_fee: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label htmlFor="vacancies">Vacancies</Label>
                <Input id="vacancies" type="number" value={formData.vacancies} onChange={(e) => setFormData({ ...formData, vacancies: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label htmlFor="last_date">Last Date *</Label>
                <Input id="last_date" type="date" value={formData.last_date} onChange={(e) => setFormData({ ...formData, last_date: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input id="is_featured" type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} className="h-4 w-4" />
                <Label htmlFor="is_featured">Featured</Label>
              </div>
              <div className="col-span-2">
                <Label htmlFor="apply_link">Apply Link</Label>
                <Input id="apply_link" value={formData.apply_link} onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveJob} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingJob ? "Update" : "Create"} Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Preview</DialogTitle>
            <DialogDescription>
              Review jobs before uploading. Duplicates (same title & department) are marked.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkJobs.map((job, index) => (
                  <TableRow key={index} className={job.isDuplicate ? "opacity-50" : ""}>
                    <TableCell>
                      {job.isDuplicate ? (
                        <Badge variant="destructive" className="gap-1">
                          <X className="h-3 w-3" /> Duplicate
                        </Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground gap-1">
                          <Check className="h-3 w-3" /> New
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{job.title}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{job.department}</TableCell>
                    <TableCell>{job.location}</TableCell>
                    <TableCell>{job.last_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-muted-foreground">
              {bulkJobs.filter((j) => !j.isDuplicate).length} new jobs will be uploaded
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
              <Button onClick={handleBulkUpload} disabled={bulkUploading || bulkJobs.filter((j) => !j.isDuplicate).length === 0}>
                {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upload {bulkJobs.filter((j) => !j.isDuplicate).length} Jobs
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
