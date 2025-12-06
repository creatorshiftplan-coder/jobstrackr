import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
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
import { ArrowLeft, Plus, Trash2, Edit, Loader2, AlertCircle, Check, X, Users, Activity, FileJson, Briefcase, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Replace } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  vacancies: number | null;
  vacancies_display: string | null;
  last_date: string;
  last_date_display: string | null;
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
  vacancies: null,
  vacancies_display: null,
  last_date: "",
  last_date_display: null,
  is_featured: false,
  description: "",
  apply_link: "",
};

interface BulkUploadJob extends JobFormData {
  isDuplicate?: boolean;
  duplicateOf?: string;
  matchType?: "exact" | "similar" | "none";
  similarityScore?: number;
}

// Helper to check if a value is a TBD-like string
const isTBDValue = (value: string | number | null | undefined): boolean => {
  if (typeof value !== 'string') return false;
  const tbdPatterns = ['tbd', 'to be announced', 'walk in', 'walk-in', 'walkin', 'n/a', 'na', 'not available', 'not applicable', '-', 'nil', 'various', 'multiple', 'as per rules'];
  const lowerValue = value.toLowerCase().trim();
  return tbdPatterns.some(pattern => lowerValue === pattern || lowerValue.includes(pattern));
};

// Helper to parse vacancies - returns null for TBD-like values
const parseVacancies = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (isTBDValue(value)) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

// Helper to parse date - returns a far future date for TBD-like values so the job remains active
const parseDateValue = (value: string | null | undefined): string => {
  if (!value) return new Date().toISOString().split('T')[0]; // Default to today if empty
  if (isTBDValue(value)) {
    // Return a date 1 year from now for TBD dates to keep job active
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    return futureDate.toISOString().split('T')[0];
  }
  // Check if it's a valid date format
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    // Invalid date, return 1 year from now
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    return futureDate.toISOString().split('T')[0];
  }
  return value;
};

interface BulkUploadInput {
  exam_name: string;
  agency: string;
  salary_min?: number | null;
  salary_max?: number | null;
  location: string;
  last_date: string;
  exam_date?: string | null;
  age_limit?: string | null;
  vacancies?: number | string;
  eligibility?: string;
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
      "exam_name": "SSC CGL 2025",
      "agency": "Staff Selection Commission",
      "salary_min": 25000,
      "salary_max": 85000,
      "location": "All India",
      "last_date": "2025-02-15",
      "exam_date": "2025-04-01",
      "age_limit": "18-32 years",
      "vacancies": 10000,
      "eligibility": "Bachelor's Degree from a recognized university",
      "application_fees": {
        "general": 100,
        "obc": 100,
        "sc_st": 0,
        "female": 0
      },
      "job_type": "Government",
      "description": "Combined Graduate Level examination",
      "requirements": "Bachelor's Degree",
      "highlights": "10000+ Vacancies",
      "apply_link": "https://ssc.nic.in"
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

// Calculate similarity score between two strings (0-100%)
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 100;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 85;
  
