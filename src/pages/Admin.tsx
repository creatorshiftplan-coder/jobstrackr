import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useJobs } from "@/hooks/useJobs";
import { useAdminStats } from "@/hooks/useAdminStats";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Edit, Loader2, AlertCircle, Check, X, Users, Activity, FileJson, Briefcase } from "lucide-react";
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

interface BulkUploadInput {
  exam_name: string;
  agency: string;
  salary_min?: number | null;
  salary_max?: number | null;
  location: string;
  last_date: string;
  exam_date?: string | null;
  age_limit?: string | null;
  application_fees?: {
    general?: number;
    obc?: number;
    sc_st?: number;
    female?: number;
  };
  job_type?: string;
  description?: string;
  requirements?: string;
  highlights?: string;
  apply_link?: string;
}

const JSON_FORMAT_EXAMPLE = `{
  "jobs": [
    {
      "exam_name": "SSC CGL 2024",
      "agency": "Staff Selection Commission",
      "salary_min": 25000,
      "salary_max": 85000,
      "location": "All India",
      "last_date": "2024-12-31",
      "exam_date": "2025-02-15",
      "age_limit": "18-32 years",
      "application_fees": {
        "general": 100,
        "obc": 100,
        "sc_st": 0,
        "female": 0
      },
      "job_type": "Government",
      "description": "Combined Graduate Level examination",
      "requirements": "Bachelor's Degree",
      "highlights": "10000+ Vacancies"
    }
  ]
}`;

// Parse age_limit string like "18-32 years" into min/max
const parseAgeLimit = (ageLimit?: string | null): { age_min: number; age_max: number } => {
  if (!ageLimit) return { age_min: 18, age_max: 65 };
  const match = ageLimit.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) {
    return { age_min: parseInt(match[1]), age_max: parseInt(match[2]) };
  }
  return { age_min: 18, age_max: 65 };
};

