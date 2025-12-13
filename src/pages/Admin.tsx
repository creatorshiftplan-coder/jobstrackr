import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useJobs } from "@/hooks/useJobs";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Edit, Loader2, AlertCircle, Check, X, Users, Activity, FileJson, Briefcase, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Replace, BarChart3, Eye, MousePointerClick, TrendingUp, Image, Upload, CheckCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Job } from "@/types/job";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";

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

// Comprehensive JSON Schema Validation for Bulk Upload
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validItems: BulkUploadInput[];
  invalidIndices: number[];
}

const validateBulkUploadInput = (data: unknown): ValidationResult => {
  const errors: string[] = [];
  const validItems: BulkUploadInput[] = [];
  const invalidIndices: number[] = [];

  // Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, errors: ['Invalid JSON: Expected an object or array'], validItems: [], invalidIndices: [] };
  }

  // Extract jobs array from data
  let jobsArray: unknown[];
  if (Array.isArray(data)) {
    jobsArray = data;
  } else if ('jobs' in data && Array.isArray((data as { jobs: unknown }).jobs)) {
    jobsArray = (data as { jobs: unknown[] }).jobs;
  } else {
    // Single job object
    jobsArray = [data];
  }

  // Validate each job
  jobsArray.forEach((item, index) => {
    const itemErrors: string[] = [];

    if (typeof item !== 'object' || item === null) {
      errors.push(`Item ${index + 1}: Invalid format - expected an object`);
      invalidIndices.push(index);
      return;
    }

    const job = item as Record<string, unknown>;

    // Required fields
    if (!job.exam_name || typeof job.exam_name !== 'string' || job.exam_name.trim() === '') {
      itemErrors.push('exam_name is required and must be a non-empty string');
    }
    if (!job.agency || typeof job.agency !== 'string' || job.agency.trim() === '') {
      itemErrors.push('agency is required and must be a non-empty string');
    }
    if (!job.location || typeof job.location !== 'string' || job.location.trim() === '') {
      itemErrors.push('location is required and must be a non-empty string');
    }
    if (!job.last_date || typeof job.last_date !== 'string' || job.last_date.trim() === '') {
      itemErrors.push('last_date is required and must be a non-empty string');
    }

    // Optional field type validation
    if (job.salary_min !== undefined && job.salary_min !== null && typeof job.salary_min !== 'number') {
      itemErrors.push('salary_min must be a number');
    }
    if (job.salary_max !== undefined && job.salary_max !== null && typeof job.salary_max !== 'number') {
      itemErrors.push('salary_max must be a number');
    }
    if (job.apply_link && typeof job.apply_link === 'string' && job.apply_link.trim() !== '') {
      try {
        new URL(job.apply_link);
      } catch {
        itemErrors.push('apply_link must be a valid URL');
      }
    }

    // Validate application_fees structure if present
    if (job.application_fees !== undefined && job.application_fees !== null) {
      if (typeof job.application_fees !== 'object') {
        itemErrors.push('application_fees must be an object');
      } else {
        const fees = job.application_fees as Record<string, unknown>;
        ['general', 'obc', 'sc_st', 'female'].forEach(key => {
          if (fees[key] !== undefined && typeof fees[key] !== 'number') {
            itemErrors.push(`application_fees.${key} must be a number`);
          }
        });
      }
    }

    if (itemErrors.length > 0) {
      errors.push(`Item ${index + 1} (${(job.exam_name as string) || 'Unknown'}): ${itemErrors.join('; ')}`);
      invalidIndices.push(index);
    } else {
      validItems.push(item as BulkUploadInput);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validItems,
    invalidIndices
  };
};

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
  const analyticsData = useAnalyticsData();
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

  // Logo management
  const { logos, isLoading: logosLoading, uploadLogo, deleteLogo, refetch: refetchLogos } = useConductingBodyLogos();
  const [logoName, setLogoName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Delete confirmation dialog state
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Refresh job data state
  const [refreshingJobId, setRefreshingJobId] = useState<string | null>(null);
  const [showRefreshPreview, setShowRefreshPreview] = useState(false);
  const [refreshPreviewData, setRefreshPreviewData] = useState<{
    jobId: string;
    jobTitle: string;
    current: Record<string, any>;
    new: Record<string, any>;
  } | null>(null);
  const [applyingRefresh, setApplyingRefresh] = useState(false);

  // Filters for jobs
  const [lastDateFilter, setLastDateFilter] = useState<string>("all");
  const [vacanciesFilter, setVacanciesFilter] = useState<string>("all");
  const [applyLinkFilter, setApplyLinkFilter] = useState<string>("all");

  // Filter for users by qualification
  const [qualificationFilter, setQualificationFilter] = useState<string>("all");

  // Filter users by qualification
  const filteredUsers = userStats.allUsers?.filter((user) => {
    if (qualificationFilter === "all") return true;
    if (qualificationFilter === "none") return !user.highest_qualification;

    const userQual = user.highest_qualification?.toLowerCase() || "";
    const filterQual = qualificationFilter.toLowerCase();

    // Handle various qualification naming variants
    if (filterQual === "8th pass") {
      return userQual.includes("8th") || userQual === "8th pass";
    }
    if (filterQual === "10th pass") {
      return userQual.includes("10th") || userQual === "10th pass" || userQual === "10th";
    }
    if (filterQual === "12th pass") {
      return userQual.includes("12th") || userQual === "12th pass" || userQual === "12th";
    }
    if (filterQual === "graduate") {
      return userQual === "graduate" || userQual === "graduation";
    }
    if (filterQual === "postgraduate") {
      return userQual.includes("postgraduate") || userQual.includes("post-graduation");
    }
    if (filterQual === "diploma / iti") {
      return userQual.includes("diploma") || userQual.includes("iti");
    }

    return userQual.includes(filterQual);
  }) || [];

  // Sorting for jobs
  const [sortField, setSortField] = useState<"last_date" | "vacancies" | "title" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "last_date" | "vacancies" | "title") => {
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

  const getSortIcon = (field: "last_date" | "vacancies" | "title") => {
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

    // Apply link filter
    if (applyLinkFilter === "missing") {
      if (job.apply_link && job.apply_link.trim() !== "") return false;
    } else if (applyLinkFilter === "present") {
      if (!job.apply_link || job.apply_link.trim() === "") return false;
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

    if (sortField === "title") {
      return sortDirection === "asc"
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
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
    setDeleteJobId(jobId);
  };

  const confirmDeleteJob = async () => {
    if (!deleteJobId) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", deleteJobId);
      if (error) throw error;
      toast({ title: "Job deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteJobId(null);
    }
  };

  // Refresh job data handler - fetches preview
  const handleRefreshJobData = async (job: Job) => {
    setRefreshingJobId(job.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-job-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ jobId: job.id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch data");

      if (result.status === "preview") {
        setRefreshPreviewData({
          jobId: job.id,
          jobTitle: job.title,
          current: result.current,
          new: result.new,
        });
        setShowRefreshPreview(true);
      }
    } catch (error: any) {
      toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
    } finally {
      setRefreshingJobId(null);
    }
  };

  // Apply refresh changes
  const applyRefreshChanges = async () => {
    if (!refreshPreviewData) return;

    setApplyingRefresh(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-job-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId: refreshPreviewData.jobId,
            applyData: refreshPreviewData.new,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to apply changes");

      toast({ title: "Job updated!", description: `${result.fieldsUpdated} fields updated. Verified badge added.` });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowRefreshPreview(false);
      setRefreshPreviewData(null);
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setApplyingRefresh(false);
    }
  };

  const handleParseJSON = () => {
    if (!jsonText.trim()) {
      toast({ title: "Error", description: "Please paste JSON data", variant: "destructive" });
      return;
    }

    try {
      const json = JSON.parse(jsonText);

      // Validate the JSON structure and content
      const validation = validateBulkUploadInput(json);

      if (validation.errors.length > 0 && validation.validItems.length === 0) {
        // All items are invalid
        toast({
          title: "Validation Failed",
          description: validation.errors.slice(0, 3).join('\n') + (validation.errors.length > 3 ? `\n...and ${validation.errors.length - 3} more errors` : ''),
          variant: "destructive"
        });
        return;
      }

      if (validation.errors.length > 0) {
        // Some items are invalid, warn user but continue with valid ones
        toast({
          title: "Partial Validation",
          description: `${validation.validItems.length} valid, ${validation.invalidIndices.length} invalid items. Invalid items will be skipped.`,
          variant: "default"
        });
      }

      const processedJobs: BulkUploadJob[] = validation.validItems.map((input: BulkUploadInput) => {
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
      toast({ title: "Error", description: "Invalid JSON syntax. Please check your input.", variant: "destructive" });
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
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="jobs" className="gap-1">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="user-analytics" className="gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1">
              <FileJson className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk</span>
            </TabsTrigger>
            <TabsTrigger value="logos" className="gap-1">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Logos</span>
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

                  <Select value={applyLinkFilter} onValueChange={setApplyLinkFilter}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Apply Link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      <SelectItem value="missing">Missing Link</SelectItem>
                      <SelectItem value="present">Has Link</SelectItem>
                    </SelectContent>
                  </Select>

                  {(lastDateFilter !== "all" || vacanciesFilter !== "all" || applyLinkFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setLastDateFilter("all"); setVacanciesFilter("all"); setApplyLinkFilter("all"); }}
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
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 select-none"
                            onClick={() => handleSort("title")}
                          >
                            <div className="flex items-center">
                              Title
                              {getSortIcon("title")}
                            </div>
                          </TableHead>
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
                          <TableHead>Status</TableHead>
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
                              <div className="flex gap-1 flex-wrap">
                                {job.is_featured && <Badge className="bg-warning text-warning-foreground">Featured</Badge>}
                                {job.admin_refreshed_at && (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Verified
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRefreshJobData(job)}
                                  disabled={refreshingJobId === job.id}
                                  title="Refresh job data via AI"
                                >
                                  {refreshingJobId === job.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 text-blue-500" />
                                  )}
                                </Button>
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
                <CardTitle>All Registered Users</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Qualification</TableHead>
                          <TableHead>API Calls</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userStats.allUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name || "Not set"}</TableCell>
                            <TableCell>{user.email || "Not set"}</TableCell>
                            <TableCell>
                              {user.highest_qualification ? (
                                <Badge variant="secondary">{user.highest_qualification}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.api_call_count > 0 ? "default" : "outline"}>
                                {user.api_call_count}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(user.created_at), "dd MMM yyyy")}</TableCell>
                          </TableRow>
                        ))}
                        {userStats.allUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No registered users yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
                <div className="p-4 border-t text-sm text-muted-foreground">
                  Total: {userStats.allUsers.length} users
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Analytics Tab */}
          <TabsContent value="user-analytics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Page Views
                  </CardDescription>
                  <CardTitle className="text-2xl">{analyticsData.isLoading ? "..." : analyticsData.totalPageViews}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" />
                    Interactions
                  </CardDescription>
                  <CardTitle className="text-2xl">{analyticsData.isLoading ? "..." : analyticsData.totalFeatureUsage}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Top Page
                  </CardDescription>
                  <CardTitle className="text-lg truncate">{analyticsData.isLoading ? "..." : (analyticsData.pageViewsByPage[0]?.page_name || "N/A")}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    Days Active
                  </CardDescription>
                  <CardTitle className="text-2xl">{analyticsData.isLoading ? "..." : analyticsData.dailyActivity.length}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Page Views by Page */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Page Views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsData.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : analyticsData.pageViewsByPage.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No page views recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {analyticsData.pageViewsByPage.map((page) => (
                        <div key={page.page_name} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{page.page_name}</span>
                          <Badge variant="secondary">{page.view_count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Feature Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4" />
                    Feature Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsData.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : analyticsData.featureUsage.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No feature interactions recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {analyticsData.featureUsage.map((feature) => (
                        <div key={feature.feature_name} className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate max-w-[150px]">{feature.feature_name}</span>
                          <Badge variant="secondary">{feature.usage_count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Daily Activity */}
            {analyticsData.dailyActivity.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Daily Activity (Last 14 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-20">
                    {analyticsData.dailyActivity.map((day) => {
                      const maxCount = Math.max(...analyticsData.dailyActivity.map(d => d.count));
                      const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors relative group"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-xs px-1 rounded">
                            {day.count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{analyticsData.dailyActivity[0]?.date.slice(5)}</span>
                    <span>{analyticsData.dailyActivity[analyticsData.dailyActivity.length - 1]?.date.slice(5)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
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

          {/* Logos Tab */}
          <TabsContent value="logos">
            <Card>
              <CardHeader>
                <CardTitle>Conducting Body Logos</CardTitle>
                <CardDescription>
                  Upload logos for conducting bodies. Use the exact name as it appears in exams (e.g., "Staff Selection Commission").
                  Recommended size: 128×128px or 256×256px PNG with transparent background.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Form */}
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="logoName" className="text-sm font-medium mb-2 block">
                      Conducting Body Name
                    </Label>
                    <Input
                      id="logoName"
                      placeholder="e.g., Staff Selection Commission"
                      value={logoName}
                      onChange={(e) => setLogoName(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="logoFile" className="text-sm font-medium mb-2 block">
                      Logo File (PNG/JPG)
                    </Label>
                    <Input
                      id="logoFile"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (logoName && logoFile) {
                        uploadLogo.mutate({ name: logoName, file: logoFile });
                        setLogoName("");
                        setLogoFile(null);
                        // Reset file input
                        const input = document.getElementById("logoFile") as HTMLInputElement;
                        if (input) input.value = "";
                      } else {
                        toast({ title: "Missing fields", description: "Please enter a name and select a file", variant: "destructive" });
                      }
                    }}
                    disabled={!logoName || !logoFile || uploadLogo.isPending}
                  >
                    {uploadLogo.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload
                  </Button>
                </div>

                {/* Logo Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">
                      Existing Logos ({logos.length})
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => refetchLogos()}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>

                  {logosLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : logos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No logos uploaded yet.</p>
                      <p className="text-xs mt-1">Upload logos above to display them on Trending cards.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {logos.map((logo) => (
                        <div
                          key={logo.id}
                          className="group relative bg-secondary rounded-xl p-4 flex flex-col items-center"
                        >
                          <img
                            src={logo.logo_url}
                            alt={logo.name}
                            className="h-16 w-16 object-contain mb-2"
                          />
                          <p className="text-xs text-center font-medium truncate w-full">
                            {logo.name}
                          </p>
                          <button
                            onClick={() => {
                              const fileName = logo.logo_url.split("/").pop();
                              if (fileName) deleteLogo.mutate(fileName);
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={(open) => !open && setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refresh Preview Dialog */}
      <Dialog open={showRefreshPreview} onOpenChange={(open) => !open && setShowRefreshPreview(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Job Data Refresh</DialogTitle>
            <DialogDescription>
              Review the changes before applying. Green indicates updated values.
            </DialogDescription>
          </DialogHeader>
          {refreshPreviewData && (
            <div className="space-y-4">
              <div className="text-sm font-medium">{refreshPreviewData.jobTitle}</div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Field</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>New</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: "location", label: "Location" },
                      { key: "vacancies", label: "Vacancies" },
                      { key: "eligibility", label: "Eligibility" },
                      { key: "application_start_date", label: "Start Date" },
                      { key: "last_date", label: "Last Date" },
                      { key: "age_min", label: "Min Age" },
                      { key: "age_max", label: "Max Age" },
                      { key: "apply_link", label: "Apply Link" },
                    ].map(({ key, label }) => {
                      const currentVal = refreshPreviewData.current[key];
                      const newVal = refreshPreviewData.new[key];
                      const hasChange = newVal !== undefined && newVal !== null && String(newVal) !== String(currentVal || "");

                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {currentVal || <span className="italic">Not set</span>}
                          </TableCell>
                          <TableCell className={`max-w-[200px] truncate ${hasChange ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                            {newVal !== undefined && newVal !== null ? (
                              <>
                                {hasChange && <Check className="h-3 w-3 inline mr-1" />}
                                {String(newVal)}
                              </>
                            ) : (
                              <span className="italic">No update</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {refreshPreviewData.new.confidence !== undefined && (
                <div className="text-sm text-muted-foreground">
                  AI Confidence: {Math.round((refreshPreviewData.new.confidence || 0) * 100)}%
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefreshPreview(false)} disabled={applyingRefresh}>
              Cancel
            </Button>
            <Button onClick={applyRefreshChanges} disabled={applyingRefresh}>
              {applyingRefresh ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