  // Token-based matching (word overlap)
  const tokens1 = s1.split(/\s+/).filter(t => t.length > 2);
  const tokens2 = s2.split(/\s+/).filter(t => t.length > 2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const commonTokens = tokens1.filter(t => tokens2.includes(t));
  const tokenScore = (commonTokens.length * 2) / (tokens1.length + tokens2.length) * 100;
  
  return Math.round(tokenScore);
};

// Check if jobs are similar based on multiple fields
const checkJobSimilarity = (newJob: JobFormData, existingJob: Job): { isSimilar: boolean; score: number; matchType: "exact" | "similar" | "none" } => {
  const titleSimilarity = calculateSimilarity(newJob.title, existingJob.title);
  const deptSimilarity = calculateSimilarity(newJob.department, existingJob.department);
  
  // Exact match: both title and department match 100%
  if (titleSimilarity === 100 && deptSimilarity === 100) {
    return { isSimilar: true, score: 100, matchType: "exact" };
  }
  
  // Similar match: high title similarity (>70%) AND same/similar department (>80%)
  if (titleSimilarity >= 70 && deptSimilarity >= 80) {
    const avgScore = Math.round((titleSimilarity + deptSimilarity) / 2);
    return { isSimilar: true, score: avgScore, matchType: "similar" };
  }
  
  // Also check location + department for additional context
  const locationMatch = newJob.location?.toLowerCase() === existingJob.location?.toLowerCase();
  if (titleSimilarity >= 60 && deptSimilarity >= 60 && locationMatch) {
    const avgScore = Math.round((titleSimilarity + deptSimilarity) / 2);
    return { isSimilar: true, score: avgScore, matchType: "similar" };
  }
  
  return { isSimilar: false, score: 0, matchType: "none" };
};

// Map bulk upload input to JobFormData
const mapBulkInputToJobForm = (input: BulkUploadInput): JobFormData => {
  const { age_min, age_max } = parseAgeLimit(input.age_limit);
  const applicationFee = input.application_fees?.general || 0;
  
  // Build description with job_type and highlights if provided
  let fullDescription = input.description || "";
  if (input.job_type && !fullDescription.includes(input.job_type)) {
    fullDescription = `[${input.job_type}] ${fullDescription}`;
  }
  if (input.highlights && !fullDescription.includes(input.highlights)) {
    fullDescription = `${fullDescription} | Highlights: ${input.highlights}`;
  }
  
  // Determine display values for vacancies and last_date
  const isTBDVacancies = isTBDValue(input.vacancies);
  const vacanciesDisplay = input.vacancies !== undefined && input.vacancies !== null 
    ? String(input.vacancies) 
    : null;
  
  const isTBDDate = isTBDValue(input.last_date);
  const lastDateDisplay = isTBDDate 
    ? String(input.last_date)
    : input.last_date || null;
  
  return {
    title: input.exam_name,
    department: input.agency,
    location: input.location,
    qualification: input.requirements || "",
    experience: "",
    eligibility: input.eligibility ?? null,
    salary_min: input.salary_min ?? null,
    salary_max: input.salary_max ?? null,
    age_min,
    age_max,
    application_fee: applicationFee,
    vacancies: parseVacancies(input.vacancies),
    vacancies_display: vacanciesDisplay,
    last_date: parseDateValue(input.last_date),
    last_date_display: lastDateDisplay,
    is_featured: false,
    description: fullDescription.trim(),
    apply_link: input.apply_link || "",
  };
};

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useAdminRole();
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
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update" | "replace">("skip");
  
  // Filters for jobs
  const [lastDateFilter, setLastDateFilter] = useState<string>("all");
  const [vacanciesFilter, setVacanciesFilter] = useState<string>("all");
  
