import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useJobs } from "@/hooks/useJobs";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { useAutoDiscover } from "@/hooks/useAutoDiscover";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Edit, Loader2, AlertCircle, Check, X, Users, Activity, FileJson, Briefcase, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Replace, BarChart3, Eye, MousePointerClick, TrendingUp, Image, Upload, CheckCircle, Sparkles, Play, Clock, Globe, Copy, FileText, ExternalLink, ChevronDown, ChevronUp, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Job, JobMetadata } from "@/types/job";
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
  official_website: string;
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
  official_website: "",
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
  official_website?: string;
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
    official_website: input.official_website || "",
  };
};

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isFullAdmin, isLoading: roleLoading } = useAdminRole();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { userStats, apiStats, isLoading: statsLoading } = useAdminStats();
  const analyticsData = useAnalyticsData();
  const { unreviewedCount, logs: autoDiscoverLogs, logsLoading: autoDiscoverLoading, markAsReviewed, discoverByCategory, scrapeUrl, addDiscoveredJobs, updateDiscoveredJobs } = useAutoDiscover();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // URL scraping state
  const [scrapeUrlInput, setScrapeUrlInput] = useState("");
  const [scrapedJobs, setScrapedJobs] = useState<any[]>([]);
  const [showScrapedJobs, setShowScrapedJobs] = useState(false);
  const [discoveringCategory, setDiscoveringCategory] = useState<string | null>(null);
  const [scrapedDuplicateMode, setScrapedDuplicateMode] = useState<"skip" | "update">("skip");

  // Scraper V5 state
  const [scraperUrl, setScraperUrl] = useState("");
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperResult, setScraperResult] = useState<any | null>(null);
  const [scraperError, setScraperError] = useState<string | null>(null);
  const [scraperRawExpanded, setScraperRawExpanded] = useState(false);
  const [scraperAddingJob, setScraperAddingJob] = useState(false);

  // Discover tab state
  const [discoverUrl, setDiscoverUrl] = useState("https://www.freejobalert.com/new-updates/");
  const [discoverPages, setDiscoverPages] = useState(1);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoveredLinks, setDiscoveredLinks] = useState<{update_date: string; title: string; url: string}[]>([]);
  const [discoverScrapedResults, setDiscoverScrapedResults] = useState<Record<string, any>>({});
  const [discoverScrapingUrl, setDiscoverScrapingUrl] = useState<string | null>(null);
  const [discoverSavingUrl, setDiscoverSavingUrl] = useState<string | null>(null);
  const [discoverSavedUrls, setDiscoverSavedUrls] = useState<Set<string>>(new Set());
  const [discoverExpandedUrl, setDiscoverExpandedUrl] = useState<string | null>(null);

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
  const [quickRefreshingJobId, setQuickRefreshingJobId] = useState<string | null>(null);
  const [showRefreshPreview, setShowRefreshPreview] = useState(false);
  const [showQuickRefreshPreview, setShowQuickRefreshPreview] = useState(false);
  const [refreshPreviewData, setRefreshPreviewData] = useState<{
    jobId: string;
    jobTitle: string;
    current: Record<string, any>;
    new: Record<string, any>;
  } | null>(null);
  const [quickRefreshPreviewData, setQuickRefreshPreviewData] = useState<{
    jobId: string;
    jobTitle: string;
    current: Record<string, any>;
    new: Record<string, any>;
  } | null>(null);
  const [applyingRefresh, setApplyingRefresh] = useState(false);
  const [applyingQuickRefresh, setApplyingQuickRefresh] = useState(false);

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
  const [sortField, setSortField] = useState<"last_date" | "vacancies" | "title" | "created_at" | "age_max" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "last_date" | "vacancies" | "title" | "created_at" | "age_max") => {
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

  const getSortIcon = (field: "last_date" | "vacancies" | "title" | "created_at" | "age_max") => {
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

    if (sortField === "created_at") {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (sortField === "age_max") {
      const ageA = a.age_max || 0;
      const ageB = b.age_max || 0;
      return sortDirection === "asc" ? ageA - ageB : ageB - ageA;
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

  // TypeScript interface for auto-verification response
  interface AutoVerifyResponse {
    status: "applied" | "already_verified" | "preview" | "error";
    fieldsUpdated?: number;
    message?: string;
    error?: string;
  }

  // Auto-verify a newly added job (runs in background, doesn't block UI)
  const autoVerifyJob = async (jobId: string, showToast = true): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-job-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ jobId, autoApply: true }),
        }
      );

      const result: AutoVerifyResponse = await response.json();
      if (response.ok && result.status === "applied") {
        // Refresh jobs list to show verified badge
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        if (showToast) {
          toast({
            title: "Job verified!",
            description: result.message || "AI verification completed successfully.",
          });
        }
        return true;
      } else if (result.status === "already_verified") {
        return true; // Already verified is a success
      } else if (result.error) {
        console.error("Auto-verification error:", result.error);
        if (showToast) {
          toast({
            title: "Verification pending",
            description: "Will be verified later.",
          });
        }
        return false;
      }
      return false;
    } catch (error) {
      console.error("Auto-verification failed for job:", jobId, error);
      if (showToast) {
        toast({
          title: "Verification pending",
          description: "Will be verified later.",
        });
      }
      return false;
    }
  };

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
        // Insert and get the new job ID for auto-verification
        const { data: newJob, error } = await supabase
          .from("jobs")
          .insert(formData)
          .select("id")
          .single();
        if (error) throw error;
        toast({ title: "Job created!", description: "Verifying in background..." });

        // Trigger auto-verification in background (non-blocking)
        if (newJob?.id) {
          autoVerifyJob(newJob.id);
        }
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

  // Quick refresh job data handler - only fetches last_date, age_limit, location
  const handleQuickRefresh = async (job: Job) => {
    setQuickRefreshingJobId(job.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quick-refresh-job`,
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
      if (!response.ok) throw new Error(result.error || "Failed to quick refresh");

      if (result.status === "preview") {
        setQuickRefreshPreviewData({
          jobId: job.id,
          jobTitle: job.title,
          current: result.current,
          new: result.new,
        });
        setShowQuickRefreshPreview(true);
      }
    } catch (error: any) {
      toast({ title: "Quick refresh failed", description: error.message, variant: "destructive" });
    } finally {
      setQuickRefreshingJobId(null);
    }
  };

  // Apply quick refresh changes
  const applyQuickRefreshChanges = async () => {
    if (!quickRefreshPreviewData) return;

    setApplyingQuickRefresh(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quick-refresh-job`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId: quickRefreshPreviewData.jobId,
            autoApply: true,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to apply changes");

      if (result.fieldsUpdated > 0) {
        toast({
          title: "Quick refresh applied!",
          description: `Updated ${result.fieldsUpdated} fields (last date, age, location)`
        });
      } else {
        toast({
          title: "No changes applied",
          description: "No new data was found",
          variant: "default"
        });
      }
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowQuickRefreshPreview(false);
      setQuickRefreshPreviewData(null);
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setApplyingQuickRefresh(false);
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

  // Scraper V5: scrape a single URL via the Python API
  const handleScrapeV5 = async () => {
    if (!scraperUrl.trim()) return;
    setScraperLoading(true);
    setScraperError(null);
    setScraperResult(null);
    setScraperRawExpanded(false);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scraperUrl.trim() }),
      });

      // Safely parse JSON — the Python function may crash/timeout on Vercel
      // returning an empty body or non-JSON error page
      let data: any;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          response.status >= 500
            ? `Server error (${response.status}). The scraper may have timed out — try a shorter/simpler URL.`
            : `Invalid response from server (${response.status}): ${text.slice(0, 200)}`
        );
      }

      if (!data) {
        throw new Error("Empty response from server. The scraper may have timed out.");
      }

      if (!response.ok || data.status === "error") {
        throw new Error(data.error || "Scraping failed");
      }

      setScraperResult(data.job);
      toast({ title: "Scraped successfully!", description: data.job.exam_name || "Job data extracted" });
    } catch (error: any) {
      setScraperError(error.message);
      toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
    } finally {
      setScraperLoading(false);
    }
  };

  // ── Discover tab handlers ───────────────────────────────────────────
  const handleDiscover = async () => {
    if (!discoverUrl.trim()) return;
    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscoveredLinks([]);
    setDiscoverScrapedResults({});
    setDiscoverSavedUrls(new Set());

    try {
      const resp = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: discoverUrl.trim(), pages: discoverPages, follow_pages: false }),
      });
      const text = await resp.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`Invalid response: ${text.slice(0, 200)}`); }
      if (!data) throw new Error("Empty response from server.");
      if (!resp.ok || data.error) throw new Error(data.error || `HTTP ${resp.status}`);
      setDiscoveredLinks(data.entries || []);
      toast({ title: "Links discovered!", description: `Found ${data.total || 0} article(s).` });
    } catch (error: any) {
      setDiscoverError(error.message);
      toast({ title: "Discovery failed", description: error.message, variant: "destructive" });
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleDiscoverScrapeOne = async (url: string) => {
    setDiscoverScrapingUrl(url);
    try {
      const resp = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const text = await resp.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`Invalid response: ${text.slice(0, 200)}`); }
      if (!data) throw new Error("Empty response from server.");
      if (!resp.ok || data.status === "error") throw new Error(data.error || "Scraping failed");
      setDiscoverScrapedResults(prev => ({ ...prev, [url]: data.job }));
      toast({ title: "Scraped!", description: data.job?.exam_name || "Job data extracted." });
    } catch (error: any) {
      toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
    } finally {
      setDiscoverScrapingUrl(null);
    }
  };

  const handleDiscoverSaveJob = async (url: string) => {
    const r = discoverScrapedResults[url];
    if (!r) return;
    setDiscoverSavingUrl(url);

    try {
      const metadata: JobMetadata = {};
      if (r.salary_text) metadata.salary_text = r.salary_text;
      if (r.age_limit_text) metadata.age_limit_text = r.age_limit_text;
      if (r.vacancies && Array.isArray(r.vacancies)) metadata.vacancies_detail = r.vacancies;
      if (r.application_fees) metadata.application_fees = r.application_fees;
      if (r.selection_process) metadata.selection_process = r.selection_process;
      if (r.important_dates) metadata.important_dates = r.important_dates;
      if (r.overview) metadata.overview = r.overview;
      if (r.notification_pdf) metadata.notification_pdf = r.notification_pdf;
      if (r.employment_type) metadata.employment_type = r.employment_type;
      if (r.exam_date) metadata.exam_date = r.exam_date;
      if (r.official_website) metadata.official_website = r.official_website;

      let totalVacancies: number | null = null;
      if (r.vacancies && Array.isArray(r.vacancies) && r.vacancies.length > 0) {
        const totalRow = r.vacancies.find((v: Record<string, string>) =>
          Object.values(v).some(val => typeof val === 'string' && val.toLowerCase().includes('total'))
        );
        if (totalRow) {
          const numericVals = Object.values(totalRow)
            .map(v => parseInt(String(v).replace(/[^0-9]/g, '')))
            .filter(n => !isNaN(n) && n > 0);
          if (numericVals.length > 0) totalVacancies = Math.max(...numericVals);
        }
      }
      if (!totalVacancies && r.overview?.total_vacancies) {
        totalVacancies = parseInt(String(r.overview.total_vacancies).replace(/[^0-9]/g, '')) || null;
      }

      let appFee = 0;
      if (r.application_fees && Array.isArray(r.application_fees)) {
        // Extract the maximum numeric fee from all categories
        const allFees = r.application_fees
          .map((f: { category: string; fee: string }) => 
            parseInt(String(f.fee).replace(/[^0-9]/g, ''))
          )
          .filter((n: number) => !isNaN(n) && n > 0);
        if (allFees.length > 0) appFee = Math.max(...allFees);
      }

      const lastDate = parseDateValue(r.last_date);
      const lastDateDisplay = isTBDValue(r.last_date) ? String(r.last_date) : r.last_date || null;

      const cleanLoc = (loc: string) => {
        if (!loc) return loc;
        let s = loc.trim();
        s = s.replace(/[\d]+[)]*\s*$/, '');
        s = s.replace(/^\s*[\d()]+\s*/, '');
        s = s.replace(/\(\d+\)/g, '');
        s = s.replace(/[)(\/,;]+$/, '');
        return s.trim() || loc;
      };

      const jobRecord = {
        title: r.exam_name || "Untitled Job",
        department: r.agency || "Unknown",
        location: cleanLoc(r.location) || "India",
        qualification: r.eligibility || "As per notification",
        experience: "",
        eligibility: r.eligibility || null,
        description: r.description || null,
        salary_min: r.salary_min || null,
        salary_max: r.salary_max || null,
        age_min: r.age_min || null,
        age_max: r.age_max || null,
        application_fee: appFee,
        vacancies: totalVacancies,
        vacancies_display: totalVacancies ? `${totalVacancies} Posts` : "Not Found",
        application_start_date: r.important_dates?.apply_start || null,
        last_date: lastDate,
        last_date_display: lastDateDisplay,
        apply_link: r.official_apply_link || null,
        official_website: r.official_website || null,
        is_featured: false,
        job_metadata: Object.keys(metadata).length > 0 ? metadata : null,
      };

      const { error } = await supabase.from("jobs").insert(jobRecord).select("id").single();
      if (error) throw error;

      setDiscoverSavedUrls(prev => new Set(prev).add(url));
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast({ title: "Saved!", description: `${jobRecord.title} added to database.` });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setDiscoverSavingUrl(null);
    }
  };

  // Scraper V5: add scraped job to the database
  const handleAddScrapedJob = async () => {
    if (!scraperResult) return;
    setScraperAddingJob(true);

    try {
      const r = scraperResult;

      // Build job_metadata with all the extra fields
      const metadata: JobMetadata = {};
      if (r.salary_text) metadata.salary_text = r.salary_text;
      if (r.age_limit_text) metadata.age_limit_text = r.age_limit_text;
      if (r.vacancies && Array.isArray(r.vacancies)) metadata.vacancies_detail = r.vacancies;
      if (r.application_fees) metadata.application_fees = r.application_fees;
      if (r.selection_process) metadata.selection_process = r.selection_process;
      if (r.important_dates) metadata.important_dates = r.important_dates;
      if (r.overview) metadata.overview = r.overview;
      if (r.notification_pdf) metadata.notification_pdf = r.notification_pdf;
      if (r.employment_type) metadata.employment_type = r.employment_type;
      if (r.exam_date) metadata.exam_date = r.exam_date;
      if (r.official_website) metadata.official_website = r.official_website;

      // Calculate total vacancies from vacancy table if available
      let totalVacancies: number | null = null;
      if (r.vacancies && Array.isArray(r.vacancies) && r.vacancies.length > 0) {
        // Try to find a "Total" row
        const totalRow = r.vacancies.find((v: Record<string, string>) =>
          Object.values(v).some(val => typeof val === 'string' && val.toLowerCase().includes('total'))
        );
        if (totalRow) {
          const numericVals = Object.values(totalRow)
            .map(v => parseInt(String(v).replace(/[^0-9]/g, '')))
            .filter(n => !isNaN(n) && n > 0);
          if (numericVals.length > 0) totalVacancies = Math.max(...numericVals);
        }
      }
      // Fallback: from overview
      if (!totalVacancies && r.overview?.total_vacancies) {
        totalVacancies = parseInt(String(r.overview.total_vacancies).replace(/[^0-9]/g, '')) || null;
      }

      // Extract max fee from application_fees
      let appFee = 0;
      if (r.application_fees && Array.isArray(r.application_fees)) {
        const allFees = r.application_fees
          .map((f: { category: string; fee: string }) => 
            parseInt(String(f.fee).replace(/[^0-9]/g, ''))
          )
          .filter((n: number) => !isNaN(n) && n > 0);
        if (allFees.length > 0) appFee = Math.max(...allFees);
      }

      const lastDate = parseDateValue(r.last_date);
      const lastDateDisplay = isTBDValue(r.last_date) ? String(r.last_date) : r.last_date || null;

      // Clean location: strip trailing numbers/parens like "Hyderabad2812)"
      const cleanLocation = (loc: string) => {
        if (!loc) return loc;
        let s = loc.trim();
        s = s.replace(/[\d]+[)]*\s*$/, '');       // trailing digits + optional )
        s = s.replace(/^\s*[\d()]+\s*/, '');       // leading digits/parens
        s = s.replace(/\(\d+\)/g, '');             // (123) patterns
        s = s.replace(/[)(\/,;]+$/, '');            // trailing punctuation junk
        return s.trim() || loc;
      };

      const jobRecord = {
        title: r.exam_name || "Untitled Job",
        department: r.agency || "Unknown",
        location: cleanLocation(r.location) || "India",
        qualification: r.eligibility || "As per notification",
        experience: "",
        eligibility: r.eligibility || null,
        description: r.description || null,
        salary_min: r.salary_min || null,
        salary_max: r.salary_max || null,
        age_min: r.age_min || null,
        age_max: r.age_max || null,
        application_fee: appFee,
        vacancies: totalVacancies,
        vacancies_display: totalVacancies ? `${totalVacancies} Posts` : "Not Found",
        application_start_date: r.important_dates?.apply_start || null,
        last_date: lastDate,
        last_date_display: lastDateDisplay,
        apply_link: r.official_apply_link || null,
        official_website: r.official_website || null,
        is_featured: false,
        job_metadata: Object.keys(metadata).length > 0 ? metadata : null,
      };

      // Check for duplicates
      let isDuplicate = false;
      let duplicateJobTitle = "";
      if (jobs) {
        for (const existingJob of jobs) {
          const similarity = checkJobSimilarity({
            ...emptyFormData,
            title: jobRecord.title,
            department: jobRecord.department,
            location: jobRecord.location,
          }, existingJob);
          if (similarity.isSimilar) {
            isDuplicate = true;
            duplicateJobTitle = existingJob.title;
            break;
          }
        }
      }

      if (isDuplicate) {
        toast({
          title: "Duplicate detected!",
          description: `Similar to: "${duplicateJobTitle}". Job was still added.`,
          variant: "default",
        });
      }

      const { data: newJob, error } = await supabase
        .from("jobs")
        .insert(jobRecord)
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Job added successfully!",
        description: `${jobRecord.title}. Verifying in background...`,
      });

      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      // Auto-verify in background
      if (newJob?.id) {
        autoVerifyJob(newJob.id);
      }

      // Clear scraper state
      setScraperResult(null);
      setScraperUrl("");
    } catch (error: any) {
      toast({ title: "Failed to add job", description: error.message, variant: "destructive" });
    } finally {
      setScraperAddingJob(false);
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
      const newJobIds: string[] = []; // Collect IDs for auto-verification

      // Insert new jobs and get their IDs
      if (newJobs.length > 0) {
        const cleanNewJobs = newJobs.map(({ isDuplicate, duplicateOf, matchType, similarityScore, ...job }) => job);
        const { data: insertedJobs, error } = await supabase
          .from("jobs")
          .insert(cleanNewJobs)
          .select("id");
        if (error) throw error;
        insertedCount = cleanNewJobs.length;

        // Collect IDs for auto-verification
        if (insertedJobs) {
          newJobIds.push(...insertedJobs.map(j => j.id));
        }
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
            // Insert as new and get ID
            const { data: replacedJob, error } = await supabase
              .from("jobs")
              .insert(jobData)
              .select("id")
              .single();
            if (error) throw error;
            replacedCount++;

            // Collect ID for auto-verification
            if (replacedJob?.id) {
              newJobIds.push(replacedJob.id);
            }
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

      // Show toast with verification info
      const verifyingText = newJobIds.length > 0 ? `. Verifying ${newJobIds.length} job(s) in background...` : "";
      toast({ title: messages.join(", ") + "!" + verifyingText });

      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowBulkDialog(false);
      setBulkJobs([]);
      setJsonText("");
      setDuplicateMode("skip");

      // Trigger auto-verification with staggered delays (2s between each) to prevent rate limiting
      const VERIFY_DELAY_MS = 2000;
      let successCount = 0;
      let pendingCount = newJobIds.length;

      for (let i = 0; i < newJobIds.length; i++) {
        setTimeout(async () => {
          const success = await autoVerifyJob(newJobIds[i], false);
          if (success) successCount++;
          pendingCount--;

          // Show final summary when all complete
          if (pendingCount === 0) {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            toast({
              title: `Verification complete`,
              description: `${successCount}/${newJobIds.length} jobs verified successfully.`,
            });
          }
        }, i * VERIFY_DELAY_MS);
      }
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
      official_website: job.official_website || "",
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
          <div className="overflow-x-auto pb-2 -mb-2">
            <TabsList className="inline-flex w-max min-w-full gap-1 p-1">
              <TabsTrigger value="jobs" className="gap-1 min-w-[44px] h-10">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Jobs</span>
              </TabsTrigger>
              {isFullAdmin && (
                <TabsTrigger value="users" className="gap-1 min-w-[44px] h-10">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Users</span>
                </TabsTrigger>
              )}
              {isFullAdmin && (
                <TabsTrigger value="user-analytics" className="gap-1 min-w-[44px] h-10">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
              )}
              {isFullAdmin && (
                <TabsTrigger value="analytics" className="gap-1 min-w-[44px] h-10">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">API</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="bulk" className="gap-1 min-w-[44px] h-10">
                <FileJson className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk</span>
              </TabsTrigger>
              <TabsTrigger value="logos" className="gap-1 min-w-[44px] h-10">
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">Logos</span>
              </TabsTrigger>
              <TabsTrigger value="scrape" className="gap-1 min-w-[44px] h-10">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Scrape</span>
              </TabsTrigger>
              <TabsTrigger value="discover" className="gap-1 min-w-[44px] h-10">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Discover</span>
              </TabsTrigger>
              <TabsTrigger value="auto-discover" className="gap-1 min-w-[44px] h-10 relative">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Auto</span>
                {unreviewedCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                    {unreviewedCount > 99 ? '99+' : unreviewedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Jobs Tab */}
          <TabsContent value="jobs">
            <Card className="border-0 shadow-card">
              <CardHeader className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Jobs ({filteredJobs?.length || 0} of {jobs?.length || 0})</CardTitle>
                    <CardDescription>Manage government job listings</CardDescription>
                  </div>
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditingJob(null); setFormData(emptyFormData); setShowAddDialog(true); }}>
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
                  <ScrollArea className="h-[500px] w-full">
                    <div className="min-w-[800px]">
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
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort("age_max")}
                            >
                              <div className="flex items-center">
                                Age Limit
                                {getSortIcon("age_max")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleSort("created_at")}
                            >
                              <div className="flex items-center">
                                Uploaded
                                {getSortIcon("created_at")}
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
                                {job.age_min && job.age_max ? `${job.age_min}-${job.age_max}` : job.age_max || '-'}
                              </TableCell>
                              <TableCell>
                                {format(new Date(job.created_at), "dd MMM yyyy")}
                              </TableCell>
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
                                    disabled={refreshingJobId === job.id || quickRefreshingJobId === job.id}
                                    title="Full refresh via AI (all fields)"
                                  >
                                    {refreshingJobId === job.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4 text-blue-500" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleQuickRefresh(job)}
                                    disabled={refreshingJobId === job.id || quickRefreshingJobId === job.id}
                                    title="Quick refresh (last date, age, location only)"
                                  >
                                    {quickRefreshingJobId === job.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-orange-500" />
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
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No jobs match the selected filters
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
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

          {/* Auto Discovery Tab */}
          {/* Scrape V5 Tab */}
          <TabsContent value="scrape">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Single URL Scraper
                  </CardTitle>
                  <CardDescription>
                    Scrape a FreeJobAlert article URL to extract structured job data
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* URL Input */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Article URL</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://www.freejobalert.com/..."
                      value={scraperUrl}
                      onChange={(e) => setScraperUrl(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && scraperUrl && !scraperLoading) {
                          handleScrapeV5();
                        }
                      }}
                    />
                    <Button
                      disabled={!scraperUrl.trim() || scraperLoading}
                      onClick={handleScrapeV5}
                    >
                      {scraperLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                      Scrape
                    </Button>
                  </div>
                </div>

                {/* Error */}
                {scraperError && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Scraping Failed</p>
                      <p className="text-xs mt-1">{scraperError}</p>
                    </div>
                  </div>
                )}

                {/* Scraped Result */}
                {scraperResult && (
                  <div className="space-y-6">
                    {/* Header with actions */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-lg">{scraperResult.exam_name || "Scraped Job"}</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(scraperResult, null, 2));
                            toast({ title: "Copied!", description: "JSON copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy JSON
                        </Button>
                        <Button
                          size="sm"
                          disabled={scraperAddingJob}
                          onClick={handleAddScrapedJob}
                        >
                          {scraperAddingJob ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                          Add as Job
                        </Button>
                      </div>
                    </div>

                    {/* Quick Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card className="bg-secondary/50">
                        <CardContent className="p-3 text-center">
                          <div className="text-sm font-bold text-primary">{scraperResult.agency || "—"}</div>
                          <div className="text-xs text-muted-foreground">Agency</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary/50">
                        <CardContent className="p-3 text-center">
                          <div className="text-sm font-bold text-green-600">
                            {scraperResult.salary_min && scraperResult.salary_max
                              ? `₹${scraperResult.salary_min.toLocaleString()} - ₹${scraperResult.salary_max.toLocaleString()}`
                              : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Salary</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary/50">
                        <CardContent className="p-3 text-center">
                          <div className="text-sm font-bold text-orange-600">
                            {scraperResult.age_min && scraperResult.age_max
                              ? `${scraperResult.age_min} - ${scraperResult.age_max} yrs`
                              : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">Age Limit</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary/50">
                        <CardContent className="p-3 text-center">
                          <div className="text-sm font-bold text-red-600">{scraperResult.last_date || "—"}</div>
                          <div className="text-xs text-muted-foreground">Last Date</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Location & Employment Type */}
                    <div className="flex flex-wrap gap-2">
                      {scraperResult.location && (
                        <Badge variant="outline">{scraperResult.location}</Badge>
                      )}
                      {scraperResult.employment_type && (
                        <Badge variant="secondary">{scraperResult.employment_type}</Badge>
                      )}
                      {scraperResult.exam_date && (
                        <Badge variant="outline" className="text-blue-600 border-blue-600">Exam: {scraperResult.exam_date}</Badge>
                      )}
                    </div>

                    {/* Vacancy Breakdown Table */}
                    {scraperResult.vacancies && Array.isArray(scraperResult.vacancies) && scraperResult.vacancies.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Vacancy Breakdown ({scraperResult.vacancies.length} categories)
                        </h4>
                        <div className="max-h-[250px] w-full overflow-auto rounded-md border bg-card">
                          <Table className="min-w-[500px]">
                            <TableHeader>
                              <TableRow>
                                {Object.keys(scraperResult.vacancies[0]).map((key) => (
                                  <TableHead key={key} className="text-xs whitespace-nowrap bg-muted/50 sticky top-0 z-10">{key}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scraperResult.vacancies.map((row: Record<string, string>, i: number) => (
                                <TableRow key={i}>
                                  {Object.values(row).map((val, j) => (
                                    <TableCell key={j} className="text-xs py-1.5 whitespace-nowrap">{val as string}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Application Fees */}
                    {scraperResult.application_fees && Array.isArray(scraperResult.application_fees) && scraperResult.application_fees.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">💰 Application Fees</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {scraperResult.application_fees.map((fee: { category: string; fee: string }, i: number) => (
                            <div key={i} className="flex justify-between items-center bg-secondary/30 rounded-lg px-3 py-2">
                              <span className="text-xs text-muted-foreground">{fee.category}</span>
                              <span className="text-xs font-medium">{fee.fee}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selection Process */}
                    {scraperResult.selection_process && Array.isArray(scraperResult.selection_process) && scraperResult.selection_process.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">📋 Selection Process</h4>
                        <ol className="space-y-1 pl-4">
                          {scraperResult.selection_process.map((step: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground list-decimal">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Important Dates */}
                    {scraperResult.important_dates && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">📅 Important Dates</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(scraperResult.important_dates)
                            .filter(([, v]) => v)
                            .map(([key, val]) => (
                              <div key={key} className="bg-secondary/30 rounded-lg px-3 py-2">
                                <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</div>
                                <div className="text-xs font-medium">{val as string}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Overview */}
                    {scraperResult.overview && typeof scraperResult.overview === 'object' && Object.keys(scraperResult.overview).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">ℹ️ Overview</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(scraperResult.overview).map(([key, val]) => (
                            <div key={key} className="flex items-start gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                              <span className="text-xs text-muted-foreground capitalize min-w-[100px]">{key.replace(/_/g, " ")}</span>
                              <span className="text-xs font-medium flex-1">{val as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Eligibility */}
                    {scraperResult.eligibility && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">🎓 Eligibility</h4>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{scraperResult.eligibility}</p>
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      {scraperResult.official_apply_link && (
                        <a href={scraperResult.official_apply_link} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Apply Link
                          </Button>
                        </a>
                      )}
                      {scraperResult.notification_pdf && (
                        <a href={scraperResult.notification_pdf} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileText className="h-3 w-3 mr-1" />
                            Notification PDF
                          </Button>
                        </a>
                      )}
                    </div>

                    {/* Raw JSON (collapsible) */}
                    <div>
                      <button
                        onClick={() => setScraperRawExpanded(!scraperRawExpanded)}
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {scraperRawExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Raw JSON Output
                      </button>
                      {scraperRawExpanded && (
                        <div className="max-h-[400px] w-full overflow-auto mt-2 rounded-md border bg-secondary/50 p-4">
                          <pre className="text-xs font-mono whitespace-pre w-max min-w-full">
                            {JSON.stringify(scraperResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discover Tab — Two-step: discover links then scrape per row */}
          <TabsContent value="discover">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Discover & Scrape
                  </CardTitle>
                  <CardDescription>
                    Load article links from a FreeJobAlert listing page, then scrape individual articles
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1: Load links */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Badge className="bg-primary text-white text-[10px] px-2 py-0">Step 1</Badge>
                    Load Listing Page
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={discoverUrl}
                      onChange={(e) => setDiscoverUrl(e.target.value)}
                      placeholder="https://www.freejobalert.com/new-updates/"
                      className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter" && discoverUrl && !discoverLoading) handleDiscover(); }}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={discoverPages}
                        onChange={(e) => setDiscoverPages(parseInt(e.target.value) || 1)}
                        className="w-20"
                        title="Pages to walk"
                      />
                      <Button
                        onClick={handleDiscover}
                        disabled={!discoverUrl.trim() || discoverLoading}
                      >
                        {discoverLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                        Load Links
                      </Button>
                    </div>
                  </div>
                  {discoverError && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <span className="text-sm text-destructive">{discoverError}</span>
                    </div>
                  )}
                </div>

                {/* Step 2: Results table */}
                {discoveredLinks.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Badge className="bg-primary text-white text-[10px] px-2 py-0">Step 2</Badge>
                      Discovered Links
                      <Badge variant="secondary" className="ml-1">
                        {discoveredLinks.length} found · {Object.keys(discoverScrapedResults).length} scraped · {discoverSavedUrls.size} saved
                      </Badge>
                    </h3>

                    <div className="relative max-h-[600px] w-full overflow-y-auto rounded-md border bg-card">
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[700px] relative">
                          <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
                            <TableRow>
                              <TableHead className="w-[40px] whitespace-nowrap">#</TableHead>
                              <TableHead className="w-[90px] whitespace-nowrap">Date</TableHead>
                              <TableHead className="min-w-[200px]">Title</TableHead>
                              <TableHead className="w-[90px] whitespace-nowrap">Status</TableHead>
                              <TableHead className="w-[200px] text-right whitespace-nowrap">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {discoveredLinks.map((link, idx) => {
                              const isScraped = !!discoverScrapedResults[link.url];
                              const isScraping = discoverScrapingUrl === link.url;
                              const isSaved = discoverSavedUrls.has(link.url);
                              const isSaving = discoverSavingUrl === link.url;
                              const isExpanded = discoverExpandedUrl === link.url;

                              return (
                              <>
                                <TableRow key={link.url} className={isScraped ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                                  <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{link.update_date}</TableCell>
                                  <TableCell>
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline font-medium line-clamp-2"
                                    >
                                      {link.title}
                                    </a>
                                  </TableCell>
                                  <TableCell>
                                    {isSaved ? (
                                      <Badge className="bg-green-100 text-green-700 border-0 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Saved</Badge>
                                    ) : isScraped ? (
                                      <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]"><Check className="h-3 w-3 mr-1" />Scraped</Badge>
                                    ) : isScraping ? (
                                      <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]"><Loader2 className="h-3 w-3 animate-spin mr-1" />Scraping</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 flex-nowrap">
                                      {!isScraped && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs whitespace-nowrap"
                                          disabled={isScraping}
                                          onClick={() => handleDiscoverScrapeOne(link.url)}
                                        >
                                          {isScraping ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                                          Scrape
                                        </Button>
                                      )}
                                      {isScraped && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs whitespace-nowrap"
                                            onClick={() => setDiscoverExpandedUrl(isExpanded ? null : link.url)}
                                          >
                                            {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                            View
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs whitespace-nowrap"
                                            onClick={() => handleDiscoverScrapeOne(link.url)}
                                          >
                                            <RefreshCw className="h-3 w-3 mr-1" /> Re-scrape
                                          </Button>
                                          {!isSaved && (
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs whitespace-nowrap"
                                              disabled={isSaving}
                                              onClick={() => handleDiscoverSaveJob(link.url)}
                                            >
                                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                              Save
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {/* Expandable JSON panel */}
                                {isExpanded && isScraped && (
                                  <TableRow key={`${link.url}-detail`}>
                                    <TableCell colSpan={5} className="p-0 max-w-0">
                                      <div className="bg-secondary/30 border-y border-primary/20 p-4 space-y-3 w-full">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <h4 className="text-sm font-semibold text-primary">
                                            {discoverScrapedResults[link.url]?.exam_name || "Result"}
                                          </h4>
                                          <div className="flex gap-1">
                                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(JSON.stringify(discoverScrapedResults[link.url], null, 2)); toast({ title: "Copied!" }); }}>
                                              <Copy className="h-3 w-3 mr-1" />Copy JSON
                                            </Button>
                                          </div>
                                        </div>
                                        {/* Quick info */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                            <div className="text-[10px] text-muted-foreground">Agency</div>
                                            <div className="text-xs font-medium truncate">{discoverScrapedResults[link.url]?.agency || "—"}</div>
                                          </div>
                                          <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                            <div className="text-[10px] text-muted-foreground">Location</div>
                                            <div className="text-xs font-medium truncate">{discoverScrapedResults[link.url]?.location || "—"}</div>
                                          </div>
                                          <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                            <div className="text-[10px] text-muted-foreground">Last Date</div>
                                            <div className="text-xs font-medium truncate text-red-600">{discoverScrapedResults[link.url]?.last_date || "—"}</div>
                                          </div>
                                          <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                            <div className="text-[10px] text-muted-foreground">Qualification</div>
                                            <div className="text-xs font-medium truncate">{discoverScrapedResults[link.url]?.eligibility?.slice(0, 50) || "—"}</div>
                                          </div>
                                        </div>
                                        {/* Raw JSON */}
                                        <div className="max-h-[300px] w-full overflow-auto rounded-md border bg-secondary/50 p-3">
                                          <pre className="text-[11px] font-mono w-max">
                                            {JSON.stringify(discoverScrapedResults[link.url], null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auto-discover">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Job Discovery
                  </CardTitle>
                  <CardDescription>
                    Discover jobs by category or scrape from URL
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Category Buttons */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Discover by Category</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {["SSC", "UPSC", "Banking", "Railways", "State PSC", "Defence", "Government Jobs"].map((category) => (
                      <Button
                        key={category}
                        variant={discoveringCategory === category ? "default" : "outline"}
                        className="h-auto py-3"
                        disabled={discoverByCategory.isPending}
                        onClick={() => {
                          setDiscoveringCategory(category);
                          discoverByCategory.mutate(category, {
                            onSuccess: (result) => {
                              setDiscoveringCategory(null);
                              toast({
                                title: `${category} Discovery Complete!`,
                                description: `Found: ${result.result.jobs_found}, Added: ${result.result.jobs_inserted}, Duplicates: ${result.result.jobs_duplicate}`,
                              });
                            },
                            onError: (e) => {
                              setDiscoveringCategory(null);
                              toast({ title: "Discovery failed", description: e.message, variant: "destructive" });
                            },
                          });
                        }}
                      >
                        {discoveringCategory === category ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* URL Scraper */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Scrape from URL</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://ssc.nic.in/noticeboards/notices"
                      value={scrapeUrlInput}
                      onChange={(e) => setScrapeUrlInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      disabled={!scrapeUrlInput || scrapeUrl.isPending}
                      onClick={() => {
                        scrapeUrl.mutate(scrapeUrlInput, {
                          onSuccess: (result) => {
                            setScrapedJobs(result.result.jobs);
                            setShowScrapedJobs(true);
                            toast({
                              title: "URL Scraped!",
                              description: `Found ${result.result.jobs_found} jobs (${result.result.jobs_duplicate} duplicates)`,
                            });
                          },
                          onError: (e) => toast({ title: "Scrape failed", description: e.message, variant: "destructive" }),
                        });
                      }}
                    >
                      {scrapeUrl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scrape"}
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card className="bg-secondary/50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{autoDiscoverLogs.length}</div>
                      <div className="text-xs text-muted-foreground">Total Runs</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {autoDiscoverLogs.reduce((acc, l) => acc + l.jobs_inserted, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Jobs Added</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {autoDiscoverLogs.reduce((acc, l) => acc + l.jobs_duplicate, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Duplicates</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/50">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {autoDiscoverLogs.filter(l => l.error).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Logs */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Recent Runs</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const unreviewed = autoDiscoverLogs.filter(l => !l.reviewed).map(l => l.id);
                        if (unreviewed.length > 0) {
                          markAsReviewed.mutate(unreviewed);
                        }
                      }}
                      disabled={markAsReviewed.isPending || autoDiscoverLogs.filter(l => !l.reviewed).length === 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Reviewed
                    </Button>
                  </div>
                  {autoDiscoverLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : autoDiscoverLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No discovery runs yet.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Found</TableHead>
                            <TableHead>Added</TableHead>
                            <TableHead>Dups</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {autoDiscoverLogs.map((log) => (
                            <TableRow key={log.id} className={!log.reviewed ? "bg-primary/5" : ""}>
                              <TableCell className="whitespace-nowrap text-xs">
                                {format(new Date(log.run_at), "MMM d, HH:mm")}
                              </TableCell>
                              <TableCell>{log.jobs_found}</TableCell>
                              <TableCell className="text-green-600">{log.jobs_inserted}</TableCell>
                              <TableCell className="text-muted-foreground">{log.jobs_duplicate}</TableCell>
                              <TableCell>
                                {log.error ? (
                                  <Badge variant="destructive" className="text-xs">Error</Badge>
                                ) : (
                                  <Badge className="bg-green-600 text-xs">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
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
                <Input id="age_min" type="number" step="0.1" value={formData.age_min} onChange={(e) => setFormData({ ...formData, age_min: parseFloat(e.target.value) || 18 })} />
              </div>
              <div>
                <Label htmlFor="age_max">Age Max</Label>
                <Input id="age_max" type="number" step="0.1" value={formData.age_max} onChange={(e) => setFormData({ ...formData, age_max: parseFloat(e.target.value) || 65 })} />
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
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor="apply_link">Apply Link</Label>
                <Input id="apply_link" value={formData.apply_link} onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label htmlFor="official_website">Official Website</Label>
                <Input id="official_website" value={formData.official_website} onChange={(e) => setFormData({ ...formData, official_website: e.target.value })} />
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

      {/* Quick Refresh Preview Dialog */}
      <Dialog open={showQuickRefreshPreview} onOpenChange={(open) => !open && setShowQuickRefreshPreview(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Quick Refresh Preview
            </DialogTitle>
            <DialogDescription>
              Review changes for last date, age limit, and location.
            </DialogDescription>
          </DialogHeader>
          {quickRefreshPreviewData && (
            <div className="space-y-4">
              <div className="text-sm font-medium">{quickRefreshPreviewData.jobTitle}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Field</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>New</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { key: "last_date", label: "Last Date" },
                    { key: "age_min", label: "Min Age" },
                    { key: "age_max", label: "Max Age" },
                    { key: "location", label: "Location" },
                  ].map(({ key, label }) => {
                    const currentVal = quickRefreshPreviewData.current[key];
                    const newVal = quickRefreshPreviewData.new[key];
                    const hasChange = newVal !== undefined && newVal !== null && String(newVal) !== String(currentVal || "");

                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {currentVal || <span className="italic">Not set</span>}
                        </TableCell>
                        <TableCell className={`${hasChange ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickRefreshPreview(false)} disabled={applyingQuickRefresh}>
              Cancel
            </Button>
            <Button onClick={applyQuickRefreshChanges} disabled={applyingQuickRefresh}>
              {applyingQuickRefresh ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scraped Jobs Preview Dialog */}
      <Dialog open={showScrapedJobs} onOpenChange={setShowScrapedJobs}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scraped Jobs</DialogTitle>
            <DialogDescription>
              Found {scrapedJobs.length} jobs. Select which ones to add.
            </DialogDescription>
          </DialogHeader>

          {/* Duplicate Handling Options */}
          {scrapedJobs.some(j => j.isDuplicate) && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm font-medium mb-3">Duplicate Job Handling</p>
              <RadioGroup
                value={scrapedDuplicateMode}
                onValueChange={(v) => setScrapedDuplicateMode(v as "skip" | "update")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="scrape-skip" />
                  <Label htmlFor="scrape-skip" className="text-sm font-normal cursor-pointer">
                    Skip <span className="text-muted-foreground">(only add new jobs, ignore duplicates)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id="scrape-update" />
                  <Label htmlFor="scrape-update" className="text-sm font-normal cursor-pointer">
                    Update existing <span className="text-muted-foreground">(update existing records with new scraped data)</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-3 py-4">
            {scrapedJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No jobs found from the URL
              </div>
            ) : (
              scrapedJobs.map((job, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${job.isDuplicate
                      ? scrapedDuplicateMode === "update"
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20"
                        : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 opacity-60"
                      : "bg-secondary/30"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={job.selected || false}
                      disabled={job.isDuplicate && scrapedDuplicateMode === "skip"}
                      onChange={(e) => {
                        const updated = [...scrapedJobs];
                        updated[index] = { ...job, selected: e.target.checked };
                        setScrapedJobs(updated);
                      }}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{job.title || "Untitled"}</h4>
                        {job.isDuplicate && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${scrapedDuplicateMode === "update"
                                ? "text-amber-600 border-amber-600"
                                : "text-yellow-600 border-yellow-600"
                              }`}
                          >
                            {scrapedDuplicateMode === "update" ? "Update Available" : "Duplicate"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{job.company || "Unknown Department"}</p>
                      {job.last_date && (
                        <p className="text-xs text-red-500 mt-1">Last Date: {job.last_date}</p>
                      )}
                      {job.eligibility && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{job.eligibility}</p>
                      )}
                      {job.isDuplicate && job.duplicateOf && (
                        <p className="text-xs text-yellow-600 mt-1">
                          {scrapedDuplicateMode === "update" ? "Will update: " : "Similar to: "}
                          {jobs?.find(j => j.id === job.duplicateOf)?.title || job.duplicateOf}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="text-sm text-muted-foreground">
              {scrapedDuplicateMode === "skip" ? (
                <>{scrapedJobs.filter(j => j.selected && !j.isDuplicate).length} selected to add</>
              ) : (
                <>
                  {scrapedJobs.filter(j => j.selected && !j.isDuplicate).length} new, {scrapedJobs.filter(j => j.selected && j.isDuplicate).length} to update
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowScrapedJobs(false)}>
                Cancel
              </Button>
              <Button
                disabled={
                  (scrapedDuplicateMode === "skip" && scrapedJobs.filter(j => j.selected && !j.isDuplicate).length === 0) ||
                  (scrapedDuplicateMode === "update" && scrapedJobs.filter(j => j.selected).length === 0) ||
                  addDiscoveredJobs.isPending ||
                  updateDiscoveredJobs.isPending
                }
                onClick={async () => {
                  const newJobs = scrapedJobs.filter(j => j.selected && !j.isDuplicate);
                  const duplicateJobs = scrapedJobs.filter(j => j.selected && j.isDuplicate);

                  let addedCount = 0;
                  let updatedCount = 0;

                  try {
                    // Add new jobs
                    if (newJobs.length > 0) {
                      const result = await addDiscoveredJobs.mutateAsync(newJobs);
                      addedCount = result.inserted;
                    }

                    // Update duplicates if in update mode
                    if (scrapedDuplicateMode === "update" && duplicateJobs.length > 0) {
                      const result = await updateDiscoveredJobs.mutateAsync(duplicateJobs);
                      updatedCount = result.updated;
                    }

                    toast({
                      title: "Jobs Processed!",
                      description: `Added ${addedCount} new jobs${updatedCount > 0 ? `, updated ${updatedCount} existing jobs` : ""}`,
                    });
                    setShowScrapedJobs(false);
                    setScrapedJobs([]);
                    setScrapeUrlInput("");
                    setScrapedDuplicateMode("skip");
                  } catch (e: any) {
                    toast({
                      title: "Failed to process jobs",
                      description: e.message,
                      variant: "destructive"
                    });
                  }
                }}
              >
                {(addDiscoveredJobs.isPending || updateDiscoveredJobs.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {scrapedDuplicateMode === "skip"
                  ? `Add ${scrapedJobs.filter(j => j.selected && !j.isDuplicate).length} Jobs`
                  : "Process Selected"
                }
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