// Map bulk upload input to JobFormData
const mapBulkInputToJobForm = (input: BulkUploadInput): JobFormData => {
  const { age_min, age_max } = parseAgeLimit(input.age_limit);
  const applicationFee = input.application_fees?.general || 0;
  
  return {
    title: input.exam_name,
    department: input.agency,
    location: input.location,
    qualification: input.requirements || "As per notification",
    experience: "",
    eligibility: input.highlights || "",
    salary_min: input.salary_min || null,
    salary_max: input.salary_max || null,
    age_min,
    age_max,
    application_fee: applicationFee,
    vacancies: 1,
    last_date: input.last_date,
    is_featured: false,
    description: input.description || "",
    apply_link: input.apply_link || "",
  };
};

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { userStats, apiStats, isLoading: statsLoading } = useAdminStats();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<JobFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [bulkJobs, setBulkJobs] = useState<BulkUploadJob[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [jsonText, setJsonText] = useState("");

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
        const { error } = await supabase.from("jobs").update(formData).eq("id", editingJob.id);
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

  const handleParseJSON = () => {
    if (!jsonText.trim()) {
      toast({ title: "Error", description: "Please paste JSON data", variant: "destructive" });
      return;
    }

    try {
      const json = JSON.parse(jsonText);
      
      // Support both { "jobs": [...] } wrapper and direct array
      let jobsArray: BulkUploadInput[];
      if (json.jobs && Array.isArray(json.jobs)) {
        jobsArray = json.jobs;
      } else if (Array.isArray(json)) {
        jobsArray = json;
      } else {
        jobsArray = [json];
      }
      
      const processedJobs: BulkUploadJob[] = jobsArray.map((input: BulkUploadInput) => {
        // Map the input format to JobFormData
        const jobData = mapBulkInputToJobForm(input);
        
        // Check for duplicates based on exam_name (title) and agency (department)
        const duplicate = jobs?.find(
          (existingJob) =>
            existingJob.title.toLowerCase() === jobData.title?.toLowerCase() &&
            existingJob.department.toLowerCase() === jobData.department?.toLowerCase()
        );
        
        return {
          ...jobData,
          isDuplicate: !!duplicate,
          duplicateOf: duplicate?.id,
        };
      });

      setBulkJobs(processedJobs);
      setShowBulkDialog(true);
    } catch (error) {
      toast({ title: "Error", description: "Invalid JSON format. Please check the syntax.", variant: "destructive" });
    }
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
      setJsonText("");
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
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display font-bold text-xl text-foreground">Admin Panel</h1>
        </div>
      </header>

      <main className="p-4">
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="jobs" className="gap-1">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">API Usage</span>
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1">
              <FileJson className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk Upload</span>
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs">
            <Card className="border-0 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Jobs ({jobs?.length || 0})</CardTitle>
                  <CardDescription>Manage government job listings</CardDescription>
                </div>
                <Button size="sm" onClick={() => { setEditingJob(null); setFormData(emptyFormData); setShowAddDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Job
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
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
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Users</CardDescription>
                  <CardTitle className="text-3xl">{statsLoading ? "..." : userStats.totalUsers}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Today's Registrations</CardDescription>
                  <CardTitle className="text-3xl">{statsLoading ? "..." : userStats.todayRegistrations}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>This Week</CardDescription>
                  <CardTitle className="text-3xl">{statsLoading ? "..." : userStats.weekRegistrations}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Registrations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userStats.recentUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name || "Not set"}</TableCell>
                            <TableCell>{user.email || "Not set"}</TableCell>
                            <TableCell>{format(new Date(user.created_at), "dd MMM yyyy")}</TableCell>
                          </TableRow>
                        ))}
                        {userStats.recentUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              No users registered yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total AI Searches</CardDescription>
                  <CardTitle className="text-2xl">{statsLoading ? "..." : apiStats.totalSearches}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Today's Searches</CardDescription>
                  <CardTitle className="text-2xl">{statsLoading ? "..." : apiStats.todaySearches}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg Latency</CardDescription>
                  <CardTitle className="text-2xl">{statsLoading ? "..." : `${apiStats.avgLatency}ms`}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Success Rate</CardDescription>
                  <CardTitle className="text-2xl">{statsLoading ? "..." : `${apiStats.successRate}%`}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent AI Searches</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Query</TableHead>
                          <TableHead>Latency</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiStats.recentSearches.map((search) => (
                          <TableRow key={search.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{search.query}</TableCell>
                            <TableCell>{search.latency_ms ? `${search.latency_ms}ms` : "-"}</TableCell>
                            <TableCell>
                              {search.parse_ok ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <Check className="h-3 w-3 mr-1" /> Success
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-destructive border-destructive">
                                  <X className="h-3 w-3 mr-1" /> Failed
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(search.created_at), "dd MMM, HH:mm")}</TableCell>
                          </TableRow>
                        ))}
                        {apiStats.recentSearches.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No AI searches yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Upload Tab */}
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Job Upload</CardTitle>
                <CardDescription>
                  Paste JSON data in the format below. The app will check for duplicates before uploading.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">JSON Format Example</Label>
                  <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{JSON_FORMAT_EXAMPLE}</pre>
                  </div>
                </div>

                <div>
                  <Label htmlFor="jsonInput" className="text-sm font-medium mb-2 block">Paste JSON Data</Label>
                  <Textarea
                    id="jsonInput"
                    placeholder="Paste your JSON array here..."
                    rows={12}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <Button onClick={handleParseJSON} disabled={!jsonText.trim()}>
                  <FileJson className="h-4 w-4 mr-2" />
                  Preview Jobs
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

      {/* Bulk Upload Preview Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Preview</DialogTitle>
            <DialogDescription>
              Review jobs before uploading. Duplicates (same title & department) are marked and will be skipped.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
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
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                          <Check className="h-3 w-3" /> New
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-[150px] truncate">{job.title}</TableCell>
                    <TableCell className="max-w-[100px] truncate">{job.department}</TableCell>
                    <TableCell>{job.location}</TableCell>
                    <TableCell>{job.last_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="text-sm text-muted-foreground">
              {bulkJobs.filter(j => !j.isDuplicate).length} new jobs, {bulkJobs.filter(j => j.isDuplicate).length} duplicates
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
              <Button onClick={handleBulkUpload} disabled={bulkUploading || bulkJobs.filter(j => !j.isDuplicate).length === 0}>
                {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upload {bulkJobs.filter(j => !j.isDuplicate).length} Jobs
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