  // Sorting for jobs
  const [sortField, setSortField] = useState<"last_date" | "vacancies" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "last_date" | "vacancies") => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        // Reset sorting on third click
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: "last_date" | "vacancies") => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4 ml-1" />;
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Filter and sort jobs
  const filteredJobs = jobs?.filter((job) => {
    // Last date filter
    if (lastDateFilter !== "all") {
      const today = new Date();
      const lastDate = new Date(job.last_date);
      
      if (lastDateFilter === "expired" && lastDate >= today) return false;
      if (lastDateFilter === "active" && lastDate < today) return false;
      if (lastDateFilter === "7days") {
        const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (lastDate < today || lastDate > sevenDays) return false;
      }
      if (lastDateFilter === "30days") {
        const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (lastDate < today || lastDate > thirtyDays) return false;
      }
    }
    
    // Vacancies filter
    if (vacanciesFilter !== "all") {
      const vacancies = job.vacancies || 1;
      if (vacanciesFilter === "1-10" && (vacancies < 1 || vacancies > 10)) return false;
      if (vacanciesFilter === "11-50" && (vacancies < 11 || vacancies > 50)) return false;
      if (vacanciesFilter === "51-100" && (vacancies < 51 || vacancies > 100)) return false;
      if (vacanciesFilter === "100+" && vacancies <= 100) return false;
    }
    
    return true;
  }).sort((a, b) => {
    if (!sortField) return 0;
    
    if (sortField === "last_date") {
      const dateA = new Date(a.last_date).getTime();
      const dateB = new Date(b.last_date).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }
    
    if (sortField === "vacancies") {
      const vacA = a.vacancies || 1;
      const vacB = b.vacancies || 1;
      return sortDirection === "asc" ? vacA - vacB : vacB - vacA;
    }
    
    return 0;
  });

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You don't have permission to access the admin panel.</p>
            <Link to="/">
              <Button>Go Home</Button>
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
        
        // Find best matching existing job using similarity detection
        let bestMatch: { job: Job | null; score: number; matchType: "exact" | "similar" | "none" } = 
          { job: null, score: 0, matchType: "none" };
        
        for (const existingJob of jobs || []) {
          const similarity = checkJobSimilarity(jobData, existingJob);
          if (similarity.isSimilar && similarity.score > bestMatch.score) {
            bestMatch = { job: existingJob, score: similarity.score, matchType: similarity.matchType };
          }
        }
        
        return {
          ...jobData,
          isDuplicate: bestMatch.job !== null,
          duplicateOf: bestMatch.job?.id,
          matchType: bestMatch.matchType,
          similarityScore: bestMatch.score,
        };
      });

      setBulkJobs(processedJobs);
      setShowBulkDialog(true);
    } catch (error) {
      toast({ title: "Error", description: "Invalid JSON format. Please check the syntax.", variant: "destructive" });
    }
  };

  const handleBulkUpload = async () => {
    const newJobs = bulkJobs.filter((job) => !job.isDuplicate);
    const duplicateJobs = bulkJobs.filter((job) => job.isDuplicate);
    
    const hasNewJobs = newJobs.length > 0;
    const hasUpdates = (duplicateMode === "update" || duplicateMode === "replace") && duplicateJobs.length > 0;
    
    if (!hasNewJobs && !hasUpdates) {
      toast({ title: "No jobs to upload or update", variant: "destructive" });
      return;
    }

    setBulkUploading(true);
    try {
      let insertedCount = 0;
      let updatedCount = 0;
      let replacedCount = 0;
      
      // Insert new jobs
      if (newJobs.length > 0) {
        const cleanNewJobs = newJobs.map(({ isDuplicate, duplicateOf, matchType, similarityScore, ...job }) => job);
        const { error } = await supabase.from("jobs").insert(cleanNewJobs);
        if (error) throw error;
        insertedCount = cleanNewJobs.length;
      }
      
      // Update existing job records (keep ID)
      if (duplicateMode === "update" && duplicateJobs.length > 0) {
        for (const dupJob of duplicateJobs) {
          const { isDuplicate, duplicateOf, matchType, similarityScore, ...jobData } = dupJob;
          if (duplicateOf) {
            const { error } = await supabase.from("jobs").update(jobData).eq("id", duplicateOf);
            if (error) throw error;
            updatedCount++;
          }
        }
      }
      
      // Replace: delete old, add new (new ID)
      if (duplicateMode === "replace" && duplicateJobs.length > 0) {
        for (const dupJob of duplicateJobs) {
          const { isDuplicate, duplicateOf, matchType, similarityScore, ...jobData } = dupJob;
          if (duplicateOf) {
            // Delete old job
            await supabase.from("jobs").delete().eq("id", duplicateOf);
            // Insert as new
            const { error } = await supabase.from("jobs").insert(jobData);
            if (error) throw error;
            replacedCount++;
          }
        }
      }
      
      const messages = [];
      if (insertedCount > 0) messages.push(`${insertedCount} jobs created`);
      if (updatedCount > 0) messages.push(`${updatedCount} jobs updated`);
      if (replacedCount > 0) messages.push(`${replacedCount} jobs replaced`);
      if (duplicateMode === "skip" && duplicateJobs.length > 0) {
        messages.push(`${duplicateJobs.length} duplicates skipped`);
      }
      
      toast({ title: messages.join(", ") + "!" });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowBulkDialog(false);
      setBulkJobs([]);
      setJsonText("");
      setDuplicateMode("skip");
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
      vacancies: job.vacancies,
      vacancies_display: job.vacancies_display,
      last_date: job.last_date,
      last_date_display: job.last_date_display,
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
              <CardHeader className="space-y-4">
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Jobs ({filteredJobs?.length || 0} of {jobs?.length || 0})</CardTitle>
                    <CardDescription>Manage government job listings</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => { setEditingJob(null); setFormData(emptyFormData); setShowAddDialog(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Job
                  </Button>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Filters:</span>
                  </div>
                  
                  <Select value={lastDateFilter} onValueChange={setLastDateFilter}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Last Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="7days">Next 7 Days</SelectItem>
                      <SelectItem value="30days">Next 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={vacanciesFilter} onValueChange={setVacanciesFilter}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Vacancies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vacancies</SelectItem>
                      <SelectItem value="1-10">1-10</SelectItem>
                      <SelectItem value="11-50">11-50</SelectItem>
                      <SelectItem value="51-100">51-100</SelectItem>
                      <SelectItem value="100+">100+</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {(lastDateFilter !== "all" || vacanciesFilter !== "all") && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setLastDateFilter("all"); setVacanciesFilter("all"); }}
                      className="text-muted-foreground"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
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
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("last_date")}
                          >
                            <div className="flex items-center">
                              Last Date
                              {getSortIcon("last_date")}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("vacancies")}
                          >
                            <div className="flex items-center">
                              Vacancies
                              {getSortIcon("vacancies")}
                            </div>
                          </TableHead>
                          <TableHead>Featured</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs?.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{job.title}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{job.department}</TableCell>
                            <TableCell>
                              <span className={new Date(job.last_date) < new Date() ? "text-destructive" : ""}>
                                {format(new Date(job.last_date), "dd MMM yyyy")}
                              </span>
                            </TableCell>
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
                        {filteredJobs?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No jobs match the selected filters
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
              Review jobs before uploading. Duplicates are detected by matching title & department.
            </DialogDescription>
          </DialogHeader>
          
          {/* Duplicate & Similar Job Handling Options */}
          {bulkJobs.some(j => j.isDuplicate) && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm font-medium mb-3">Duplicate & Similar Job Handling</p>
              <RadioGroup value={duplicateMode} onValueChange={(v) => setDuplicateMode(v as "skip" | "update" | "replace")} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip" className="text-sm font-normal cursor-pointer">
                    Skip <span className="text-muted-foreground">(only upload new jobs)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id="update" />
                  <Label htmlFor="update" className="text-sm font-normal cursor-pointer">
                    Update existing <span className="text-muted-foreground">(modify existing records with new data, keep ID)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="replace" />
                  <Label htmlFor="replace" className="text-sm font-normal cursor-pointer">
                    Replace <span className="text-muted-foreground">(delete old & add as new jobs with new ID)</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Matched With</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkJobs.map((job, index) => (
                  <TableRow 
                    key={index} 
                    className={
                      job.isDuplicate 
                        ? duplicateMode === "skip" 
                          ? "opacity-50" 
                          : duplicateMode === "update"
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : "bg-blue-50 dark:bg-blue-950/20"
                        : ""
                    }
                  >
                    <TableCell>
                      {job.isDuplicate ? (
                        <>
                          {duplicateMode === "skip" && (
                            <Badge variant="destructive" className="gap-1">
                              <X className="h-3 w-3" /> Skip
                            </Badge>
                          )}
                          {duplicateMode === "update" && (
                            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400">
                              <RefreshCw className="h-3 w-3" /> Update
                            </Badge>
                          )}
                          {duplicateMode === "replace" && (
                            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400">
                              <Replace className="h-3 w-3" /> Replace
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-600 dark:text-green-400 dark:border-green-400">
                          <Check className="h-3 w-3" /> New
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.isDuplicate && (
                        <Badge variant="secondary" className="text-xs">
                          {job.matchType === "exact" ? "Exact" : `~${job.similarityScore}%`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-[150px] truncate">{job.title}</TableCell>
                    <TableCell className="max-w-[100px] truncate">{job.department}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {job.isDuplicate ? jobs?.find(j => j.id === job.duplicateOf)?.title || "-" : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="text-sm text-muted-foreground flex-1">
              {bulkJobs.filter(j => !j.isDuplicate).length} new
              {bulkJobs.filter(j => j.matchType === "exact").length > 0 && `, ${bulkJobs.filter(j => j.matchType === "exact").length} exact match`}
              {bulkJobs.filter(j => j.matchType === "similar").length > 0 && `, ${bulkJobs.filter(j => j.matchType === "similar").length} similar`}
              {duplicateMode === "skip" && bulkJobs.filter(j => j.isDuplicate).length > 0
                ? " (will be skipped)"
                : duplicateMode === "update" && bulkJobs.filter(j => j.isDuplicate).length > 0
                  ? " (will be updated)"
                  : duplicateMode === "replace" && bulkJobs.filter(j => j.isDuplicate).length > 0
                    ? " (will be replaced)"
                    : ""
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleBulkUpload} 
                disabled={bulkUploading || (bulkJobs.filter(j => !j.isDuplicate).length === 0 && duplicateMode === "skip")}
              >
                {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {duplicateMode === "skip" 
                  ? `Upload ${bulkJobs.filter(j => !j.isDuplicate).length} Jobs`
                  : `Process ${bulkJobs.length} Jobs`
                }
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
