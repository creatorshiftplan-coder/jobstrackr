import React, { useState, useCallback, useRef, useMemo } from "react";
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
import { ArrowLeft, Plus, Trash2, Edit, Loader2, AlertCircle, Check, X, Users, Activity, FileJson, Briefcase, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Replace, BarChart3, Eye, MousePointerClick, TrendingUp, Image, Upload, CheckCircle, Sparkles, Play, Clock, Globe, Copy, FileText, ExternalLink, ChevronDown, ChevronUp, Search, AlertTriangle, XCircle, Key, ToggleLeft, ToggleRight, Square, ChevronLeft, ChevronRight, Send, Terminal, Facebook } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAllExamUpdates } from "@/hooks/useExamUpdates";
import { inferCategory } from "@/lib/jobUtils";
import { useEffect } from "react";
import { isFreeJobAlertUrl } from "@/lib/urlUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { format } from "date-fns";
import { Job, JobMetadata } from "@/types/job";
import { parseEligibilityProfileFromText } from "@/lib/eligibilityParser";
import { parseJobDeadline } from "@/lib/jobUtils";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { useGovtJobScraper, type ScraperSource, type ExamUpdate, type ArticleLink, type ArticleData } from "@/hooks/useGovtJobScraper";
import { useApiKeys, PROVIDER_PRESETS, type ApiKeyEntry, type NewApiKeyEntry } from "@/hooks/useApiKeys";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

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

// Helper to extract vacancies from job title
const extractVacanciesFromTitle = (title: string): number | null => {
  if (!title) return null;
  // Match numbers followed by vacancy-like keywords
  // Examples: 17727 Vacancies, 2000 Posts, 18,799 Post, 150 Vacancy, 123 Vacant, 456 Positions
  const regex = /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:vacanc(?:y|ies)|posts?|vacant|positions?)/i;
  const match = title.match(regex);
  if (match) {
    const numStr = match[1].replace(/,/g, "");
    const parsed = parseInt(numStr, 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  // Also check alternative formats: e.g. "Vacancy: 500"
  const revRegex = /(?:vacanc(?:y|ies)|posts?|vacant|positions?):\s*(\d{1,3}(?:,\d{3})*|\d+)/i;
  const revMatch = title.match(revRegex);
  if (revMatch) {
    const numStr = revMatch[1].replace(/,/g, "");
    const parsed = parseInt(numStr, 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
};

// Helper to parse date - returns a far future date for TBD-like values so the job remains active
const parseDateValue = (value: string | null | undefined): string => {
  if (!value) return new Date().toISOString().split('T')[0]; // Default to today if empty
  if (isTBDValue(value)) {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    return futureDate.toISOString().split('T')[0];
  }

  // Pre-process: strip newlines, time info, parenthesized time text
  let cleaned = value.replace(/\n/g, " ").trim();
  cleaned = cleaned
    .replace(/\(?\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*\)?/g, "")
    .replace(/from\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*onwards?/gi, "")
    .trim();
  if (!cleaned) cleaned = value.replace(/\n/g, " ").trim();

  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD-MM YYYY (space-separated year)
  const dmySpace = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})\s+(\d{4})$/);
  if (dmySpace) {
    const [, d, m, y] = dmySpace;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD Month YYYY (e.g. "14 March 2026")
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    january: "01", february: "02", march: "03", april: "04",
    june: "06", july: "07", august: "08", september: "09",
    october: "10", november: "11", december: "12",
  };
  const named = cleaned.match(/^(\d{1,2})[\s\-/]([a-zA-Z]+)[\s\-/](\d{4})$/);
  if (named) {
    const mon = monthNames[named[2].toLowerCase().slice(0, 3)];
    if (mon) return `${named[3]}-${mon}-${named[1].padStart(2, "0")}`;
  }

  // Fallback: try native Date parse
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // Unparseable — return 1 year from now
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  return futureDate.toISOString().split('T')[0];
};

const buildEligibilityAwareMetadata = (
  title: string,
  qualification: string | null | undefined,
  eligibility: string | null | undefined,
  existingMetadata?: JobMetadata | null,
): JobMetadata => {
  const metadata: JobMetadata = { ...(existingMetadata || {}) };
  metadata.eligibility_profile = parseEligibilityProfileFromText(qualification, eligibility, title);
  return metadata;
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

// Sanitize numeric fields to prevent database constraint/overflow errors
const sanitizeJobRecord = (record: Record<string, any>) => {
  const clean = { ...record };
  if (clean.age_min !== undefined && clean.age_min !== null && clean.age_min !== "") {
    const val = Number(clean.age_min);
    clean.age_min = isNaN(val) ? null : Math.max(1, Math.min(100, val));
  } else {
    clean.age_min = null;
  }

  if (clean.age_max !== undefined && clean.age_max !== null && clean.age_max !== "") {
    const val = Number(clean.age_max);
    clean.age_max = isNaN(val) ? null : Math.max(1, Math.min(100, val));
  } else {
    clean.age_max = null;
  }

  if (clean.salary_min !== undefined && clean.salary_min !== null && clean.salary_min !== "") {
    const val = Number(clean.salary_min);
    clean.salary_min = isNaN(val) ? null : Math.max(0, val);
  } else {
    clean.salary_min = null;
  }

  if (clean.salary_max !== undefined && clean.salary_max !== null && clean.salary_max !== "") {
    const val = Number(clean.salary_max);
    clean.salary_max = isNaN(val) ? null : Math.max(0, val);
  } else {
    clean.salary_max = null;
  }

  if (clean.vacancies !== undefined && clean.vacancies !== null && clean.vacancies !== "") {
    const val = Number(clean.vacancies);
    clean.vacancies = isNaN(val) ? null : Math.max(0, Math.min(10000000, val));
  } else {
    clean.vacancies = null;
  }

  return clean;
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

/**
 * Parse a logo filename into a clean display title.
 * Example: "DBIM_BIS_Hallmark_PNG_#6C1340 (1).png" → "BIS Hallmark"
 *
 * Rules:
 * 1. Strip file extension
 * 2. Remove the leading prefix before the first underscore (e.g., "DBIM")
 * 3. Remove trailing tokens: hex color codes (#XXXXXX), format hints (PNG/JPG/SVG), copy indicators (1), (2)
 * 4. Replace underscores with spaces and trim
 */
const parseLogoTitle = (filename: string): string => {
  // 1. Strip extension
  let name = filename.replace(/\.(png|jpe?g|svg|webp|gif)$/i, "");

  // 2. Remove copy indicator like " (1)", " (2)", "(1)"
  name = name.replace(/\s*\(\d+\)\s*$/, "");

  // 3. Split by underscores
  const parts = name.split("_");

  // 4. Remove the leading prefix (first segment, e.g., "DBIM")
  if (parts.length > 1) {
    parts.shift();
  }

  // 5. Filter out noise tokens: hex colors, format hints, empty strings
  const filtered = parts.filter((part) => {
    const trimmed = part.trim();
    if (!trimmed) return false;
    // Hex color like #6C1340
    if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return false;
    // Format hints (case-insensitive exact match)
    if (/^(PNG|JPG|JPEG|SVG|WEBP|GIF)$/i.test(trimmed)) return false;
    return true;
  });

  // 6. Join with spaces and clean up
  return filtered.join(" ").trim() || filename.replace(/\.(png|jpe?g|svg|webp|gif)$/i, "");
};

interface LogoQueueItem {
  id: string;
  file: File;
  preview: string;
  parsedTitle: string;
  editedTitle: string;
  duplicateStatus: "new" | "exact" | "similar";
  similarTo?: string;
}

const getWebappBaseUrl = () => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://jobstrackr.in";
  if (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("192.168.")) {
    return "https://jobstrackr.in";
  }
  return origin;
};

const getJobDeadlineDate = (job: any): Date | null => {
  if (!job) return null;
  const displayDate = parseJobDeadline(job.last_date_display);
  if (displayDate) return displayDate;
  return parseJobDeadline(job.last_date);
};

const matchTagFilter = (title: string, tag: string): boolean => {
  if (!title) return false;
  const t = title.toLowerCase();
  
  switch (tag.toLowerCase()) {
    case "all jobs":
      return true;
      
    case "ssc":
      return /\bssc\b/i.test(title);
      
    case "railway jobs":
      const railwayTerms = [
        "rrb", "rrc", "railway recruitment board", "railway recruitment cell", 
        "ntpc", "group d", "alp", "assistant loco pilot", "rpf", 
        "railway protection force", "rrb je", "railway apprentice"
      ];
      return railwayTerms.some(term => t.includes(term));
      
    case "banking jobs":
      const bankingTerms = [
        "ibps", "sbi", "rbi", "nabard", "sidbi", "ecgc", "niacl", "uiic", 
        "bank of baroda", "bank of india", "punjab national bank", 
        "canara bank", "indian bank", "central bank of india"
      ];
      return bankingTerms.some(term => t.includes(term));
      
    case "upsc":
      return /\bupsc\b/i.test(title);
      
    case "defence jobs":
      const defenceTerms = [
        "agniveer", "agnipath", "afcat", "indian army", "indian navy", 
        "indian air force", "coast guard", "navik", "yantrik", "tes", 
        "ssc tech", "military nursing service", "mns", "delhi police", 
        "kolkata police", "west bengal police", "up police", "bihar police", 
        "crpf", "bsf", "cisf", "itbp", "ssb", "assam rifles"
      ];
      return defenceTerms.some(term => t.includes(term));
      
    case "psu":
      const psuTerms = [
        "ongc", "ntpc", "bhel", "iocl", "hpcl", "bpcl", "gail", "sail", 
        "powergrid", "bel", "hal", "cil", "coal india", "npcil", "drdo", 
        "isro", "nlc"
      ];
      return psuTerms.some(term => t.includes(term));
      
    case "state psc":
      const statePscTerms = [
        "wbpsc", "uppsc", "bpsc", "mpsc", "rpsc", "tnpsc", "opsc", "gpsc", 
        "kpsc", "appsc", "tspsc", "mppsc", "ukpsc", "hpsc", "jkpsc"
      ];
      return statePscTerms.some(term => t.includes(term)) && !/\bupsc\b/i.test(title);
      
    case "healthcare":
      const healthcareTerms = [
        "aiims", "esic", "nhm", "national health mission", "cho", 
        "community health officer", "nursing officer", "staff nurse", 
        "anm", "gnm", "medical officer", "pharmacist", "lab technician"
      ];
      return healthcareTerms.some(term => t.includes(term));
      
    case "teaching":
      const teachingTerms = [
        "kvs", "kendriya vidyalaya", "nvs", "navodaya vidyalaya", "ctet", 
        "tet", "ugc net", "assistant professor", "associate professor", 
        "lecturer", "prt", "tgt", "pgt"
      ];
      return teachingTerms.some(term => t.includes(term));
      
    case "judiciary":
      const judiciaryTerms = [
        "supreme court", "high court", "district court", "law clerk", 
        "judicial assistant", "court master"
      ];
      return judiciaryTerms.some(term => t.includes(term));
      
    case "stenographer":
      const stenographerTerms = [
        "stenographer", "steno", "stenographer grade c", "stenographer grade d", 
        "junior stenographer", "senior stenographer", "hindi stenographer", 
        "english stenographer", "personal assistant", "pa", "personal secretary", 
        "ps", "court stenographer", "steno typist", "steno-typist", 
        "stenographer recruitment"
      ];
      return stenographerTerms.some(term => t.includes(term));
      
    default:
      return true;
  }
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

  // Govt Job Scraper (Updates tab)
  const govtScraper = useGovtJobScraper();
  const [updatesAddSourceOpen, setUpdatesAddSourceOpen] = useState(false);
  const [updatesNewSource, setUpdatesNewSource] = useState({ name: "", url: "", category: "custom", limit_per_run: 6 });
  const [updatesEditingSource, setUpdatesEditingSource] = useState<ScraperSource | null>(null);
  const [updatesDiscoverUrl, setUpdatesDiscoverUrl] = useState("");
  const [updatesDiscoverLimit, setUpdatesDiscoverLimit] = useState(10);
  const [updatesDiscoveredLinks, setUpdatesDiscoveredLinks] = useState<ArticleLink[]>([]);
  const [updatesScrapedResults, setUpdatesScrapedResults] = useState<Record<string, ArticleData>>({});
  const [updatesScrapingUrl, setUpdatesScrapingUrl] = useState<string | null>(null);
  const [updatesSavingAll, setUpdatesSavingAll] = useState(false);
  const [updatesSavingUrl, setUpdatesSavingUrl] = useState<string | null>(null);
  const [updatesSavedUrls, setUpdatesSavedUrls] = useState<Set<string>>(new Set());
  const [updatesExpandedUrl, setUpdatesExpandedUrl] = useState<string | null>(null);
  const [updatesCrawlingSourceId, setUpdatesCrawlingSourceId] = useState<string | null>(null);
  const [updatesDetailView, setUpdatesDetailView] = useState<ExamUpdate | null>(null);
  const [updatesRephraseOn, setUpdatesRephraseOn] = useState(true);
  const updatesScrapeAbortRef = useRef(false);
  const discoverScrapeAbortRef = useRef(false);

  // API Keys state
  const apiKeysHook = useApiKeys();
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyEntry | null>(null);
  const [keyForm, setKeyForm] = useState<NewApiKeyEntry>({ provider: "gemini", model_name: "gemini-2.5-flash", api_key: "", label: "" });
  const [keyFormPriority, setKeyFormPriority] = useState(0);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [showKeyValues, setShowKeyValues] = useState<Set<string>>(new Set());

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
  const [backfillingEligibility, setBackfillingEligibility] = useState(false);

  // Discover tab state
  const [discoverUrl, setDiscoverUrl] = useState("https://www.freejobalert.com/new-updates/");
  const [discoverPages, setDiscoverPages] = useState(1);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoveredLinks, setDiscoveredLinks] = useState<{ update_date: string; title: string; url: string }[]>([]);
  const [discoverScrapedResults, setDiscoverScrapedResults] = useState<Record<string, any>>({});
  const [discoverScrapingUrl, setDiscoverScrapingUrl] = useState<string | null>(null);
  const [discoverSavingUrl, setDiscoverSavingUrl] = useState<string | null>(null);
  const [discoverSavingAll, setDiscoverSavingAll] = useState(false);
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
  const { logos, isLoading: logosLoading, uploadLogo, deleteLogo, getUnmatchedDepartments, refetch: refetchLogos } = useConductingBodyLogos();
  const [logoQueue, setLogoQueue] = useState<LogoQueueItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const logoDropRef = useRef<HTMLDivElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [logoName, setLogoName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Check if a parsed title is a duplicate of existing logos
  const checkLogoDuplicate = useCallback(
    (title: string): { status: "new" | "exact" | "similar"; similarTo?: string } => {
      if (!title.trim()) return { status: "new" };
      const normalizeForCompare = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const inputNorm = normalizeForCompare(title);
      const inputWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 0);

      for (const logo of logos) {
        const logoNorm = normalizeForCompare(logo.name);
        // Exact match
        if (inputNorm === logoNorm) {
          return { status: "exact", similarTo: logo.name };
        }
      }

      // Fuzzy / word-overlap check
      for (const logo of logos) {
        const logoWords = logo.name.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
        if (logoWords.length === 0 || inputWords.length === 0) continue;
        const commonWords = inputWords.filter((w) => logoWords.includes(w));
        const overlapScore =
          (commonWords.length * 2) / (inputWords.length + logoWords.length);
        if (overlapScore >= 0.7) {
          return { status: "similar", similarTo: logo.name };
        }
      }

      return { status: "new" };
    },
    [logos]
  );

  // Process dropped/selected files into the queue
  const processLogoFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: LogoQueueItem[] = [];
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) continue;
        const parsedTitle = parseLogoTitle(file.name);
        const { status, similarTo } = checkLogoDuplicate(parsedTitle);
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          preview: URL.createObjectURL(file),
          parsedTitle,
          editedTitle: parsedTitle,
          duplicateStatus: status,
          similarTo,
        });
      }

      setLogoQueue((prev) => [...prev, ...newItems]);
    },
    [checkLogoDuplicate]
  );

  // Update edited title and re-check duplicate status
  const updateLogoQueueTitle = useCallback(
    (id: string, newTitle: string) => {
      setLogoQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const { status, similarTo } = checkLogoDuplicate(newTitle);
          return { ...item, editedTitle: newTitle, duplicateStatus: status, similarTo };
        })
      );
    },
    [checkLogoDuplicate]
  );

  // Remove item from queue
  const removeFromLogoQueue = useCallback((id: string) => {
    setLogoQueue((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // Batch upload all non-duplicate items
  const handleBatchLogoUpload = useCallback(async () => {
    const uploadable = logoQueue.filter(
      (item) => item.editedTitle.trim() && item.duplicateStatus !== "exact"
    );
    if (uploadable.length === 0) {
      toast({ title: "Nothing to upload", description: "All items are duplicates or missing titles.", variant: "destructive" });
      return;
    }

    setBatchUploading(true);
    setBatchProgress(0);
    let successCount = 0;

    for (let i = 0; i < uploadable.length; i++) {
      const item = uploadable[i];
      try {
        await uploadLogo.mutateAsync({ name: item.editedTitle.trim(), file: item.file });
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${item.editedTitle}:`, err);
      }
      setBatchProgress(i + 1);
    }

    // Clean up queue and previews
    logoQueue.forEach((item) => URL.revokeObjectURL(item.preview));
    setLogoQueue([]);
    setBatchUploading(false);
    toast({
      title: `Uploaded ${successCount}/${uploadable.length} logos`,
      description: successCount === uploadable.length
        ? "All logos uploaded successfully!"
        : `${uploadable.length - successCount} failed. Check console for details.`,
    });
  }, [logoQueue, uploadLogo, toast]);

  // Drag-and-drop handlers
  const handleLogoDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleLogoDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleLogoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (e.dataTransfer.files.length > 0) {
        processLogoFiles(e.dataTransfer.files);
      }
    },
    [processLogoFiles]
  );

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
  const [searchQuery, setSearchQuery] = useState<string>("");
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

  // Vacancy Checker state
  const [showVacancyChecker, setShowVacancyChecker] = useState(false);
  const [vacancyMismatches, setVacancyMismatches] = useState<{
    jobId: string;
    jobTitle: string;
    storedVacancy: number | null;
    extractedVacancy: number;
    vacancies_display: string | null;
  }[]>([]);
  const [selectedVacancyUpdates, setSelectedVacancyUpdates] = useState<Set<string>>(new Set());
  const [updatingVacancies, setUpdatingVacancies] = useState(false);
  const [checkingVacancies, setCheckingVacancies] = useState(false);

  const handleCheckVacancies = useCallback(() => {
    if (!Array.isArray(jobs) || jobs.length === 0) {
      toast({
        title: "No jobs loaded",
        description: "Please wait for jobs to finish loading or check your connection.",
        variant: "destructive",
      });
      return;
    }

    const mismatches: typeof vacancyMismatches = [];
    for (const job of jobs) {
      const extracted = extractVacanciesFromTitle(job.title);
      if (extracted !== null && extracted !== job.vacancies) {
        mismatches.push({
          jobId: job.id,
          jobTitle: job.title,
          storedVacancy: job.vacancies,
          extractedVacancy: extracted,
          vacancies_display: job.vacancies_display,
        });
      }
    }

    if (mismatches.length === 0) {
      toast({
        title: "No vacancy mismatches",
        description: "All job vacancies match the numbers in their titles.",
      });
      return;
    }

    setVacancyMismatches(mismatches);
    // Select all mismatches by default
    setSelectedVacancyUpdates(new Set(mismatches.map(m => m.jobId)));
    setShowVacancyChecker(true);
  }, [jobs, toast]);

  const handleApproveVacancyChanges = async () => {
    if (selectedVacancyUpdates.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one job to update.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingVacancies(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const selectedMismatches = vacancyMismatches.filter(m => selectedVacancyUpdates.has(m.jobId));
      
      for (const item of selectedMismatches) {
        const { error } = await supabase
          .from("jobs")
          .update({
            vacancies: item.extractedVacancy,
            vacancies_display: String(item.extractedVacancy),
          })
          .eq("id", item.jobId);

        if (error) {
          console.error(`Error updating vacancy for job ${item.jobId}:`, error);
          failCount++;
        } else {
          successCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });

      toast({
        title: "Vacancy updates complete",
        description: `Successfully updated ${successCount} job(s).${failCount > 0 ? ` Failed to update ${failCount} job(s).` : ""}`,
      });

      // Close the modal
      setShowVacancyChecker(false);
      setVacancyMismatches([]);
      setSelectedVacancyUpdates(new Set());
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingVacancies(false);
    }
  };

  // Expired jobs states
  const [expiredSearchQuery, setExpiredSearchQuery] = useState<string>("");
  const [expiredYearFilter, setExpiredYearFilter] = useState<string>("all");
  const [expiredSortField, setExpiredSortField] = useState<"last_date" | "vacancies" | "created_at" | "vacancies_and_date" | null>("last_date");
  const [expiredSortDirection, setExpiredSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedExpiredJobs, setSelectedExpiredJobs] = useState<Set<string>>(new Set());

  // Telegram Posting states
  const [selectedTelegramSector, setSelectedTelegramSector] = useState<string>("All Jobs");
  const [selectedTelegramTag, setSelectedTelegramTag] = useState<string>("All Jobs");
  const [telegramSourceType, setTelegramSourceType] = useState<"jobs" | "updates">("jobs");
  const [selectedTelegramChannelId, setSelectedTelegramChannelId] = useState<string>("");
  const [selectedTelegramJobIds, setSelectedTelegramJobIds] = useState<string[]>([]);
  const [selectedTelegramUpdateIds, setSelectedTelegramUpdateIds] = useState<string[]>([]);
  const [postingToTelegram, setPostingToTelegram] = useState<boolean>(false);
  const [showTelegramAddChannelDialog, setShowTelegramAddChannelDialog] = useState<boolean>(false);
  const [telegramSortField, setTelegramSortField] = useState<"vacancies" | "last_date" | "created_at" | null>("created_at");
  const [telegramSortDirection, setTelegramSortDirection] = useState<"asc" | "desc">("desc");
  const [telegramConsoleLogs, setTelegramConsoleLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the Telegram console to the bottom when new logs are added
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [telegramConsoleLogs]);

  interface TelegramSentJobLog {
    id: string;
    sent_at: string;
    status: string;
    error_message: string | null;
    channel_id: string;
    job_id: string | null;
    update_id: string | null;
    telegram_channels: {
      name: string;
      sector: string;
      channel_id: string;
    } | null;
    jobs: {
      title: string;
      department: string;
    } | null;
    exam_updates: {
      title: string;
    } | null;
  }

  const [telegramLogs, setTelegramLogs] = useState<TelegramSentJobLog[]>([]);
  const [loadingTelegramLogs, setLoadingTelegramLogs] = useState(false);
  const [channelStats, setChannelStats] = useState<Record<string, { total: number; lastSent: string | null; lastTitle: string | null; lastStatus: string | null }>>({});

  const fetchChannelStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("telegram_sent_jobs")
        .select(`
          channel_id,
          status,
          sent_at,
          jobs (title),
          exam_updates (title)
        `)
        .order("sent_at", { ascending: false });

      if (error) throw error;

      const stats: Record<string, { total: number; lastSent: string | null; lastTitle: string | null; lastStatus: string | null }> = {};
      
      data?.forEach((item: any) => {
        const cId = item.channel_id;
        if (!stats[cId]) {
          stats[cId] = { total: 0, lastSent: null, lastTitle: null, lastStatus: null };
        }
        
        if (item.status === "success") {
          stats[cId].total += 1;
          if (!stats[cId].lastSent) {
            stats[cId].lastSent = item.sent_at;
            stats[cId].lastTitle = item.jobs?.title || item.exam_updates?.title || "Unknown Item";
            stats[cId].lastStatus = "success";
          }
        } else if (!stats[cId].lastSent) {
          stats[cId].lastSent = item.sent_at;
          stats[cId].lastTitle = item.jobs?.title || item.exam_updates?.title || "Unknown Item";
          stats[cId].lastStatus = item.status;
        }
      });
      
      setChannelStats(stats);
    } catch (err) {
      console.error("Failed to fetch channel stats:", err);
    }
  }, []);

  const fetchTelegramLogs = useCallback(async () => {
    setLoadingTelegramLogs(true);
    try {
      const { data, error } = await supabase
        .from("telegram_sent_jobs")
        .select(`
          id,
          sent_at,
          status,
          error_message,
          channel_id,
          job_id,
          update_id,
          telegram_channels (name, sector, channel_id),
          jobs (title, department),
          exam_updates (title)
        `)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setTelegramLogs((data as any) || []);
      await fetchChannelStats();
    } catch (err: any) {
      console.error("Failed to fetch Telegram logs:", err);
    } finally {
      setLoadingTelegramLogs(false);
    }
  }, [fetchChannelStats]);



  const [sectorSearchQuery, setSectorSearchQuery] = useState("");

  const TELEGRAM_TIERS = [
    {
      name: "Tier 1 (Highest Search Volume)",
      terms: [
        "All Jobs", "SSC", "UPSC", "RRB", "Railway Jobs", "Banking Jobs", "IBPS", "SBI", "RBI", 
        "Defence Jobs", "Army Jobs", "Navy Jobs", "Air Force Jobs", "Police Jobs", 
        "PSU Jobs", "State Government Jobs", "Teaching Jobs", "Central Government Jobs", 
        "Sarkari Naukri", "Government Jobs"
      ]
    },
    {
      name: "Tier 2 (Very Popular)",
      terms: [
        "Banking", "IBPS PO", "IBPS Clerk", "SBI PO", "SBI Clerk", "RBI Grade B", 
        "RBI Assistant", "NABARD", "SIDBI", "Railway", "RRB NTPC", "RRB Group D", 
        "RRB ALP", "RRB JE", "RPF", "SSC CGL", "SSC CHSL", "SSC MTS", "SSC GD", 
        "SSC JE", "SSC CPO", "SSC Stenographer", "UPSC CSE", "IAS", "IPS", "IFS", 
        "CDS", "NDA", "CAPF"
      ]
    },
    {
      name: "Tier 3 (Defence)",
      terms: [
        "Agniveer", "AFCAT", "Indian Army", "Indian Navy", "Indian Air Force", 
        "Coast Guard", "CRPF", "BSF", "CISF", "ITBP", "SSB", "Assam Rifles"
      ]
    },
    {
      name: "Tier 4 (PSU)",
      terms: [
        "ONGC", "NTPC", "BHEL", "IOCL", "HPCL", "BPCL", "GAIL", "SAIL", 
        "POWERGRID", "CIL", "BEL", "HAL", "NPCIL", "DRDO", "ISRO"
      ]
    },
    {
      name: "Tier 5 (Teaching)",
      terms: [
        "CTET", "TET", "UGC NET", "KVS", "NVS", "DSSSB", "Teacher Recruitment", "Assistant Professor"
      ]
    },
    {
      name: "Tier 6 (State PSC)",
      terms: [
        "PSC", "WBPSC", "BPSC", "UPPSC", "MPSC", "RPSC", "TNPSC", "OPSC", "APPSC", "MPPSC", "UKPSC", "HPSC"
      ]
    },
    {
      name: "Tier 7 (Healthcare)",
      terms: [
        "AIIMS", "ESIC", "NHM", "Staff Nurse", "Nursing Officer", "Pharmacist", "Lab Technician", "Medical Officer"
      ]
    },
    {
      name: "Tier 8 (Judiciary)",
      terms: [
        "High Court", "District Court", "Supreme Court", "Law Clerk", "Court Assistant"
      ]
    },
    {
      name: "Tier 9 (Popular Job Titles)",
      terms: [
        "Clerk", "PO", "Officer", "Assistant", "Junior Assistant", "LDC", "UDC", 
        "DEO", "MTS", "Stenographer", "Constable", "SI", "ASI", "Inspector", 
        "JE", "AE", "Technician", "Apprentice", "Teacher", "Professor"
      ]
    }
  ];

  const allUniqueSectors = useMemo(() => {
    const sectors = new Set<string>();
    TELEGRAM_TIERS.forEach(tier => {
      tier.terms.forEach(term => sectors.add(term));
    });
    return Array.from(sectors).sort();
  }, []);

  const filteredTelegramTiers = useMemo(() => {
    if (!sectorSearchQuery.trim()) return TELEGRAM_TIERS;
    const q = sectorSearchQuery.toLowerCase();
    return TELEGRAM_TIERS.map(tier => ({
      ...tier,
      terms: tier.terms.filter(term => term.toLowerCase().includes(q))
    })).filter(tier => tier.terms.length > 0);
  }, [sectorSearchQuery]);

  interface TelegramChannel {
    id: string;
    name: string;
    bot_token: string;
    channel_id: string;
    sector: string;
  }

  const [telegramChannels, setTelegramChannels] = useState<TelegramChannel[]>([]);
  const [newTelegramChannelForm, setNewTelegramChannelForm] = useState({
    name: "",
    bot_token: "",
    channel_id: "",
    sector: "All Jobs"
  });

  // Load channels from database on mount (with localStorage fallback)
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const { data, error } = await supabase
          .from("telegram_channels")
          .select("*")
          .order("created_at", { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          setTelegramChannels(data);
          localStorage.setItem("jobstrackr:telegram_channels", JSON.stringify(data));
        }
      } catch (err) {
        console.error("Failed to fetch telegram channels from DB, falling back to localStorage:", err);
        const stored = localStorage.getItem("jobstrackr:telegram_channels");
        if (stored) {
          try {
            setTelegramChannels(JSON.parse(stored));
          } catch (e) {
            console.error("Failed to parse telegram channels from localStorage", e);
          }
        }
      }
    };
    fetchChannels();
  }, []);

  const handleAddTelegramChannel = async () => {
    if (!newTelegramChannelForm.name.trim() || !newTelegramChannelForm.bot_token.trim() || !newTelegramChannelForm.channel_id.trim()) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    try {
      let rawChannelId = newTelegramChannelForm.channel_id.replace(/[^a-zA-Z0-9_@-]/g, "").trim();
      let formattedChannelId = rawChannelId;
      if (/^\d+$/.test(rawChannelId)) {
        formattedChannelId = `-100${rawChannelId}`;
      } else if (/^-\d+$/.test(rawChannelId) && !rawChannelId.startsWith("-100")) {
        formattedChannelId = `-100${rawChannelId.substring(1)}`;
      } else if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(rawChannelId)) {
        formattedChannelId = `@${rawChannelId}`;
      }

      const cleanedBotToken = newTelegramChannelForm.bot_token.replace(/[^a-zA-Z0-9_:-]/g, "").trim();

      const channelData = {
        name: newTelegramChannelForm.name.trim(),
        bot_token: cleanedBotToken,
        channel_id: formattedChannelId,
        sector: newTelegramChannelForm.sector
      };

      const { data, error } = await supabase
        .from("telegram_channels")
        .insert(channelData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updated = [...telegramChannels, data];
        setTelegramChannels(updated);
        localStorage.setItem("jobstrackr:telegram_channels", JSON.stringify(updated));

        if (!selectedTelegramChannelId) {
          setSelectedTelegramChannelId(data.id);
        }
      }

      setNewTelegramChannelForm({
        name: "",
        bot_token: "",
        channel_id: "",
        sector: "UPSC"
      });
      setShowTelegramAddChannelDialog(false);
      toast({ title: "Success", description: "Telegram channel configured successfully" });
    } catch (e: any) {
      console.error("Failed to save telegram channel:", e);
      toast({
        title: "Error",
        description: e.message || "Failed to save Telegram channel configuration",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTelegramChannel = async (id: string) => {
    try {
      const { error } = await supabase
        .from("telegram_channels")
        .delete()
        .eq("id", id);

      if (error) throw error;

      const updated = telegramChannels.filter(c => c.id !== id);
      setTelegramChannels(updated);
      localStorage.setItem("jobstrackr:telegram_channels", JSON.stringify(updated));

      if (selectedTelegramChannelId === id) {
        setSelectedTelegramChannelId(updated[0]?.id || "");
      }
      toast({ title: "Deleted", description: "Channel configuration removed" });
    } catch (e: any) {
      console.error("Failed to delete telegram channel:", e);
      toast({
        title: "Error",
        description: e.message || "Failed to remove Telegram channel configuration",
        variant: "destructive"
      });
    }
  };

  const handleTelegramTagSelect = (tag: string) => {
    setSelectedTelegramTag(tag);
    setSelectedTelegramJobIds([]);
    setSelectedTelegramUpdateIds([]);
    if (tag !== "All Jobs") {
      setSelectedTelegramSector("All Jobs");
    }
  };

  const activeJobsForTelegram = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    
    const filtered = jobs.filter(job => {
      const lastDate = getJobDeadlineDate(job);
      if (lastDate && lastDate < new Date()) return false;
      
      if (selectedTelegramTag !== "All Jobs") {
        return matchTagFilter(job.title, selectedTelegramTag);
      }
      
      const textToSearch = `${job.title} ${job.department} ${job.qualification} ${job.description || ""}`.toLowerCase();
      const sector = selectedTelegramSector.toLowerCase();
      
      if (sector === "sarkari naukri" || sector === "government jobs" || sector === "all jobs") return true;
      
      if (sector === "railway jobs" && (textToSearch.includes("railway") || textToSearch.includes("rrb"))) return true;
      if (sector === "banking jobs" && (textToSearch.includes("bank") || textToSearch.includes("ibps") || textToSearch.includes("sbi") || textToSearch.includes("rbi"))) return true;
      if (sector === "defence jobs" && (textToSearch.includes("defence") || textToSearch.includes("defense") || textToSearch.includes("army") || textToSearch.includes("navy") || textToSearch.includes("air force") || textToSearch.includes("afcat") || textToSearch.includes("nda") || textToSearch.includes("cds"))) return true;
      if (sector === "army jobs" && (textToSearch.includes("army") || textToSearch.includes("agniveer"))) return true;
      if (sector === "navy jobs" && textToSearch.includes("navy")) return true;
      if (sector === "air force jobs" && (textToSearch.includes("air force") || textToSearch.includes("iaf"))) return true;
      if (sector === "police jobs" && (textToSearch.includes("police") || textToSearch.includes("constable") || textToSearch.includes("sub inspector") || textToSearch.includes("si "))) return true;
      if (sector === "psu jobs" && (textToSearch.includes("psu") || textToSearch.includes("ongc") || textToSearch.includes("ntpc") || textToSearch.includes("bhel") || textToSearch.includes("gail") || textToSearch.includes("sail") || textToSearch.includes("iocl"))) return true;
      if (sector === "teaching jobs" && (textToSearch.includes("teacher") || textToSearch.includes("teaching") || textToSearch.includes("tgt") || textToSearch.includes("pgt") || textToSearch.includes("professor") || textToSearch.includes("lecturer"))) return true;
      if (sector === "state government jobs" && (textToSearch.includes("state government") || textToSearch.includes("state govt") || textToSearch.includes("department of") || textToSearch.includes("government of"))) return true;
      if (sector === "central government jobs" && (textToSearch.includes("central government") || textToSearch.includes("central govt") || textToSearch.includes("india") || textToSearch.includes("union"))) return true;
      
      return textToSearch.includes(sector);
    });

    if (!telegramSortField) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (telegramSortField === "vacancies") {
        const vacA = a.vacancies === null || a.vacancies === undefined ? 0 : a.vacancies;
        const vacB = b.vacancies === null || b.vacancies === undefined ? 0 : b.vacancies;
        comparison = vacA - vacB;
      } else if (telegramSortField === "last_date") {
        const dateA = getJobDeadlineDate(a)?.getTime() ?? 0;
        const dateB = getJobDeadlineDate(b)?.getTime() ?? 0;
        comparison = dateA - dateB;
      } else if (telegramSortField === "created_at") {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        comparison = dateA - dateB;
      }
      return telegramSortDirection === "asc" ? comparison : -comparison;
    });
  }, [jobs, selectedTelegramSector, selectedTelegramTag, telegramSortField, telegramSortDirection]);

  const { data: rawTelegramExamUpdates, isLoading: telegramUpdatesLoading } = useAllExamUpdates();

  const telegramExamUpdates = useMemo(() => {
    if (!Array.isArray(rawTelegramExamUpdates)) return [];
    
    return rawTelegramExamUpdates.filter(update => {
      if (selectedTelegramTag !== "All Jobs") {
        return matchTagFilter(update.title, selectedTelegramTag);
      }
      
      const textToSearch = `${update.title} ${update.category} ${update.status || ""} ${update.summary || ""}`.toLowerCase();
      const sector = selectedTelegramSector.toLowerCase();
      
      if (sector === "sarkari naukri" || sector === "government jobs" || sector === "all jobs") return true;
      
      if (sector === "railway jobs" && (textToSearch.includes("railway") || textToSearch.includes("rrb"))) return true;
      if (sector === "banking jobs" && (textToSearch.includes("bank") || textToSearch.includes("ibps") || textToSearch.includes("sbi") || textToSearch.includes("rbi"))) return true;
      if (sector === "defence jobs" && (textToSearch.includes("defence") || textToSearch.includes("defense") || textToSearch.includes("army") || textToSearch.includes("navy") || textToSearch.includes("air force") || textToSearch.includes("afcat") || textToSearch.includes("nda") || textToSearch.includes("cds"))) return true;
      if (sector === "army jobs" && (textToSearch.includes("army") || textToSearch.includes("agniveer"))) return true;
      if (sector === "navy jobs" && textToSearch.includes("navy")) return true;
      if (sector === "air force jobs" && (textToSearch.includes("air force") || textToSearch.includes("iaf"))) return true;
      if (sector === "police jobs" && (textToSearch.includes("police") || textToSearch.includes("constable") || textToSearch.includes("sub inspector") || textToSearch.includes("si "))) return true;
      if (sector === "psu jobs" && (textToSearch.includes("psu") || textToSearch.includes("ongc") || textToSearch.includes("ntpc") || textToSearch.includes("bhel") || textToSearch.includes("gail") || textToSearch.includes("sail") || textToSearch.includes("iocl"))) return true;
      if (sector === "teaching jobs" && (textToSearch.includes("teacher") || textToSearch.includes("teaching") || textToSearch.includes("tgt") || textToSearch.includes("pgt") || textToSearch.includes("professor") || textToSearch.includes("lecturer"))) return true;
      if (sector === "state government jobs" && (textToSearch.includes("state government") || textToSearch.includes("state govt") || textToSearch.includes("department of") || textToSearch.includes("government of"))) return true;
      if (sector === "central government jobs" && (textToSearch.includes("central government") || textToSearch.includes("central govt") || textToSearch.includes("india") || textToSearch.includes("union"))) return true;
      
      return textToSearch.includes(sector);
    });
  }, [rawTelegramExamUpdates, selectedTelegramSector, selectedTelegramTag]);

  // Telegram Queue Control and Diagnostics Panel States
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0, totalSubscribers: 0 });
  const [loadingQueueStats, setLoadingQueueStats] = useState(false);
  const [flushingQueue, setFlushingQueue] = useState(false);
  const [cleaningQueue, setCleaningQueue] = useState(false);
  const [runningMatcherId, setRunningMatcherId] = useState<string | null>(null);
  const [runningBroadcastId, setRunningBroadcastId] = useState<string | null>(null);
  const [runningBatchMatcher, setRunningBatchMatcher] = useState<"job" | "update" | null>(null);
  const [runningBatchBroadcast, setRunningBatchBroadcast] = useState<"job" | "update" | null>(null);
  const [selectedDiagDate, setSelectedDiagDate] = useState<string>("");

  const fetchQueueStats = useCallback(async () => {
    setLoadingQueueStats(true);
    try {
      const { count: pending } = await supabase
        .from("telegram_notifications_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: sent } = await supabase
        .from("telegram_notifications_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");

      const { count: failed } = await supabase
        .from("telegram_notifications_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const { count: totalSubscribers } = await supabase
        .from("telegram_connections")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setQueueStats({
        pending: pending || 0,
        sent: sent || 0,
        failed: failed || 0,
        totalSubscribers: totalSubscribers || 0
      });
    } catch (err) {
      console.error("Failed to fetch queue stats:", err);
    } finally {
      setLoadingQueueStats(false);
    }
  }, []);

  const handleFlushQueue = async () => {
    setFlushingQueue(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-telegram-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({}),
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || "Failed to flush queue");

      toast({
        title: "Queue Processed",
        description: `Successfully processed: ${resData.sent || 0} sent, ${resData.failed || 0} failed.`,
      });
      fetchQueueStats();
    } catch (err: any) {
      toast({
        title: "Flush Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFlushingQueue(false);
    }
  };

  const handleCleanQueue = async () => {
    setCleaningQueue(true);
    try {
      const { error } = await supabase
        .from("telegram_notifications_queue")
        .delete()
        .neq("status", "pending")
        .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      toast({
        title: "Queue Cleared",
        description: "Sent and failed logs older than 7 days have been cleaned up.",
      });
      fetchQueueStats();
    } catch (err: any) {
      toast({
        title: "Cleanup Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCleaningQueue(false);
    }
  };

  // Helper to run matcher for a single item (returns payload, throws on error)
  const runMatcherItem = async (type: "job" | "update", item: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    let payload = {};
    if (type === "job") {
      payload = {
        type: "job",
        job_id: item.id,
        title: item.title,
        department: item.department,
        location: item.location,
        qualification: item.qualification,
        vacancies_display: item.vacancies_display || (item.vacancies ? `${item.vacancies} Posts` : "Not Published"),
        last_date_display: item.last_date_display || (item.last_date ? String(item.last_date) : "Check Website"),
        slug: item.slug
      };
    } else {
      payload = {
        type: "exam_update",
        update_id: item.id,
        title: item.title,
        category: item.category,
        summary: item.summary
      };
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-telegram-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error || "Failed to trigger matcher");
    return resData;
  };

  // Helper to run broadcast for a single item (returns payload, throws on error)
  const runBroadcastItem = async (type: "job" | "update", item: any) => {
    const { data: { session } } = await supabase.auth.getSession();

    const payload = type === "job" ? { job: item } : { exam_update: item };

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-auto-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error || "Failed to broadcast");
    return resData;
  };

  const handleTriggerMatcher = async (type: "job" | "update", item: any) => {
    setRunningMatcherId(item.id);
    try {
      const resData = await runMatcherItem(type, item);
      toast({
        title: "Matching Completed",
        description: `Preferences matched. Queued new notifications: ${resData.sent || 0} sent/failed in this run.`,
      });
      fetchQueueStats();
    } catch (err: any) {
      toast({
        title: "Matching Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRunningMatcherId(null);
    }
  };

  const handleTriggerBroadcast = async (type: "job" | "update", item: any) => {
    setRunningBroadcastId(item.id);
    try {
      const resData = await runBroadcastItem(type, item);
      toast({
        title: "Broadcast Complete",
        description: `Successfully posted to ${resData.postedCount || 0}/${resData.totalCount || 0} channels.`,
      });
    } catch (err: any) {
      toast({
        title: "Broadcast Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRunningBroadcastId(null);
    }
  };

  const handleTriggerAllMatchers = async (type: "job" | "update") => {
    const items = type === "job" ? recentJobs : recentUpdates;
    if (items.length === 0) return;

    setRunningBatchMatcher(type);
    let successCount = 0;
    let failCount = 0;
    let totalSent = 0;

    try {
      for (const item of items) {
        setRunningMatcherId(item.id);
        try {
          const resData = await runMatcherItem(type, item);
          successCount++;
          totalSent += resData.sent || 0;
        } catch (err: any) {
          console.error(`Batch Matcher failed for ${item.title || item.id}:`, err);
          failCount++;
        }
      }

      toast({
        title: "Batch Matching Completed",
        description: `Successfully matched ${successCount}/${items.length} items. Total queued notifications: ${totalSent}.${failCount > 0 ? ` (${failCount} failed)` : ""}`,
      });
      fetchQueueStats();
    } catch (err: any) {
      toast({
        title: "Batch Matching Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRunningMatcherId(null);
      setRunningBatchMatcher(null);
    }
  };

  const handleTriggerAllBroadcasts = async (type: "job" | "update") => {
    const items = type === "job" ? recentJobs : recentUpdates;
    if (items.length === 0) return;

    setRunningBatchBroadcast(type);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of items) {
        setRunningBroadcastId(item.id);
        try {
          await runBroadcastItem(type, item);
          successCount++;
        } catch (err: any) {
          console.error(`Batch Broadcast failed for ${item.title || item.id}:`, err);
          failCount++;
        }
      }

      toast({
        title: "Batch Broadcast Completed",
        description: `Successfully broadcasted ${successCount}/${items.length} items.${failCount > 0 ? ` (${failCount} failed)` : ""}`,
      });
    } catch (err: any) {
      toast({
        title: "Batch Broadcast Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRunningBroadcastId(null);
      setRunningBatchBroadcast(null);
    }
  };

  const recentJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    let list = [...jobs];
    if (selectedDiagDate) {
      list = list.filter(job => {
        try {
          return format(new Date(job.created_at), "yyyy-MM-dd") === selectedDiagDate;
        } catch {
          return false;
        }
      });
    }
    const sorted = list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return selectedDiagDate ? sorted : sorted.slice(0, 5);
  }, [jobs, selectedDiagDate]);

  const recentUpdates = useMemo(() => {
    if (!Array.isArray(rawTelegramExamUpdates)) return [];
    let list = [...rawTelegramExamUpdates];
    if (selectedDiagDate) {
      list = list.filter(update => {
        try {
          return format(new Date(update.created_at), "yyyy-MM-dd") === selectedDiagDate;
        } catch {
          return false;
        }
      });
    }
    const sorted = list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return selectedDiagDate ? sorted : sorted.slice(0, 5);
  }, [rawTelegramExamUpdates, selectedDiagDate]);

  useEffect(() => {
    fetchTelegramLogs();
    fetchQueueStats();
  }, [fetchTelegramLogs, fetchQueueStats]);

  const handlePostToTelegram = async () => {
    const channel = telegramChannels.find(c => c.id === selectedTelegramChannelId);
    if (!channel) {
      toast({ title: "Error", description: "Please select/configure a Telegram channel", variant: "destructive" });
      return;
    }

    const idsToPost = telegramSourceType === "jobs" ? selectedTelegramJobIds : selectedTelegramUpdateIds;
    if (idsToPost.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to post", variant: "destructive" });
      return;
    }

    setPostingToTelegram(true);
    setTelegramConsoleLogs([
      `[${format(new Date(), "HH:mm:ss")}] 🚀 Starting dispatch to Telegram channel: "${channel.name}"`,
      `[${format(new Date(), "HH:mm:ss")}] 📋 Found ${idsToPost.length} selected item(s) to process`
    ]);

    try {
      // Fetch already sent items to prevent duplicate posts
      let sentIds = new Set<string>();
      try {
        const { data: sentItems } = await supabase
          .from("telegram_sent_jobs")
          .select("job_id, update_id")
          .eq("channel_id", channel.id)
          .eq("status", "success");

        if (sentItems) {
          sentItems.forEach(item => {
            const sentId = telegramSourceType === "jobs" ? item.job_id : item.update_id;
            if (sentId) sentIds.add(sentId);
          });
        }
      } catch (err) {
        console.error("Failed to check duplicate postings", err);
      }

      let successCount = 0;

      for (let i = 0; i < idsToPost.length; i++) {
        const id = idsToPost[i];
        let messageText = "";
        let itemTitle = "";

        if (telegramSourceType === "jobs") {
          const job = jobs?.find(j => j.id === id);
          if (!job) continue;
          itemTitle = job.title;
          const jobLink = `${getWebappBaseUrl()}/jobs/${job.slug || job.id}`;
          
          // Dynamic hashtags
          const hashtags = ["#GovernmentJobs", "#SarkariNaukri"];
          const titleLower = job.title.toLowerCase();
          const deptLower = job.department.toLowerCase();
          if (titleLower.includes("ssc") || deptLower.includes("ssc")) hashtags.unshift("#SSC");
          else if (titleLower.includes("upsc") || deptLower.includes("upsc")) hashtags.unshift("#UPSC");
          else if (titleLower.includes("rrb") || titleLower.includes("railway") || deptLower.includes("railway")) hashtags.unshift("#Railway");
          else if (titleLower.includes("bank") || deptLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
          else if (titleLower.includes("police") || deptLower.includes("police")) hashtags.unshift("#Police");
          else if (titleLower.includes("defence") || titleLower.includes("army") || titleLower.includes("navy") || titleLower.includes("air force")) hashtags.unshift("#Defence");
          else if (titleLower.includes("teacher") || titleLower.includes("teaching")) hashtags.unshift("#TeachingJobs");
          else if (titleLower.includes("court") || titleLower.includes("judic")) hashtags.unshift("#Judiciary");
          else if (titleLower.includes("steno")) hashtags.unshift("#Stenographer");
          const hashtagsStr = hashtags.join(" ");

          messageText = `
*🚨 NEW RECRUITMENT ALERT*

*📌 ${job.title}*

🏢 Organization: ${job.department}
👥 Vacancies: ${job.vacancies_display || job.vacancies || "TBD"}
📅 Last Date: ${(() => {
            const d = getJobDeadlineDate(job);
            return d ? format(d, "dd MMM yyyy") : job.last_date_display || job.last_date;
          })()}

✅ Apply Online

🔗 View Full Notification:
${jobLink}

${hashtagsStr}
          `.trim();
        } else {
          const update = telegramExamUpdates?.find(u => u.id === id);
          if (!update) continue;
          itemTitle = update.title;
          const updateLink = `${getWebappBaseUrl()}/updates/${update.update_slug || update.id}`;
          
          const categoryLower = update.category.toLowerCase();
          const titleLower = update.title.toLowerCase();

          // Determine template type and dynamic hashtags
          let tagCategory = "#ExamUpdate";
          let templateType: "admit_card" | "result" | "answer_key" | "recruitment" = "recruitment";
          
          if (categoryLower.includes("admit") || titleLower.includes("admit") || categoryLower.includes("city") || titleLower.includes("city") || categoryLower.includes("hall") || categoryLower.includes("call") || categoryLower.includes("syllabus")) {
            templateType = "admit_card";
            tagCategory = "#AdmitCard";
          } else if (categoryLower.includes("result") || titleLower.includes("result") || categoryLower.includes("cutoff") || titleLower.includes("cutoff") || categoryLower.includes("scorecard") || categoryLower.includes("merit")) {
            templateType = "result";
            tagCategory = "#Result";
          } else if (categoryLower.includes("answer") || titleLower.includes("answer") || categoryLower.includes("key") || titleLower.includes("key") || categoryLower.includes("sheet")) {
            templateType = "answer_key";
            tagCategory = "#AnswerKey";
          }

          const hashtags = [tagCategory];
          if (templateType === "result" || templateType === "recruitment") {
            hashtags.push("#GovernmentJobs");
          } else {
            hashtags.push("#ExamUpdate");
          }
          
          if (titleLower.includes("ssc")) hashtags.unshift("#SSC");
          else if (titleLower.includes("upsc")) hashtags.unshift("#UPSC");
          else if (titleLower.includes("rrb") || titleLower.includes("railway")) hashtags.unshift("#Railway");
          else if (titleLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
          else if (titleLower.includes("police")) hashtags.unshift("#Police");
          else if (titleLower.includes("defence")) hashtags.unshift("#Defence");
          const hashtagsStr = hashtags.join(" ");

          if (templateType === "admit_card") {
            const statusText = update.status || (titleLower.includes("city") ? "Exam City Slip Released" : "Admit Card Released");
            const examDate = (() => {
              if (update.important_dates && Array.isArray(update.important_dates)) {
                const match = update.important_dates.find(d => 
                  /exam|test|written|cbt|date/i.test(d.event) && !/admit|result|apply|registration/i.test(d.event)
                );
                if (match) return match.date;
              }
              return "Check Details";
            })();

            messageText = `
*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

📍 ${statusText}
📅 Exam Date: ${examDate}

✅ Download Now

🔗 View Details:
${updateLink}

${hashtagsStr}
            `.trim();
          } else if (templateType === "result") {
            messageText = `
*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

📢 Result Released Successfully

✅ Check Your Result

🔗 View Result:
${updateLink}

${hashtagsStr}
            `.trim();
          } else if (templateType === "answer_key") {
            messageText = `
*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

📢 Official Answer Key Available

✅ Check Response Sheet & Answer Key

🔗 View Details:
${updateLink}

${hashtagsStr}
            `.trim();
          } else {
            // Fallback recruitment alert
            const orgText = (() => {
              if (titleLower.includes("ssc")) return "SSC";
              if (titleLower.includes("upsc")) return "UPSC";
              if (titleLower.includes("rrb") || titleLower.includes("railway")) return "RRB / Railways";
              if (titleLower.includes("sbi")) return "SBI";
              if (titleLower.includes("ibps")) return "IBPS";
              const match = update.title.match(/^(.*?)\s+(recruitment|exam|vacancy|admit|result)/i);
              if (match && match[1]) return match[1].trim();
              return "Government Agency";
            })();

            messageText = `
*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

🏢 Organization: ${orgText}
📢 Notification Details Available

✅ View Notification & Apply

🔗 View Details:
${updateLink}

${hashtagsStr}
            `.trim();
          }
        }

        setTelegramConsoleLogs(prev => [
          ...prev,
          `[${format(new Date(), "HH:mm:ss")}] Preparing message for: "${itemTitle}"`
        ]);

        // Prevent duplicate sending
        if (sentIds.has(id)) {
          setTelegramConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] ⚠️ Skipped duplicate: "${itemTitle}" already successfully sent to this channel.`
          ]);
          successCount++;
          continue;
        }

        let rawChannelId = (channel.channel_id || "").replace(/[^a-zA-Z0-9_@-]/g, "").trim();
        let formattedChannelId = rawChannelId;
        if (/^\d+$/.test(rawChannelId)) {
          formattedChannelId = `-100${rawChannelId}`;
        } else if (/^-\d+$/.test(rawChannelId) && !rawChannelId.startsWith("-100")) {
          formattedChannelId = `-100${rawChannelId.substring(1)}`;
        } else if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(rawChannelId)) {
          formattedChannelId = `@${rawChannelId}`;
        }

        const cleanedBotToken = (channel.bot_token || "").replace(/[^a-zA-Z0-9_:-]/g, "").trim();

        const response = await fetch(`https://api.telegram.org/bot${cleanedBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: formattedChannelId,
            text: messageText,
            parse_mode: "Markdown",
            disable_web_page_preview: true,
            link_preview_options: { is_disabled: true }
          })
        });

        const data = await response.json();
        if (response.ok && data.ok) {
          successCount++;
          setTelegramConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] ✅ Successfully posted to Telegram! (${successCount}/${idsToPost.length})`
          ]);

          // Log success to DB
          await supabase.from("telegram_sent_jobs").insert({
            channel_id: channel.id,
            [telegramSourceType === "jobs" ? "job_id" : "update_id"]: id,
            status: "success"
          });
        } else {
          console.error(`Telegram post error for ID ${id}:`, data.description);
          setTelegramConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] ❌ Error posting "${itemTitle}": ${data.description || "Unknown error"}`
          ]);

          // Log failure to DB
          await supabase.from("telegram_sent_jobs").insert({
            channel_id: channel.id,
            [telegramSourceType === "jobs" ? "job_id" : "update_id"]: id,
            status: "failed",
            error_message: data.description || "Unknown Telegram API error"
          });
        }

        // Add a 1000ms delay between posts to prevent Telegram rate limits
        if (i < idsToPost.length - 1) {
          setTelegramConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] 🕒 Delaying 1.0s to respect Telegram API rate limits...`
          ]);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Refresh logs history
      fetchTelegramLogs();

      if (successCount === idsToPost.length) {
        setTelegramConsoleLogs(prev => [
          ...prev,
          `[${format(new Date(), "HH:mm:ss")}] 🎉 Completed broadcasting. All ${successCount} messages posted successfully!`
        ]);
        toast({ title: "Success", description: `Posted ${successCount} notification(s) to Telegram channel successfully!` });
        // Clear selection
        if (telegramSourceType === "jobs") {
          setSelectedTelegramJobIds([]);
        } else {
          setSelectedTelegramUpdateIds([]);
        }
      } else {
        setTelegramConsoleLogs(prev => [
          ...prev,
          `[${format(new Date(), "HH:mm:ss")}] ⚠️ Completed broadcasting with errors. ${successCount} out of ${idsToPost.length} messages sent.`
        ]);
        toast({
          title: "Partial Success",
          description: `Posted ${successCount} out of ${idsToPost.length} notifications. Check console for errors.`,
          variant: "warning" as any
        });
      }
    } catch (e: any) {
      console.error("Telegram post error:", e);
      setTelegramConsoleLogs(prev => [
        ...prev,
        `[${format(new Date(), "HH:mm:ss")}] 🚨 System Exception: ${e.message || "Failed to communicate with Telegram API"}`
      ]);
      toast({ title: "Error", description: e.message || "Failed to send message to Telegram", variant: "destructive" });
    } finally {
      setPostingToTelegram(false);
    }
  };

  const getTelegramPreviewMessage = () => {
    const ids = telegramSourceType === "jobs" ? selectedTelegramJobIds : selectedTelegramUpdateIds;
    if (ids.length === 0) {
      return "Select one or more items to see the live preview...";
    }

    const firstId = ids[0];
    if (telegramSourceType === "jobs") {
      const job = jobs?.find(j => j.id === firstId);
      if (!job) return "Select a job to see the live preview...";
      const jobLink = `${getWebappBaseUrl()}/jobs/${job.slug || job.id}`;
      const prefix = ids.length > 1 ? `[Previewing 1 of ${ids.length} selected jobs]\n\n` : "";
      
      const hashtags = ["#GovernmentJobs", "#SarkariNaukri"];
      const titleLower = job.title.toLowerCase();
      const deptLower = job.department.toLowerCase();
      if (titleLower.includes("ssc") || deptLower.includes("ssc")) hashtags.unshift("#SSC");
      else if (titleLower.includes("upsc") || deptLower.includes("upsc")) hashtags.unshift("#UPSC");
      else if (titleLower.includes("rrb") || titleLower.includes("railway") || deptLower.includes("railway")) hashtags.unshift("#Railway");
      else if (titleLower.includes("bank") || deptLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
      else if (titleLower.includes("police") || deptLower.includes("police")) hashtags.unshift("#Police");
      else if (titleLower.includes("defence") || titleLower.includes("army") || titleLower.includes("navy") || titleLower.includes("air force")) hashtags.unshift("#Defence");
      const hashtagsStr = hashtags.join(" ");

      return `${prefix}*🚨 NEW RECRUITMENT ALERT*

*📌 ${job.title}*

🏢 Organization: ${job.department}
👥 Vacancies: ${job.vacancies_display || job.vacancies || "TBD"}
📅 Last Date: ${(() => {
        const d = getJobDeadlineDate(job);
        return d ? format(d, "dd MMM yyyy") : job.last_date_display || job.last_date;
      })()}

✅ Apply Online

🔗 View Full Notification:
${jobLink}

${hashtagsStr}`;
    } else {
      const update = telegramExamUpdates?.find(u => u.id === firstId);
      if (!update) return "Select an update to see the live preview...";
      const updateLink = `${getWebappBaseUrl()}/updates/${update.update_slug || update.id}`;
      const prefix = ids.length > 1 ? `[Previewing 1 of ${ids.length} selected updates]\n\n` : "";

      const categoryLower = update.category.toLowerCase();
      const titleLower = update.title.toLowerCase();

      let tagCategory = "#ExamUpdate";
      let templateType: "admit_card" | "result" | "answer_key" | "recruitment" = "recruitment";
      
      if (categoryLower.includes("admit") || titleLower.includes("admit") || categoryLower.includes("city") || titleLower.includes("city") || categoryLower.includes("hall") || categoryLower.includes("call") || categoryLower.includes("syllabus")) {
        templateType = "admit_card";
        tagCategory = "#AdmitCard";
      } else if (categoryLower.includes("result") || titleLower.includes("result") || categoryLower.includes("cutoff") || titleLower.includes("cutoff") || categoryLower.includes("scorecard") || categoryLower.includes("merit")) {
        templateType = "result";
        tagCategory = "#Result";
      } else if (categoryLower.includes("answer") || titleLower.includes("answer") || categoryLower.includes("key") || titleLower.includes("key") || categoryLower.includes("sheet")) {
        templateType = "answer_key";
        tagCategory = "#AnswerKey";
      }

      const hashtags = [tagCategory];
      if (templateType === "result" || templateType === "recruitment") {
        hashtags.push("#GovernmentJobs");
      } else {
        hashtags.push("#ExamUpdate");
      }
      
      if (titleLower.includes("ssc")) hashtags.unshift("#SSC");
      else if (titleLower.includes("upsc")) hashtags.unshift("#UPSC");
      else if (titleLower.includes("rrb") || titleLower.includes("railway")) hashtags.unshift("#Railway");
      else if (titleLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
      else if (titleLower.includes("police")) hashtags.unshift("#Police");
      else if (titleLower.includes("defence")) hashtags.unshift("#Defence");
      const hashtagsStr = hashtags.join(" ");

      if (templateType === "admit_card") {
        const statusText = update.status || (titleLower.includes("city") ? "Exam City Slip Released" : "Admit Card Released");
        const examDate = (() => {
          if (update.important_dates && Array.isArray(update.important_dates)) {
            const match = update.important_dates.find(d => 
              /exam|test|written|cbt|date/i.test(d.event) && !/admit|result|apply|registration/i.test(d.event)
            );
            if (match) return match.date;
          }
          return "Check Details";
        })();

        return `${prefix}*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

📍 ${statusText}
📅 Exam Date: ${examDate}

✅ Download Now

🔗 View Details:
${updateLink}

${hashtagsStr}`;
      } else if (templateType === "result") {
        return `${prefix}*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

📢 Result Released Successfully

✅ Check Your Result

🔗 View Result:
${updateLink}

${hashtagsStr}`;
      } else if (templateType === "answer_key") {
        return `${prefix}*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

📢 Official Answer Key Available

✅ Check Response Sheet & Answer Key

🔗 View Details:
${updateLink}

${hashtagsStr}`;
      } else {
        const orgText = (() => {
          if (titleLower.includes("ssc")) return "SSC";
          if (titleLower.includes("upsc")) return "UPSC";
          if (titleLower.includes("rrb") || titleLower.includes("railway")) return "RRB / Railways";
          if (titleLower.includes("sbi")) return "SBI";
          if (titleLower.includes("ibps")) return "IBPS";
          const match = update.title.match(/^(.*?)\s+(recruitment|exam|vacancy|admit|result)/i);
          if (match && match[1]) return match[1].trim();
          return "Government Agency";
        })();

        return `${prefix}*🔔 IMPORTANT UPDATE*

*📌 ${update.title}*

🏢 Organization: ${orgText}
📢 Notification Details Available

✅ View Notification & Apply

🔗 View Details:
${updateLink}

${hashtagsStr}`;
      }
    }
  };

  // Facebook Posting states
  const [selectedFacebookSector, setSelectedFacebookSector] = useState<string>("All Jobs");
  const [selectedFacebookTag, setSelectedFacebookTag] = useState<string>("All Jobs");
  const [facebookSourceType, setFacebookSourceType] = useState<"jobs" | "updates">("jobs");
  const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string>("");
  const [selectedFacebookJobIds, setSelectedFacebookJobIds] = useState<string[]>([]);
  const [selectedFacebookUpdateIds, setSelectedFacebookUpdateIds] = useState<string[]>([]);
  const [postingToFacebook, setPostingToFacebook] = useState<boolean>(false);
  const [showFacebookAddPageDialog, setShowFacebookAddPageDialog] = useState<boolean>(false);
  const [facebookSortField, setFacebookSortField] = useState<"vacancies" | "last_date" | "created_at" | null>("created_at");
  const [facebookSortDirection, setFacebookSortDirection] = useState<"asc" | "desc">("desc");
  const [facebookConsoleLogs, setFacebookConsoleLogs] = useState<string[]>([]);
  const facebookConsoleBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the Facebook console to the bottom when new logs are added
  useEffect(() => {
    if (facebookConsoleBottomRef.current) {
      facebookConsoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [facebookConsoleLogs]);

  interface FacebookPage {
    id: string;
    name: string;
    access_token: string;
    page_id: string;
    sector: string;
  }

  interface FacebookSentJobLog {
    id: string;
    sent_at: string;
    status: string;
    error_message: string | null;
    page_id: string;
    job_id: string | null;
    update_id: string | null;
    facebook_pages: {
      name: string;
      sector: string;
      page_id: string;
    } | null;
    jobs: {
      title: string;
      department: string;
    } | null;
    exam_updates: {
      title: string;
    } | null;
  }

  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [newFacebookPageForm, setNewFacebookPageForm] = useState({
    name: "",
    access_token: "",
    page_id: "",
    sector: "All Jobs"
  });

  const [facebookLogs, setFacebookLogs] = useState<FacebookSentJobLog[]>([]);
  const [loadingFacebookLogs, setLoadingFacebookLogs] = useState(false);
  const [facebookPageStats, setFacebookPageStats] = useState<Record<string, { total: number; lastSent: string | null; lastTitle: string | null; lastStatus: string | null }>>({});

  const fetchFacebookPageStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("facebook_sent_jobs")
        .select(`
          page_id,
          status,
          sent_at,
          jobs (title),
          exam_updates (title)
        `)
        .order("sent_at", { ascending: false });

      if (error) throw error;

      const stats: Record<string, { total: number; lastSent: string | null; lastTitle: string | null; lastStatus: string | null }> = {};
      
      data?.forEach((item: any) => {
        const pId = item.page_id;
        if (!stats[pId]) {
          stats[pId] = { total: 0, lastSent: null, lastTitle: null, lastStatus: null };
        }
        
        if (item.status === "success") {
          stats[pId].total += 1;
          if (!stats[pId].lastSent) {
            stats[pId].lastSent = item.sent_at;
            stats[pId].lastTitle = item.jobs?.title || item.exam_updates?.title || "Unknown Item";
            stats[pId].lastStatus = "success";
          }
        } else if (!stats[pId].lastSent) {
          stats[pId].lastSent = item.sent_at;
          stats[pId].lastTitle = item.jobs?.title || item.exam_updates?.title || "Unknown Item";
          stats[pId].lastStatus = item.status;
        }
      });
      
      setFacebookPageStats(stats);
    } catch (err) {
      console.error("Failed to fetch facebook page stats:", err);
    }
  }, []);

  const fetchFacebookLogs = useCallback(async () => {
    setLoadingFacebookLogs(true);
    try {
      const { data, error } = await supabase
        .from("facebook_sent_jobs")
        .select(`
          id,
          sent_at,
          status,
          error_message,
          page_id,
          job_id,
          update_id,
          facebook_pages (name, sector, page_id),
          jobs (title, department),
          exam_updates (title)
        `)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setFacebookLogs((data as any) || []);
      await fetchFacebookPageStats();
    } catch (err: any) {
      console.error("Failed to fetch Facebook logs:", err);
    } finally {
      setLoadingFacebookLogs(false);
    }
  }, [fetchFacebookPageStats]);

  // Fetch Facebook pages from database on mount (with localStorage fallback)
  const fetchFacebookPages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("facebook_pages")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        setFacebookPages(data);
        localStorage.setItem("jobstrackr:facebook_pages", JSON.stringify(data));
        if (data.length > 0 && !selectedFacebookPageId) {
          setSelectedFacebookPageId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch facebook pages from DB, falling back to localStorage:", err);
      const stored = localStorage.getItem("jobstrackr:facebook_pages");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFacebookPages(parsed);
          if (parsed.length > 0 && !selectedFacebookPageId) {
            setSelectedFacebookPageId(parsed[0].id);
          }
        } catch (e) {
          console.error("Failed to parse facebook pages from localStorage", e);
        }
      }
    }
  }, [selectedFacebookPageId]);

  useEffect(() => {
    fetchFacebookPages();
    fetchFacebookLogs();
  }, [fetchFacebookPages, fetchFacebookLogs]);

  const handleAddFacebookPage = async () => {
    if (!newFacebookPageForm.name.trim() || !newFacebookPageForm.access_token.trim() || !newFacebookPageForm.page_id.trim()) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    try {
      const pageData = {
        name: newFacebookPageForm.name.trim(),
        access_token: newFacebookPageForm.access_token.trim(),
        page_id: newFacebookPageForm.page_id.trim(),
        sector: newFacebookPageForm.sector
      };

      const { data, error } = await supabase
        .from("facebook_pages")
        .insert(pageData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updated = [...facebookPages, data];
        setFacebookPages(updated);
        localStorage.setItem("jobstrackr:facebook_pages", JSON.stringify(updated));

        if (!selectedFacebookPageId) {
          setSelectedFacebookPageId(data.id);
        }
      }

      setNewFacebookPageForm({
        name: "",
        access_token: "",
        page_id: "",
        sector: "All Jobs"
      });
      setShowFacebookAddPageDialog(false);
      toast({ title: "Success", description: "Facebook page configured successfully" });
      await fetchFacebookPages();
    } catch (e: any) {
      console.error("Failed to save facebook page:", e);
      toast({
        title: "Error",
        description: e.message || "Failed to save Facebook page configuration",
        variant: "destructive"
      });
    }
  };

  const handleDeleteFacebookPage = async (id: string) => {
    try {
      const { error } = await supabase
        .from("facebook_pages")
        .delete()
        .eq("id", id);

      if (error) throw error;

      const updated = facebookPages.filter(p => p.id !== id);
      setFacebookPages(updated);
      localStorage.setItem("jobstrackr:facebook_pages", JSON.stringify(updated));

      if (selectedFacebookPageId === id) {
        setSelectedFacebookPageId(updated[0]?.id || "");
      }
      toast({ title: "Deleted", description: "Facebook page configuration removed" });
      await fetchFacebookPages();
    } catch (e: any) {
      console.error("Failed to delete facebook page:", e);
      toast({
        title: "Error",
        description: e.message || "Failed to remove Facebook page configuration",
        variant: "destructive"
      });
    }
  };

  const handleFacebookTagSelect = (tag: string) => {
    setSelectedFacebookTag(tag);
    setSelectedFacebookJobIds([]);
    setSelectedFacebookUpdateIds([]);
    if (tag !== "All Jobs") {
      setSelectedFacebookSector("All Jobs");
    }
  };

  const activeJobsForFacebook = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    
    const filtered = jobs.filter(job => {
      const lastDate = getJobDeadlineDate(job);
      if (lastDate && lastDate < new Date()) return false;
      
      if (selectedFacebookTag !== "All Jobs") {
        return matchTagFilter(job.title, selectedFacebookTag);
      }
      
      const textToSearch = `${job.title} ${job.department} ${job.qualification} ${job.description || ""}`.toLowerCase();
      const sector = selectedFacebookSector.toLowerCase();
      
      if (sector === "sarkari naukri" || sector === "government jobs" || sector === "all jobs") return true;
      
      if (sector === "railway jobs" && (textToSearch.includes("railway") || textToSearch.includes("rrb"))) return true;
      if (sector === "banking jobs" && (textToSearch.includes("bank") || textToSearch.includes("ibps") || textToSearch.includes("sbi") || textToSearch.includes("rbi"))) return true;
      if (sector === "defence jobs" && (textToSearch.includes("defence") || textToSearch.includes("defense") || textToSearch.includes("army") || textToSearch.includes("navy") || textToSearch.includes("air force") || textToSearch.includes("afcat") || textToSearch.includes("nda") || textToSearch.includes("cds"))) return true;
      if (sector === "army jobs" && (textToSearch.includes("army") || textToSearch.includes("agniveer"))) return true;
      if (sector === "navy jobs" && textToSearch.includes("navy")) return true;
      if (sector === "air force jobs" && (textToSearch.includes("air force") || textToSearch.includes("iaf"))) return true;
      if (sector === "police jobs" && (textToSearch.includes("police") || textToSearch.includes("constable") || textToSearch.includes("sub inspector") || textToSearch.includes("si "))) return true;
      if (sector === "psu jobs" && (textToSearch.includes("psu") || textToSearch.includes("ongc") || textToSearch.includes("ntpc") || textToSearch.includes("bhel") || textToSearch.includes("gail") || textToSearch.includes("sail") || textToSearch.includes("iocl"))) return true;
      if (sector === "teaching jobs" && (textToSearch.includes("teacher") || textToSearch.includes("teaching") || textToSearch.includes("tgt") || textToSearch.includes("pgt") || textToSearch.includes("professor") || textToSearch.includes("lecturer"))) return true;
      if (sector === "state government jobs" && (textToSearch.includes("state government") || textToSearch.includes("state govt") || textToSearch.includes("department of") || textToSearch.includes("government of"))) return true;
      if (sector === "central government jobs" && (textToSearch.includes("central government") || textToSearch.includes("central govt") || textToSearch.includes("india") || textToSearch.includes("union"))) return true;
      
      return textToSearch.includes(sector);
    });

    if (!facebookSortField) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (facebookSortField === "vacancies") {
        const vacA = a.vacancies === null || a.vacancies === undefined ? 0 : a.vacancies;
        const vacB = b.vacancies === null || b.vacancies === undefined ? 0 : b.vacancies;
        comparison = vacA - vacB;
      } else if (facebookSortField === "last_date") {
        const dateA = getJobDeadlineDate(a)?.getTime() ?? 0;
        const dateB = getJobDeadlineDate(b)?.getTime() ?? 0;
        comparison = dateA - dateB;
      } else if (facebookSortField === "created_at") {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        comparison = dateA - dateB;
      }
      return facebookSortDirection === "asc" ? comparison : -comparison;
    });
  }, [jobs, selectedFacebookSector, selectedFacebookTag, facebookSortField, facebookSortDirection]);

  const facebookExamUpdates = useMemo(() => {
    if (!Array.isArray(rawTelegramExamUpdates)) return [];
    
    return rawTelegramExamUpdates.filter(update => {
      if (selectedFacebookTag !== "All Jobs") {
        return matchTagFilter(update.title, selectedFacebookTag);
      }
      
      const textToSearch = `${update.title} ${update.category} ${update.status || ""} ${update.summary || ""}`.toLowerCase();
      const sector = selectedFacebookSector.toLowerCase();
      
      if (sector === "sarkari naukri" || sector === "government jobs" || sector === "all jobs") return true;
      
      if (sector === "railway jobs" && (textToSearch.includes("railway") || textToSearch.includes("rrb"))) return true;
      if (sector === "banking jobs" && (textToSearch.includes("bank") || textToSearch.includes("ibps") || textToSearch.includes("sbi") || textToSearch.includes("rbi"))) return true;
      if (sector === "defence jobs" && (textToSearch.includes("defence") || textToSearch.includes("defense") || textToSearch.includes("army") || textToSearch.includes("navy") || textToSearch.includes("air force") || textToSearch.includes("afcat") || textToSearch.includes("nda") || textToSearch.includes("cds"))) return true;
      if (sector === "army jobs" && (textToSearch.includes("army") || textToSearch.includes("agniveer"))) return true;
      if (sector === "navy jobs" && textToSearch.includes("navy")) return true;
      if (sector === "air force jobs" && (textToSearch.includes("air force") || textToSearch.includes("iaf"))) return true;
      if (sector === "police jobs" && (textToSearch.includes("police") || textToSearch.includes("constable") || textToSearch.includes("sub inspector") || textToSearch.includes("si "))) return true;
      if (sector === "psu jobs" && (textToSearch.includes("psu") || textToSearch.includes("ongc") || textToSearch.includes("ntpc") || textToSearch.includes("bhel") || textToSearch.includes("gail") || textToSearch.includes("sail") || textToSearch.includes("iocl"))) return true;
      if (sector === "teaching jobs" && (textToSearch.includes("teacher") || textToSearch.includes("teaching") || textToSearch.includes("tgt") || textToSearch.includes("pgt") || textToSearch.includes("professor") || textToSearch.includes("lecturer"))) return true;
      if (sector === "state government jobs" && (textToSearch.includes("state government") || textToSearch.includes("state govt") || textToSearch.includes("department of") || textToSearch.includes("government of"))) return true;
      if (sector === "central government jobs" && (textToSearch.includes("central government") || textToSearch.includes("central govt") || textToSearch.includes("india") || textToSearch.includes("union"))) return true;
      
      return textToSearch.includes(sector);
    });
  }, [rawTelegramExamUpdates, selectedFacebookSector, selectedFacebookTag]);

  const getFacebookPreviewMessage = () => {
    const ids = facebookSourceType === "jobs" ? selectedFacebookJobIds : selectedFacebookUpdateIds;
    if (ids.length === 0) {
      return "Select one or more items to see the live preview...";
    }

    const firstId = ids[0];
    if (facebookSourceType === "jobs") {
      const job = jobs?.find(j => j.id === firstId);
      if (!job) return "Select a job to see the live preview...";
      const jobLink = `${getWebappBaseUrl()}/jobs/${job.slug || job.id}`;
      const prefix = ids.length > 1 ? `[Previewing 1 of ${ids.length} selected jobs]\n\n` : "";
      
      const hashtags = ["#GovernmentJobs", "#SarkariNaukri"];
      const titleLower = job.title.toLowerCase();
      const deptLower = job.department.toLowerCase();
      if (titleLower.includes("ssc") || deptLower.includes("ssc")) hashtags.unshift("#SSC");
      else if (titleLower.includes("upsc") || deptLower.includes("upsc")) hashtags.unshift("#UPSC");
      else if (titleLower.includes("rrb") || titleLower.includes("railway") || deptLower.includes("railway")) hashtags.unshift("#Railway");
      else if (titleLower.includes("bank") || deptLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
      else if (titleLower.includes("police") || deptLower.includes("police")) hashtags.unshift("#Police");
      else if (titleLower.includes("defence") || titleLower.includes("army") || titleLower.includes("navy") || titleLower.includes("air force")) hashtags.unshift("#Defence");
      else if (titleLower.includes("teacher") || titleLower.includes("teaching")) hashtags.unshift("#TeachingJobs");
      else if (titleLower.includes("court") || titleLower.includes("judic")) hashtags.unshift("#Judiciary");
      else if (titleLower.includes("steno")) hashtags.unshift("#Stenographer");
      const hashtagsStr = hashtags.join(" ");

      return `${prefix}NEW RECRUITMENT ALERT

📌 ${job.title}

🏢 Organization: ${job.department}
👥 Vacancies: ${job.vacancies_display || job.vacancies || "TBD"}
📅 Last Date: ${(() => {
        const d = getJobDeadlineDate(job);
        return d ? format(d, "dd MMM yyyy") : job.last_date_display || job.last_date;
      })()}

✅ Apply Online

🔗 View Full Notification:
${jobLink}

${hashtagsStr}`;
    } else {
      const update = facebookExamUpdates?.find(u => u.id === firstId);
      if (!update) return "Select an update to see the live preview...";
      const updateLink = `${getWebappBaseUrl()}/updates/${update.update_slug || update.id}`;
      const prefix = ids.length > 1 ? `[Previewing 1 of ${ids.length} selected updates]\n\n` : "";

      const categoryLower = update.category.toLowerCase();
      const titleLower = update.title.toLowerCase();

      let tagCategory = "#ExamUpdate";
      let templateType: "admit_card" | "result" | "answer_key" | "recruitment" = "recruitment";
      
      if (categoryLower.includes("admit") || titleLower.includes("admit") || categoryLower.includes("city") || titleLower.includes("city") || categoryLower.includes("hall") || categoryLower.includes("call") || categoryLower.includes("syllabus")) {
        templateType = "admit_card";
        tagCategory = "#AdmitCard";
      } else if (categoryLower.includes("result") || titleLower.includes("result") || categoryLower.includes("cutoff") || titleLower.includes("cutoff") || categoryLower.includes("scorecard") || categoryLower.includes("merit")) {
        templateType = "result";
        tagCategory = "#Result";
      } else if (categoryLower.includes("answer") || titleLower.includes("answer") || categoryLower.includes("key") || titleLower.includes("key") || categoryLower.includes("sheet")) {
        templateType = "answer_key";
        tagCategory = "#AnswerKey";
      }

      const hashtags = [tagCategory];
      if (templateType === "result" || templateType === "recruitment") {
        hashtags.push("#GovernmentJobs");
      } else {
        hashtags.push("#ExamUpdate");
      }
      
      if (titleLower.includes("ssc")) hashtags.unshift("#SSC");
      else if (titleLower.includes("upsc")) hashtags.unshift("#UPSC");
      else if (titleLower.includes("rrb") || titleLower.includes("railway")) hashtags.unshift("#Railway");
      else if (titleLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
      else if (titleLower.includes("police")) hashtags.unshift("#Police");
      else if (titleLower.includes("defence")) hashtags.unshift("#Defence");
      else if (titleLower.includes("teacher") || titleLower.includes("teaching")) hashtags.unshift("#TeachingJobs");
      else if (titleLower.includes("court") || titleLower.includes("judic")) hashtags.unshift("#Judiciary");
      else if (titleLower.includes("steno")) hashtags.unshift("#Stenographer");
      const hashtagsStr = hashtags.join(" ");

      if (templateType === "admit_card") {
        const statusText = update.status || (titleLower.includes("city") ? "Exam City Slip Released" : "Admit Card Released");
        const examDate = (() => {
          if (update.important_dates && Array.isArray(update.important_dates)) {
            const match = update.important_dates.find(d => 
              /exam|test|written|cbt|date/i.test(d.event) && !/admit|result|apply|registration/i.test(d.event)
            );
            if (match) return match.date;
          }
          return "Check Details";
        })();

        return `${prefix}IMPORTANT UPDATE

📌 ${update.title}

📍 ${statusText}
📅 Exam Date: ${examDate}

✅ Download Now

🔗 View Details:
${updateLink}

${hashtagsStr}`;
      } else if (templateType === "result") {
        return `${prefix}IMPORTANT UPDATE

📌 ${update.title}

📢 Result Released Successfully

✅ Check Your Result

🔗 View Result:
${updateLink}

${hashtagsStr}`;
      } else if (templateType === "answer_key") {
        return `${prefix}IMPORTANT UPDATE

📌 ${update.title}

📢 Official Answer Key Available

✅ Check Response Sheet & Answer Key

🔗 View Details:
${updateLink}

${hashtagsStr}`;
      } else {
        const orgText = (() => {
          if (titleLower.includes("ssc")) return "SSC";
          if (titleLower.includes("upsc")) return "UPSC";
          if (titleLower.includes("rrb") || titleLower.includes("railway")) return "RRB / Railways";
          if (titleLower.includes("sbi")) return "SBI";
          if (titleLower.includes("ibps")) return "IBPS";
          const match = update.title.match(/^(.*?)\s+(recruitment|exam|vacancy|admit|result)/i);
          if (match && match[1]) return match[1].trim();
          return "Government Agency";
        })();

        return `${prefix}IMPORTANT UPDATE

📌 ${update.title}

🏢 Organization: ${orgText}
📢 Notification Details Available

✅ View Notification & Apply

🔗 View Details:
${updateLink}

${hashtagsStr}`;
      }
    }
  };

  const handlePostToFacebook = async () => {
    const page = facebookPages.find(p => p.id === selectedFacebookPageId);
    if (!page) {
      toast({ title: "Error", description: "Please select/configure a Facebook Page", variant: "destructive" });
      return;
    }

    const idsToPost = facebookSourceType === "jobs" ? selectedFacebookJobIds : selectedFacebookUpdateIds;
    if (idsToPost.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to post", variant: "destructive" });
      return;
    }

    setPostingToFacebook(true);
    setFacebookConsoleLogs([
      `[${format(new Date(), "HH:mm:ss")}] 🚀 Starting dispatch to Facebook page: "${page.name}"`,
      `[${format(new Date(), "HH:mm:ss")}] 📋 Found ${idsToPost.length} selected item(s) to process`
    ]);

    try {
      // Fetch already sent items to prevent duplicate posts
      let sentIds = new Set<string>();
      try {
        const { data: sentItems } = await supabase
          .from("facebook_sent_jobs")
          .select("job_id, update_id")
          .eq("page_id", page.id)
          .eq("status", "success");

        if (sentItems) {
          sentItems.forEach(item => {
            const sentId = facebookSourceType === "jobs" ? item.job_id : item.update_id;
            if (sentId) sentIds.add(sentId);
          });
        }
      } catch (err) {
        console.error("Failed to check duplicate postings", err);
      }

      let successCount = 0;

      for (let i = 0; i < idsToPost.length; i++) {
        const id = idsToPost[i];
        let messageText = "";
        let itemTitle = "";

        if (facebookSourceType === "jobs") {
          const job = jobs?.find(j => j.id === id);
          if (!job) continue;
          itemTitle = job.title;
          const jobLink = `${getWebappBaseUrl()}/jobs/${job.slug || job.id}`;
          
          // Dynamic hashtags
          const hashtags = ["#GovernmentJobs", "#SarkariNaukri"];
          const titleLower = job.title.toLowerCase();
          const deptLower = job.department.toLowerCase();
          if (titleLower.includes("ssc") || deptLower.includes("ssc")) hashtags.unshift("#SSC");
          else if (titleLower.includes("upsc") || deptLower.includes("upsc")) hashtags.unshift("#UPSC");
          else if (titleLower.includes("rrb") || titleLower.includes("railway") || deptLower.includes("railway")) hashtags.unshift("#Railway");
          else if (titleLower.includes("bank") || deptLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
          else if (titleLower.includes("police") || deptLower.includes("police")) hashtags.unshift("#Police");
          else if (titleLower.includes("defence") || titleLower.includes("army") || titleLower.includes("navy") || titleLower.includes("air force")) hashtags.unshift("#Defence");
          else if (titleLower.includes("teacher") || titleLower.includes("teaching")) hashtags.unshift("#TeachingJobs");
          else if (titleLower.includes("court") || titleLower.includes("judic")) hashtags.unshift("#Judiciary");
          else if (titleLower.includes("steno")) hashtags.unshift("#Stenographer");
          const hashtagsStr = hashtags.join(" ");

          messageText = `NEW RECRUITMENT ALERT

📌 ${job.title}

🏢 Organization: ${job.department}
👥 Vacancies: ${job.vacancies_display || job.vacancies || "TBD"}
📅 Last Date: ${(() => {
            const d = getJobDeadlineDate(job);
            return d ? format(d, "dd MMM yyyy") : job.last_date_display || job.last_date;
          })()}

✅ Apply Online

🔗 View Full Notification:
${jobLink}

${hashtagsStr}`;
        } else {
          const update = facebookExamUpdates?.find(u => u.id === id);
          if (!update) continue;
          itemTitle = update.title;
          const updateLink = `${getWebappBaseUrl()}/updates/${update.update_slug || update.id}`;
          
          const categoryLower = update.category.toLowerCase();
          const titleLower = update.title.toLowerCase();

          // Determine template type and dynamic hashtags
          let tagCategory = "#ExamUpdate";
          let templateType: "admit_card" | "result" | "answer_key" | "recruitment" = "recruitment";
          
          if (categoryLower.includes("admit") || titleLower.includes("admit") || categoryLower.includes("city") || titleLower.includes("city") || categoryLower.includes("hall") || categoryLower.includes("call") || categoryLower.includes("syllabus")) {
            templateType = "admit_card";
            tagCategory = "#AdmitCard";
          } else if (categoryLower.includes("result") || titleLower.includes("result") || categoryLower.includes("cutoff") || titleLower.includes("cutoff") || categoryLower.includes("scorecard") || categoryLower.includes("merit")) {
            templateType = "result";
            tagCategory = "#Result";
          } else if (categoryLower.includes("answer") || titleLower.includes("answer") || categoryLower.includes("key") || titleLower.includes("key") || categoryLower.includes("sheet")) {
            templateType = "answer_key";
            tagCategory = "#AnswerKey";
          }

          const hashtags = [tagCategory];
          if (templateType === "result" || templateType === "recruitment") {
            hashtags.push("#GovernmentJobs");
          } else {
            hashtags.push("#ExamUpdate");
          }
          
          if (titleLower.includes("ssc")) hashtags.unshift("#SSC");
          else if (titleLower.includes("upsc")) hashtags.unshift("#UPSC");
          else if (titleLower.includes("rrb") || titleLower.includes("railway")) hashtags.unshift("#Railway");
          else if (titleLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
          else if (titleLower.includes("police")) hashtags.unshift("#Police");
          else if (titleLower.includes("defence")) hashtags.unshift("#Defence");
          else if (titleLower.includes("teacher") || titleLower.includes("teaching")) hashtags.unshift("#TeachingJobs");
          else if (titleLower.includes("court") || titleLower.includes("judic")) hashtags.unshift("#Judiciary");
          else if (titleLower.includes("steno")) hashtags.unshift("#Stenographer");
          const hashtagsStr = hashtags.join(" ");

          if (templateType === "admit_card") {
            const statusText = update.status || (titleLower.includes("city") ? "Exam City Slip Released" : "Admit Card Released");
            const examDate = (() => {
              if (update.important_dates && Array.isArray(update.important_dates)) {
                const match = update.important_dates.find(d => 
                  /exam|test|written|cbt|date/i.test(d.event) && !/admit|result|apply|registration/i.test(d.event)
                );
                if (match) return match.date;
              }
              return "Check Details";
            })();

            messageText = `IMPORTANT UPDATE

📌 ${update.title}

📍 ${statusText}
📅 Exam Date: ${examDate}

✅ Download Now

🔗 View Details:
${updateLink}

${hashtagsStr}`;
          } else if (templateType === "result") {
            messageText = `IMPORTANT UPDATE

📌 ${update.title}

📢 Result Released Successfully

✅ Check Your Result

🔗 View Result:
${updateLink}

${hashtagsStr}`;
          } else if (templateType === "answer_key") {
            messageText = `IMPORTANT UPDATE

📌 ${update.title}

📢 Official Answer Key Available

✅ Check Response Sheet & Answer Key

🔗 View Details:
${updateLink}

${hashtagsStr}`;
          } else {
            // Fallback recruitment alert
            const orgText = (() => {
              if (titleLower.includes("ssc")) return "SSC";
              if (titleLower.includes("upsc")) return "UPSC";
              if (titleLower.includes("rrb") || titleLower.includes("railway")) return "RRB / Railways";
              if (titleLower.includes("sbi")) return "SBI";
              if (titleLower.includes("ibps")) return "IBPS";
              const match = update.title.match(/^(.*?)\s+(recruitment|exam|vacancy|admit|result)/i);
              if (match && match[1]) return match[1].trim();
              return "Government Agency";
            })();

            messageText = `IMPORTANT UPDATE

📌 ${update.title}

🏢 Organization: ${orgText}
📢 Notification Details Available

✅ View Notification & Apply

🔗 View Details:
${updateLink}

${hashtagsStr}`;
          }
        }

        setFacebookConsoleLogs(prev => [
          ...prev,
          `[${format(new Date(), "HH:mm:ss")}] Preparing message for: "${itemTitle}"`
        ]);

        // Prevent duplicate sending
        if (sentIds.has(id)) {
          setFacebookConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] ⚠️ Skipped duplicate: "${itemTitle}" already successfully posted to this page.`
          ]);
          successCount++;
          continue;
        }

        const response = await fetch(`https://graph.facebook.com/v19.0/${page.page_id}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            access_token: page.access_token
          })
        });

        const data = await response.json();
        if (response.ok && data.id) {
          successCount++;
          setFacebookConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] ✅ Successfully posted to Facebook Page! Post ID: ${data.id} (${successCount}/${idsToPost.length})`
          ]);

          // Log success to DB
          await supabase.from("facebook_sent_jobs").insert({
            page_id: page.id,
            [facebookSourceType === "jobs" ? "job_id" : "update_id"]: id,
            status: "success"
          });
        } else {
          const errMsg = data?.error?.message || "Unknown error";
          console.error(`Facebook post error for ID ${id}:`, errMsg);
          setFacebookConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] ❌ Error posting "${itemTitle}": ${errMsg}`
          ]);

          // Log failure to DB
          await supabase.from("facebook_sent_jobs").insert({
            page_id: page.id,
            [facebookSourceType === "jobs" ? "job_id" : "update_id"]: id,
            status: "failed",
            error_message: errMsg
          });
        }

        // Add a 1000ms delay between posts to prevent rate limits
        if (i < idsToPost.length - 1) {
          setFacebookConsoleLogs(prev => [
            ...prev,
            `[${format(new Date(), "HH:mm:ss")}] 🕒 Delaying 1.0s to respect Facebook API rate limits...`
          ]);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Refresh logs history
      fetchFacebookLogs();

      if (successCount === idsToPost.length) {
        setFacebookConsoleLogs(prev => [
          ...prev,
          `[${format(new Date(), "HH:mm:ss")}] 🎉 Completed broadcasting. All ${successCount} messages posted successfully!`
        ]);
        toast({ title: "Success", description: `Posted ${successCount} notification(s) to Facebook Page successfully!` });
        // Clear selection
        if (facebookSourceType === "jobs") {
          setSelectedFacebookJobIds([]);
        } else {
          setSelectedFacebookUpdateIds([]);
        }
      } else {
        const failedCount = idsToPost.length - successCount;
        setFacebookConsoleLogs(prev => [
          ...prev,
          `[${format(new Date(), "HH:mm:ss")}] ⚠️ Completed with errors. ${successCount} posted, ${failedCount} failed.`
        ]);
        toast({
          title: "Partial Success",
          description: `Successfully posted ${successCount} items. ${failedCount} items failed to post.`,
          variant: "destructive"
        });
      }
    } catch (e: any) {
      console.error("Facebook post system exception:", e);
      setFacebookConsoleLogs(prev => [
        ...prev,
        `[${format(new Date(), "HH:mm:ss")}] 🚨 System Exception: ${e.message || "Failed to communicate with Facebook Graph API"}`
      ]);
      toast({ title: "Error", description: e.message || "Failed to send message to Facebook", variant: "destructive" });
    } finally {
      setPostingToFacebook(false);
    }
  };

  // Get all unique years of expired jobs dynamically
  const expiredYears = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    const years = new Set<number>();
    jobs.forEach(job => {
      const lastDate = getJobDeadlineDate(job);
      if (lastDate && lastDate < new Date()) {
        years.add(lastDate.getFullYear());
      } else if (!lastDate) {
        // fallback to created_at
        years.add(new Date(job.created_at).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [jobs]);
  const [expiredPage, setExpiredPage] = useState<number>(1);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);

  const handleExpiredSort = (field: "last_date" | "vacancies" | "created_at") => {
    if (expiredSortField === field) {
      setExpiredSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setExpiredSortField(field);
      setExpiredSortDirection("desc");
    }
    setExpiredPage(1); // Reset to page 1 when sort changes
  };

  const getExpiredSortIcon = (field: "last_date" | "vacancies" | "created_at") => {
    if (expiredSortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    if (expiredSortDirection === "asc") return <ArrowUp className="h-4 w-4 ml-1" />;
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const toggleSelectExpiredJob = (jobId: string) => {
    setSelectedExpiredJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleSelectAllExpiredOnPage = (currentVisibleJobs: Job[]) => {
    const visibleIds = currentVisibleJobs.map(job => job.id);
    const allSelected = visibleIds.every(id => selectedExpiredJobs.has(id));

    setSelectedExpiredJobs(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDeleteExpiredJobs = async () => {
    if (selectedExpiredJobs.size === 0) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .in("id", Array.from(selectedExpiredJobs));

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedExpiredJobs.size} expired jobs deleted successfully`,
      });
      setSelectedExpiredJobs(new Set());
      setExpiredPage(1);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      toast({
        title: "Error deleting jobs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  // Filter and sort expired jobs
  const expiredJobs = jobs?.filter((job) => {
    // Must be expired
    const lastDate = getJobDeadlineDate(job);
    if (!lastDate || lastDate >= new Date()) return false;

    // Year filter
    if (expiredYearFilter !== "all") {
      const jobYear = lastDate ? lastDate.getFullYear().toString() : new Date(job.created_at).getFullYear().toString();
      if (jobYear !== expiredYearFilter) return false;
    }

    // Search query filter
    if (expiredSearchQuery.trim() !== "") {
      const q = expiredSearchQuery.toLowerCase();
      const titleMatch = job.title?.toLowerCase().includes(q);
      const deptMatch = job.department?.toLowerCase().includes(q);
      if (!titleMatch && !deptMatch) return false;
    }

    return true;
  }).sort((a, b) => {
    if (!expiredSortField) return 0;

    if (expiredSortField === "vacancies_and_date") {
      const vacA = a.vacancies === null || a.vacancies === undefined ? Infinity : a.vacancies;
      const vacB = b.vacancies === null || b.vacancies === undefined ? Infinity : b.vacancies;
      if (vacA !== vacB) {
        return vacA - vacB;
      }
      const dateA = getJobDeadlineDate(a)?.getTime() ?? 0;
      const dateB = getJobDeadlineDate(b)?.getTime() ?? 0;
      return dateA - dateB;
    }

    if (expiredSortField === "last_date") {
      const dateA = getJobDeadlineDate(a)?.getTime() ?? 0;
      const dateB = getJobDeadlineDate(b)?.getTime() ?? 0;
      return expiredSortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (expiredSortField === "vacancies") {
      const vacA = a.vacancies || 0;
      const vacB = b.vacancies || 0;
      return expiredSortDirection === "asc" ? vacA - vacB : vacB - vacA;
    }

    if (expiredSortField === "created_at") {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return expiredSortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }

    return 0;
  }) || [];

  const expiredItemsPerPage = 50;
  const totalExpiredPages = Math.ceil(expiredJobs.length / expiredItemsPerPage);
  const effectiveExpiredPage = Math.max(1, Math.min(expiredPage, totalExpiredPages || 1));
  const paginatedExpiredJobs = expiredJobs.slice(
    (effectiveExpiredPage - 1) * expiredItemsPerPage,
    effectiveExpiredPage * expiredItemsPerPage
  );

  // Filter and sort jobs
  const filteredJobs = jobs?.filter((job) => {
    // Last date filter
    if (lastDateFilter !== "all") {
      const today = new Date();
      const lastDate = getJobDeadlineDate(job);
      if (!lastDate) return lastDateFilter === "active"; // unparseable → treat as active

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

    // Search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const titleMatch = job.title?.toLowerCase().includes(q);
      const deptMatch = job.department?.toLowerCase().includes(q);
      if (!titleMatch && !deptMatch) return false;
    }

    return true;
  }).sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === "last_date") {
      const dateA = getJobDeadlineDate(a)?.getTime() ?? 0;
      const dateB = getJobDeadlineDate(b)?.getTime() ?? 0;
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
      const payload = {
        ...formData,
        job_metadata: buildEligibilityAwareMetadata(
          formData.title,
          formData.qualification,
          formData.eligibility,
          editingJob?.job_metadata ?? null,
        ),
      };

      if (editingJob) {
        const { error } = await supabase.from("jobs").update(payload).eq("id", editingJob.id);
        if (error) throw error;
        toast({ title: "Job updated successfully!" });
      } else {
        // Insert
        const { data: newJob, error } = await supabase
          .from("jobs")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast({ title: "Job created!" });
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

  const handleDiscoverSaveJob = async (url: string): Promise<boolean> => {
    const r = discoverScrapedResults[url];
    if (!r) return false;
    setDiscoverSavingUrl(url);

    try {
      const metadata = buildEligibilityAwareMetadata(r.exam_name || "Untitled Job", r.eligibility || "As per notification", r.eligibility || null);
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
      const lastDateDisplay = r.last_date || null;

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
        application_start_date: r.important_dates?.apply_start ? parseDateValue(r.important_dates.apply_start) : null,
        last_date: lastDate,
        last_date_display: lastDateDisplay,
        apply_link: r.official_apply_link || null,
        official_website: r.official_website || null,
        is_featured: false,
        job_metadata: Object.keys(metadata).length > 0 ? metadata : null,
      };

      // Check for duplicates locally first using checkJobSimilarity
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
          description: `Similar to: "${duplicateJobTitle}". Save blocked.`,
          variant: "destructive",
        });
        setDiscoverSavedUrls(prev => new Set(prev).add(url));
        setDiscoverSavingUrl(null);
        return false;
      }

      // Check for duplicate by title before inserting
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("id, title")
        .ilike("title", jobRecord.title)
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        toast({
          title: "Duplicate detected!",
          description: `"${existingJobs[0].title}" already exists in the database. Skipped.`,
          variant: "destructive",
        });
        setDiscoverSavedUrls(prev => new Set(prev).add(url));
        setDiscoverSavingUrl(null);
        return false;
      }

      const { data: newJob, error } = await supabase.from("jobs").insert(sanitizeJobRecord(jobRecord)).select("id").single();
      if (error) throw error;

      setDiscoverSavedUrls(prev => new Set(prev).add(url));
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Saved!", description: `${jobRecord.title} added to database.` });
      return true;
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setDiscoverSavingUrl(null);
    }
  };

  const handleBackfillEligibilityProfiles = async () => {
    if (!Array.isArray(jobs) || jobs.length === 0) {
      toast({ title: "No jobs found", description: "There are no jobs available to backfill." });
      return;
    }

    setBackfillingEligibility(true);
    let updatedCount = 0;

    try {
      for (const job of jobs) {
        const nextProfile = parseEligibilityProfileFromText(job.qualification, job.eligibility, job.title);
        const currentProfile = job.job_metadata?.eligibility_profile;

        if (currentProfile?.version === nextProfile.version && currentProfile.raw_text === nextProfile.raw_text) {
          continue;
        }

        const nextMetadata: JobMetadata = {
          ...(job.job_metadata || {}),
          eligibility_profile: nextProfile,
        };

        const { error } = await supabase
          .from("jobs")
          .update({ job_metadata: nextMetadata })
          .eq("id", job.id);

        if (error) throw error;
        updatedCount += 1;
      }

      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: "Eligibility profiles backfilled",
        description: updatedCount > 0 ? `${updatedCount} job${updatedCount === 1 ? "" : "s"} updated.` : "All jobs were already up to date.",
      });
    } catch (error: any) {
      toast({ title: "Backfill failed", description: error.message, variant: "destructive" });
    } finally {
      setBackfillingEligibility(false);
    }
  };

  // Scraper V5: add scraped job to the database
  const handleAddScrapedJob = async () => {
    if (!scraperResult) return;
    setScraperAddingJob(true);

    try {
      const r = scraperResult;

      // Build job_metadata with all the extra fields
      const metadata = buildEligibilityAwareMetadata(r.exam_name || "Untitled Job", r.eligibility || "As per notification", r.eligibility || null);
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
      const lastDateDisplay = r.last_date || null;

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
        application_start_date: r.important_dates?.apply_start ? parseDateValue(r.important_dates.apply_start) : null,
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
          description: `Similar to: "${duplicateJobTitle}". Save blocked.`,
          variant: "destructive",
        });
        setScraperAddingJob(false);
        return;
      }

      // Also check directly in the database by title
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("id, title")
        .ilike("title", jobRecord.title)
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        toast({
          title: "Duplicate detected!",
          description: `"${existingJobs[0].title}" already exists in the database. Save blocked.`,
          variant: "destructive",
        });
        setScraperAddingJob(false);
        return;
      }

      const { data: newJob, error } = await supabase
        .from("jobs")
        .insert(jobRecord)
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Job added successfully!",
        description: `${jobRecord.title}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["jobs"] });

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
        for (const job of cleanNewJobs) {
          const { data, error } = await supabase
            .from("jobs")
            .insert(sanitizeJobRecord(job))
            .select("id")
            .single();
          if (error) throw error;
          if (data) {
            newJobIds.push(data.id);
          }
          insertedCount++;
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Update existing job records (keep ID)
      if (duplicateMode === "update" && duplicateJobs.length > 0) {
        for (const dupJob of duplicateJobs) {
          const { isDuplicate, duplicateOf, matchType, similarityScore, ...jobData } = dupJob;
          if (duplicateOf) {
            const { error } = await supabase.from("jobs").update(sanitizeJobRecord(jobData)).eq("id", duplicateOf);
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
              .insert(sanitizeJobRecord(jobData))
              .select("id")
              .single();
            if (error) throw error;
            replacedCount++;

            // Collect ID for auto-verification
            if (replacedJob?.id) {
              newJobIds.push(replacedJob.id);
            }
            await new Promise(r => setTimeout(r, 500));
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

      // Show toast
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
            <TabsList className="!flex !flex-wrap gap-1 p-1 !h-auto w-full">
              <TabsTrigger value="jobs" className="gap-1 min-w-[44px] h-10">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Jobs</span>
              </TabsTrigger>
              <TabsTrigger value="expired" className="gap-1 min-w-[44px] h-10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="hidden sm:inline">Expired Jobs</span>
              </TabsTrigger>
              <TabsTrigger value="telegram" className="gap-1 min-w-[44px] h-10">
                <Send className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Telegram</span>
              </TabsTrigger>
              <TabsTrigger value="facebook" className="gap-1 min-w-[44px] h-10">
                <Facebook className="h-4 w-4 text-blue-600" />
                <span className="hidden sm:inline">Facebook</span>
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
              <TabsTrigger value="updates" className="gap-1 min-w-[44px] h-10">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Updates</span>
              </TabsTrigger>
              {isFullAdmin && (
                <TabsTrigger value="ai-keys" className="gap-1 min-w-[44px] h-10">
                  <Key className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Keys</span>
                </TabsTrigger>
              )}
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
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={handleBackfillEligibilityProfiles}
                      disabled={jobsLoading || backfillingEligibility}
                    >
                      {backfillingEligibility ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Backfill Eligibility
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={handleCheckVacancies}
                      disabled={jobsLoading || updatingVacancies}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Check Vacancies
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditingJob(null); setFormData(emptyFormData); setShowAddDialog(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Job
                    </Button>
                  </div>
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

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search jobs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-[200px] h-9"
                    />
                  </div>

                  {(searchQuery !== "" || lastDateFilter !== "all" || vacanciesFilter !== "all" || applyLinkFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSearchQuery(""); setLastDateFilter("all"); setVacanciesFilter("all"); setApplyLinkFilter("all"); }}
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
                                <span className={(() => { const d = getJobDeadlineDate(job); return d && d < new Date() ? "text-destructive" : ""; })()}>
                                  {(() => { const d = getJobDeadlineDate(job); return d ? format(d, "dd MMM yyyy") : job.last_date_display || job.last_date; })()}
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

          {/* Expired Jobs Tab */}
          <TabsContent value="expired">
            <Card className="border-0 shadow-card">
              <CardHeader className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Expired Jobs ({expiredJobs.length})</CardTitle>
                    <CardDescription>Manage and bulk-delete expired job listings</CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row items-center">
                    {selectedExpiredJobs.size > 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full sm:w-auto gap-2 animate-fade-in"
                        onClick={() => setShowBulkDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected ({selectedExpiredJobs.size})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative w-full sm:w-[300px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search expired jobs..."
                      value={expiredSearchQuery}
                      onChange={(e) => {
                        setExpiredSearchQuery(e.target.value);
                        setExpiredPage(1);
                      }}
                      className="pl-8 h-9 w-full"
                    />
                  </div>

                  <Select value={expiredYearFilter} onValueChange={(val) => { setExpiredYearFilter(val); setExpiredPage(1); }}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {expiredYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(expiredSearchQuery !== "" || expiredYearFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExpiredSearchQuery("");
                        setExpiredYearFilter("all");
                        setExpiredPage(1);
                      }}
                      className="text-muted-foreground"
                    >
                      Clear filters
                    </Button>
                  )}

                  <Button
                    variant={expiredSortField === "vacancies_and_date" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (expiredSortField === "vacancies_and_date") {
                        setExpiredSortField("last_date");
                        setExpiredSortDirection("desc");
                      } else {
                        setExpiredSortField("vacancies_and_date");
                        setExpiredSortDirection("asc");
                      }
                      setExpiredPage(1);
                    }}
                    className="h-9 gap-1"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Sort by Min Vacancies & Oldest Date
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[550px] w-full">
                    <div className="min-w-[800px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px] text-center">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                checked={
                                  paginatedExpiredJobs.length > 0 &&
                                  paginatedExpiredJobs.every((job) => selectedExpiredJobs.has(job.id))
                                }
                                onChange={() => handleSelectAllExpiredOnPage(paginatedExpiredJobs)}
                              />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleExpiredSort("vacancies")}
                            >
                              <div className="flex items-center">
                                Vacancies
                                {getExpiredSortIcon("vacancies")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleExpiredSort("last_date")}
                            >
                              <div className="flex items-center">
                                Last Date
                                {getExpiredSortIcon("last_date")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleExpiredSort("created_at")}
                            >
                              <div className="flex items-center">
                                Uploaded
                                {getExpiredSortIcon("created_at")}
                              </div>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedExpiredJobs.map((job) => (
                            <TableRow key={job.id} className={selectedExpiredJobs.has(job.id) ? "bg-muted/40" : ""}>
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                  checked={selectedExpiredJobs.has(job.id)}
                                  onChange={() => toggleSelectExpiredJob(job.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium max-w-[250px] truncate">{job.title}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{job.department}</TableCell>
                              <TableCell>{job.vacancies_display || job.vacancies || "TBD"}</TableCell>
                              <TableCell>
                                <span className="text-destructive font-medium">
                                  {(() => {
                                    const d = getJobDeadlineDate(job);
                                    return d ? format(d, "dd MMM yyyy") : job.last_date_display || job.last_date;
                                  })()}
                                </span>
                              </TableCell>
                              <TableCell>
                                {format(new Date(job.created_at), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(job)} title="Edit Job">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteJob(job.id)} title="Delete Job">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {expiredJobs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No expired jobs found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}

                {/* Pagination Footer */}
                {totalExpiredPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-4 sm:px-6">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={effectiveExpiredPage === 1}
                        onClick={() => setExpiredPage(prev => Math.max(1, prev - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={effectiveExpiredPage === totalExpiredPages}
                        onClick={() => setExpiredPage(prev => Math.min(totalExpiredPages, prev + 1))}
                      >
                        Next
                      </Button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Showing <span className="font-medium">{((effectiveExpiredPage - 1) * expiredItemsPerPage) + 1}</span> to{" "}
                          <span className="font-medium">
                            {Math.min(effectiveExpiredPage * expiredItemsPerPage, expiredJobs.length)}
                          </span>{" "}
                          of <span className="font-medium">{expiredJobs.length}</span> expired jobs
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-l-md"
                            disabled={effectiveExpiredPage === 1}
                            onClick={() => setExpiredPage(prev => Math.max(1, prev - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {Array.from({ length: totalExpiredPages }, (_, i) => i + 1)
                            .filter((p) => {
                              return (
                                p === 1 ||
                                p === totalExpiredPages ||
                                Math.abs(p - effectiveExpiredPage) <= 1
                              );
                            })
                            .map((p, index, arr) => {
                              const showEllipsisBefore = index > 0 && p - arr[index - 1] > 1;
                              return (
                                <div key={p} className="flex items-center">
                                  {showEllipsisBefore && (
                                    <span className="inline-flex items-center px-4 py-2 text-sm font-semibold text-muted-foreground">
                                      ...
                                    </span>
                                  )}
                                  <Button
                                    variant={effectiveExpiredPage === p ? "default" : "outline"}
                                    className="h-10 w-10 p-0"
                                    onClick={() => setExpiredPage(p)}
                                  >
                                    {p}
                                  </Button>
                                </div>
                              );
                            })}
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-r-md"
                            disabled={effectiveExpiredPage === totalExpiredPages}
                            onClick={() => setExpiredPage(prev => Math.min(totalExpiredPages, prev + 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Telegram Posting Tab */}
          {/* Telegram Posting Tab */}
          <TabsContent value="telegram">
            <Tabs defaultValue="poster" className="space-y-4">
              <TabsList className="flex flex-col sm:grid w-full max-w-full sm:max-w-[600px] sm:grid-cols-3 h-auto sm:h-10 gap-1 sm:gap-0">
                <TabsTrigger value="poster">Manual Poster</TabsTrigger>
                <TabsTrigger value="history" onClick={fetchTelegramLogs}>Posting History & Status</TabsTrigger>
                <TabsTrigger value="controls" onClick={fetchQueueStats}>Queue & Diagnostics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="poster" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Channels Configuration */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card>
                      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="text-lg">Telegram Channels</CardTitle>
                          <CardDescription>Configure bot credentials per sector</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowTelegramAddChannelDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {telegramChannels.length === 0 ? (
                          <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                            No Telegram channels configured yet. Click 'Add' to configure one.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {telegramChannels.map((channel) => (
                              <div
                                key={channel.id}
                                className={`p-2 border rounded-lg hover:border-primary/50 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                  selectedTelegramChannelId === channel.id ? "border-primary bg-primary/5" : "bg-card"
                                }`}
                                onClick={() => setSelectedTelegramChannelId(channel.id)}
                              >
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  <h4 className="font-semibold text-xs truncate" title={channel.name}>{channel.name}</h4>
                                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 flex-shrink-0">
                                    {channel.sector}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[80px]" title={`Chat ID: ${channel.channel_id}`}>
                                    {channel.channel_id}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTelegramChannel(channel.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Middle Column: Jobs/Updates Selector */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card className="h-full flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Publish Selection</CardTitle>
                        <CardDescription>Select job or update to broadcast</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
                        {/* Search Tag Filter Row */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Tag</Label>
                          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1 pb-1">
                            {[
                              "All Jobs", "SSC", "Railway Jobs", "Banking Jobs", "UPSC", 
                              "Defence Jobs", "PSU", "State PSC", "Healthcare", "Teaching", 
                              "Judiciary", "Stenographer"
                            ].map((tag) => {
                              const isActive = selectedTelegramTag === tag;
                              return (
                                <Badge
                                  key={tag}
                                  variant={isActive ? "default" : "outline"}
                                  className={`cursor-pointer transition-all duration-200 py-1 px-2.5 rounded-full select-none text-[11px] font-medium ${
                                    isActive
                                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                                      : "bg-background hover:bg-secondary/80 hover:text-foreground text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/60"
                                  }`}
                                  onClick={() => handleTelegramTagSelect(tag)}
                                >
                                  {tag}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="telegram-sector">Select Sector/Search Term</Label>
                          <div className="space-y-1.5">
                            <Input
                              placeholder="Type to filter sectors..."
                              value={sectorSearchQuery}
                              onChange={(e) => setSectorSearchQuery(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <Select value={selectedTelegramSector} onValueChange={(val) => {
                              setSelectedTelegramSector(val);
                              setSelectedTelegramTag("All Jobs");
                              setSelectedTelegramJobIds([]);
                              setSelectedTelegramUpdateIds([]);
                              const matched = telegramChannels.find(c => c.sector.toLowerCase() === val.toLowerCase());
                              if (matched) setSelectedTelegramChannelId(matched.id);
                            }}>
                              <SelectTrigger id="telegram-sector">
                                <SelectValue placeholder="Sector" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {filteredTelegramTiers.length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground text-xs">No matching sectors</div>
                                ) : (
                                  filteredTelegramTiers.map((tier) => (
                                    <SelectGroup key={tier.name}>
                                      <SelectLabel className="font-bold text-primary text-xs bg-muted/40 px-2 py-1 sticky top-0 z-10">{tier.name}</SelectLabel>
                                      {tier.terms.map((term) => (
                                        <SelectItem key={term} value={term}>{term}</SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Content Type</Label>
                          <RadioGroup
                            defaultValue="jobs"
                            value={telegramSourceType}
                            onValueChange={(val: "jobs" | "updates") => {
                              setTelegramSourceType(val);
                              setSelectedTelegramJobIds([]);
                              setSelectedTelegramUpdateIds([]);
                            }}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="jobs" id="tele-jobs" />
                              <Label htmlFor="tele-jobs" className="cursor-pointer">Active Jobs</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="updates" id="tele-updates" />
                              <Label htmlFor="tele-updates" className="cursor-pointer">Job Updates</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-2">
                            <Label>
                              {telegramSourceType === "jobs" ? "Available Active Jobs" : "Available Updates"}
                            </Label>
                            {(telegramSourceType === "jobs" ? activeJobsForTelegram.length > 0 : (!telegramUpdatesLoading && telegramExamUpdates && telegramExamUpdates.length > 0)) && (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id="select-all-telegram"
                                  checked={
                                    telegramSourceType === "jobs"
                                      ? activeJobsForTelegram.length > 0 && activeJobsForTelegram.every(j => selectedTelegramJobIds.includes(j.id))
                                      : !!(telegramExamUpdates && telegramExamUpdates.length > 0 && telegramExamUpdates.every(u => selectedTelegramUpdateIds.includes(u.id)))
                                  }
                                  onCheckedChange={(checked) => {
                                    if (telegramSourceType === "jobs") {
                                      if (checked) {
                                        setSelectedTelegramJobIds(activeJobsForTelegram.map(j => j.id));
                                      } else {
                                        setSelectedTelegramJobIds([]);
                                      }
                                    } else {
                                      if (checked && telegramExamUpdates) {
                                        setSelectedTelegramUpdateIds(telegramExamUpdates.map(u => u.id));
                                      } else {
                                        setSelectedTelegramUpdateIds([]);
                                      }
                                    }
                                  }}
                                />
                                <Label htmlFor="select-all-telegram" className="text-xs cursor-pointer font-normal text-muted-foreground select-none">
                                  Select All ({telegramSourceType === "jobs" ? activeJobsForTelegram.length : telegramExamUpdates?.length || 0})
                                </Label>
                              </div>
                            )}
                          </div>

                          {telegramSourceType === "jobs" && activeJobsForTelegram.length > 0 && (
                            <div className="flex items-center gap-2 mb-2 bg-muted/20 p-2 rounded border text-xs">
                              <span className="text-muted-foreground font-medium">Sort:</span>
                              <Select
                                value={telegramSortField || ""}
                                onValueChange={(val: any) => {
                                  setTelegramSortField(val);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
                                  <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="created_at">Date Added (Newest)</SelectItem>
                                  <SelectItem value="last_date">Deadline Date</SelectItem>
                                  <SelectItem value="vacancies">Vacancies (Highest)</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setTelegramSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                }}
                              >
                                {telegramSortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          )}
                          
                          <div className="flex-1 border rounded-md overflow-y-auto max-h-[350px]">
                            {telegramSourceType === "jobs" ? (
                              activeJobsForTelegram.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground text-sm">
                                  No active jobs in this sector.
                                </div>
                              ) : (
                                <div className="divide-y">
                                  {activeJobsForTelegram.map((job) => (
                                    <div
                                      key={job.id}
                                      className={`p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors flex items-start gap-2.5 ${
                                        selectedTelegramJobIds.includes(job.id) ? "bg-muted/60 font-medium" : ""
                                      }`}
                                      onClick={() => {
                                        setSelectedTelegramJobIds(prev =>
                                          prev.includes(job.id) ? prev.filter(id => id !== job.id) : [...prev, job.id]
                                        );
                                      }}
                                    >
                                      <Checkbox
                                        checked={selectedTelegramJobIds.includes(job.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={(checked) => {
                                          setSelectedTelegramJobIds(prev =>
                                            checked
                                              ? [...prev, job.id]
                                              : prev.filter(id => id !== job.id)
                                          );
                                        }}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm line-clamp-1">{job.title}</div>
                                        <div className="text-muted-foreground mt-1 line-clamp-1">{job.department}</div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                                          <span>Vacancies: {job.vacancies_display || job.vacancies || "TBD"}</span>
                                          <span>Last Date: {(() => {
                                            const d = getJobDeadlineDate(job);
                                            if (d) {
                                              const isCurrentYear = d.getFullYear() === new Date().getFullYear();
                                              return format(d, isCurrentYear ? "dd MMM" : "dd MMM yyyy");
                                            }
                                            return job.last_date_display || job.last_date;
                                          })()}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            ) : (
                              telegramUpdatesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                              ) : !telegramExamUpdates || telegramExamUpdates.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground text-sm">
                                  No updates found in this sector.
                                </div>
                              ) : (
                                <div className="divide-y">
                                  {telegramExamUpdates.map((update) => (
                                    <div
                                      key={update.id}
                                      className={`p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors flex items-start gap-2.5 ${
                                        selectedTelegramUpdateIds.includes(update.id) ? "bg-muted/60 font-medium" : ""
                                      }`}
                                      onClick={() => {
                                        setSelectedTelegramUpdateIds(prev =>
                                          prev.includes(update.id) ? prev.filter(id => id !== update.id) : [...prev, update.id]
                                        );
                                      }}
                                    >
                                      <Checkbox
                                        checked={selectedTelegramUpdateIds.includes(update.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={(checked) => {
                                          setSelectedTelegramUpdateIds(prev =>
                                            checked
                                              ? [...prev, update.id]
                                              : prev.filter(id => id !== update.id)
                                          );
                                        }}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm line-clamp-1">{update.title}</div>
                                        <div className="text-muted-foreground mt-1">Status: {update.status || "N/A"}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1.5">
                                          Published: {update.published_date || format(new Date(update.created_at), "dd MMM yyyy")}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Live Preview & Action */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card className="flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Message Live Preview</CardTitle>
                        <CardDescription>Verification before broadcasting</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="flex-1 bg-muted/30 border rounded-lg p-4 font-mono text-xs overflow-y-auto whitespace-pre-wrap max-h-[350px]">
                          {getTelegramPreviewMessage()}
                        </div>
                        <div className="space-y-3 border-t pt-4">
                          {selectedTelegramChannelId ? (
                            <div className="text-xs text-muted-foreground bg-primary/5 p-2.5 rounded border border-primary/20 flex flex-col gap-1">
                              <div>
                                <strong>Sending To:</strong> {telegramChannels.find(c => c.id === selectedTelegramChannelId)?.name}
                              </div>
                              <div>
                                <strong>Chat ID:</strong> {telegramChannels.find(c => c.id === selectedTelegramChannelId)?.channel_id}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-destructive bg-destructive/5 p-2.5 rounded border border-destructive/20">
                              Please select or configure a Telegram channel first.
                            </div>
                          )}
                          
                          <Button
                            className="w-full gap-2 h-11"
                            disabled={
                              postingToTelegram ||
                              !selectedTelegramChannelId ||
                              (telegramSourceType === "jobs" ? selectedTelegramJobIds.length === 0 : selectedTelegramUpdateIds.length === 0)
                            }
                            onClick={handlePostToTelegram}
                          >
                            {postingToTelegram ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Posting notification...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Publish to Telegram
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col">
                      <CardHeader className="pb-3 pt-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-primary" />
                          Execution Console
                        </CardTitle>
                        <CardDescription className="text-[10px]">Real-time Telegram posting logs</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4 pt-0">
                        <div className="bg-black/95 text-green-400 font-mono text-[10px] p-3 rounded border border-border/40 min-h-[120px] max-h-[180px] overflow-y-auto">
                          {telegramConsoleLogs.length === 0 ? (
                            <span className="text-muted-foreground italic">Idle. Console waiting for execution...</span>
                          ) : (
                            telegramConsoleLogs.map((log, index) => (
                              <div key={index} className="line-clamp-2 leading-relaxed">
                                {log}
                              </div>
                            ))
                          )}
                          <div ref={consoleBottomRef} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Posting History & Status Tab */}
              <TabsContent value="history" className="space-y-6">
                {/* Channels Grid with statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {telegramChannels.map(channel => {
                    const stats = channelStats[channel.id] || { total: 0, lastSent: null, lastTitle: null, lastStatus: null };
                    return (
                      <Card key={channel.id} className="bg-card hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                              <Globe className="h-4 w-4 text-primary" />
                              {channel.name}
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                              {channel.sector}
                            </Badge>
                          </div>
                          <CardDescription className="text-[11px] font-mono truncate">
                            ID: {channel.channel_id}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2.5 text-xs">
                          <div className="flex justify-between items-center border-b pb-1.5">
                            <span className="text-muted-foreground">Total Broadcasts:</span>
                            <span className="font-semibold text-primary">{stats.total} successful</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground block text-[11px]">Last Sent Item:</span>
                            {stats.lastSent ? (
                              <div className="bg-muted/30 p-1.5 rounded text-[11px] space-y-1">
                                <div className="font-medium line-clamp-1 text-foreground">
                                  {stats.lastTitle}
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>{format(new Date(stats.lastSent), "dd MMM yyyy, HH:mm")}</span>
                                  <span>
                                    {stats.lastStatus === "success" ? (
                                      <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/10 text-[9px] py-0 px-1 border-none">
                                        Success
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="text-[9px] py-0 px-1 border-none">
                                        Failed
                                      </Badge>
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">No posts yet</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* History Logs Table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-md flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Recent Broadcast History
                      </CardTitle>
                      <CardDescription>
                        Real-time duplicate-checking and dispatch log of the last 100 posts
                      </CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={fetchTelegramLogs}
                      disabled={loadingTelegramLogs}
                      className="gap-1.5"
                    >
                      {loadingTelegramLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Refresh logs
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loadingTelegramLogs ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : telegramLogs.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No posting logs found. Successful and failed Telegram broadcasts will be logged here.
                      </div>
                    ) : (
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Broadcast Date</TableHead>
                              <TableHead>Channel Name</TableHead>
                              <TableHead>Sector</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="min-w-[200px]">Item Title</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="max-w-[180px]">Details/Errors</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="text-xs">
                            {telegramLogs.map((log) => {
                              const title = log.jobs?.title || log.exam_updates?.title || "Unknown Title";
                              const subtitle = log.jobs?.department || "";
                              return (
                                <TableRow key={log.id}>
                                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                                    {format(new Date(log.sent_at), "dd MMM yyyy, HH:mm")}
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {log.telegram_channels?.name || "Deleted Channel"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px]">
                                      {log.telegram_channels?.sector || "N/A"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {log.job_id ? (
                                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-none text-[10px]">Job</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-none text-[10px]">Update</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium line-clamp-1">{title}</div>
                                    {subtitle && (
                                      <div className="text-[10px] text-muted-foreground line-clamp-1">{subtitle}</div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {log.status === "success" ? (
                                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-none text-[10px] flex items-center gap-1 w-fit">
                                        <Check className="h-3 w-3" /> Success
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                                        <X className="h-3 w-3" /> Failed
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground max-w-[180px] truncate" title={log.error_message || ""}>
                                    {log.status === "success" ? (
                                      <span className="text-[10px] text-green-600 flex items-center gap-1 font-medium">
                                        <CheckCircle className="h-3.5 w-3.5" /> Delivered
                                      </span>
                                    ) : (
                                      log.error_message || "Unknown error"
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="controls" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Stats Cards */}
                  <Card className="bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Notifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-500">{queueStats.pending}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">Waiting in send queue</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivered Notifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-500">{queueStats.sent}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">Sent to subscribers</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Failed Notifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">{queueStats.failed}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">Errored out / retrying</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Subscribers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{queueStats.totalSubscribers}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">Users with Telegram notifications active</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Date Filter Panel */}
                <Card className="bg-card border-primary/20 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/10 via-transparent to-transparent h-1.5 w-full" />
                  <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Filter className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Filter Operations by Upload Date</div>
                        <p className="text-xs text-muted-foreground">Select a date to show and operate on jobs/updates uploaded on that day. Clear to see recent items.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="w-full sm:w-[200px] bg-background border-input"
                        value={selectedDiagDate}
                        onChange={(e) => setSelectedDiagDate(e.target.value)}
                      />
                      {selectedDiagDate && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => setSelectedDiagDate("")}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Queue Actions / Flush Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold">Queue Actions</CardTitle>
                      <CardDescription>Manually trigger queue processing or cleaning</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        className="w-full gap-2"
                        onClick={handleFlushQueue}
                        disabled={flushingQueue || queueStats.pending === 0}
                      >
                        {flushingQueue ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing Queue...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Flush Queue Now
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
                        onClick={handleCleanQueue}
                        disabled={cleaningQueue || (queueStats.sent === 0 && queueStats.failed === 0)}
                      >
                        {cleaningQueue ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cleaning...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Clear Logs (&gt; 7 days)
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={fetchQueueStats}
                        disabled={loadingQueueStats}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingQueueStats ? "animate-spin" : ""}`} />
                        Refresh Statistics
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Manual Broadcast / Matching triggering */}
                  <Card className="md:col-span-2">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-md font-semibold">Recent Job Operations</CardTitle>
                        <CardDescription>
                          {selectedDiagDate 
                            ? `Showing all ${recentJobs.length} jobs uploaded on ${format(new Date(selectedDiagDate), "dd MMM yyyy")}`
                            : "Manually trigger matching notifications or public channel broadcasts"
                          }
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null || recentJobs.length === 0}
                          onClick={() => handleTriggerAllMatchers("job")}
                        >
                          {runningBatchMatcher === "job" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          )}
                          Match All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null || recentJobs.length === 0}
                          onClick={() => handleTriggerAllBroadcasts("job")}
                        >
                          {runningBatchBroadcast === "job" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          Broadcast All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {recentJobs.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground italic">
                          No jobs available.
                        </div>
                      ) : (
                        <div className="divide-y border-t border-b">
                          {recentJobs.map(job => (
                            <div key={job.id} className="p-3 text-xs flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-foreground line-clamp-1">{job.title}</div>
                                <div className="text-muted-foreground text-[10px] truncate">{job.department}</div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[11px] gap-1 px-2.5"
                                  disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null}
                                  onClick={() => handleTriggerMatcher("job", job)}
                                >
                                  {runningMatcherId === job.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3 text-primary" />
                                  )}
                                  Queue Matcher
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[11px] gap-1 px-2.5"
                                  disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null}
                                  onClick={() => handleTriggerBroadcast("job", job)}
                                >
                                  {runningBroadcastId === job.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3 text-emerald-500" />
                                  )}
                                  Broadcast
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Updates Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-3">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-md font-semibold">Recent Update Operations</CardTitle>
                        <CardDescription>
                          {selectedDiagDate 
                            ? `Showing all ${recentUpdates.length} updates uploaded on ${format(new Date(selectedDiagDate), "dd MMM yyyy")}`
                            : "Manually trigger subscriber preference matching or public channel broadcasts for updates"
                          }
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null || recentUpdates.length === 0}
                          onClick={() => handleTriggerAllMatchers("update")}
                        >
                          {runningBatchMatcher === "update" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          )}
                          Match All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null || recentUpdates.length === 0}
                          onClick={() => handleTriggerAllBroadcasts("update")}
                        >
                          {runningBatchBroadcast === "update" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          Broadcast All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {recentUpdates.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground italic">
                          No recent updates found.
                        </div>
                      ) : (
                        <div className="divide-y border-t border-b">
                          {recentUpdates.map(update => (
                            <div key={update.id} className="p-3 text-xs flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-foreground line-clamp-1">{update.title}</div>
                                <div className="text-muted-foreground text-[10px] capitalize">Category: {update.category?.replace("_", " ")} | Status: {update.status || "N/A"}</div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[11px] gap-1 px-2.5"
                                  disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null}
                                  onClick={() => handleTriggerMatcher("update", update)}
                                >
                                  {runningMatcherId === update.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3 text-primary" />
                                  )}
                                  Queue Matcher
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[11px] gap-1 px-2.5"
                                  disabled={runningMatcherId !== null || runningBroadcastId !== null || runningBatchMatcher !== null || runningBatchBroadcast !== null}
                                  onClick={() => handleTriggerBroadcast("update", update)}
                                >
                                  {runningBroadcastId === update.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3 text-emerald-500" />
                                  )}
                                  Broadcast
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Facebook Posting Tab */}
          <TabsContent value="facebook">
            <Tabs defaultValue="poster" className="space-y-4">
              <TabsList className="flex flex-col sm:grid w-full max-w-full sm:max-w-[400px] sm:grid-cols-2 h-auto sm:h-10 gap-1 sm:gap-0">
                <TabsTrigger value="poster">Manual Poster</TabsTrigger>
                <TabsTrigger value="history" onClick={fetchFacebookLogs}>Posting History & Status</TabsTrigger>
              </TabsList>
              
              <TabsContent value="poster" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Pages Configuration */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card>
                      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="text-lg">Facebook Pages</CardTitle>
                          <CardDescription>Configure Page Access Tokens per sector</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowFacebookAddPageDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {facebookPages.length === 0 ? (
                          <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                            No Facebook pages configured yet. Click 'Add' to configure one.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {facebookPages.map((page) => (
                              <div
                                key={page.id}
                                className={`p-2 border rounded-lg hover:border-primary/50 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                  selectedFacebookPageId === page.id ? "border-primary bg-primary/5" : "bg-card"
                                }`}
                                onClick={() => setSelectedFacebookPageId(page.id)}
                              >
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  <h4 className="font-semibold text-xs truncate" title={page.name}>{page.name}</h4>
                                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 flex-shrink-0">
                                    {page.sector}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[80px]" title={`Page ID: ${page.page_id}`}>
                                    {page.page_id}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFacebookPage(page.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Middle Column: Jobs/Updates Selector */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card className="h-full flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Publish Selection</CardTitle>
                        <CardDescription>Select job or update to broadcast</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
                        {/* Search Tag Filter Row */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Tag</Label>
                          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1 pb-1">
                            {[
                              "All Jobs", "SSC", "Railway Jobs", "Banking Jobs", "UPSC", 
                              "Defence Jobs", "PSU", "State PSC", "Healthcare", "Teaching", 
                              "Judiciary", "Stenographer"
                            ].map((tag) => {
                              const isActive = selectedFacebookTag === tag;
                              return (
                                <Badge
                                  key={tag}
                                  variant={isActive ? "default" : "outline"}
                                  className={`cursor-pointer transition-all duration-200 py-1 px-2.5 rounded-full select-none text-[11px] font-medium ${
                                    isActive
                                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                                      : "bg-background hover:bg-secondary/80 hover:text-foreground text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/60"
                                  }`}
                                  onClick={() => handleFacebookTagSelect(tag)}
                                >
                                  {tag}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="facebook-sector">Select Sector/Search Term</Label>
                          <div className="space-y-1.5">
                            <Input
                              placeholder="Type to filter sectors..."
                              value={sectorSearchQuery}
                              onChange={(e) => setSectorSearchQuery(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <Select value={selectedFacebookSector} onValueChange={(val) => {
                              setSelectedFacebookSector(val);
                              setSelectedFacebookTag("All Jobs");
                              setSelectedFacebookJobIds([]);
                              setSelectedFacebookUpdateIds([]);
                              const matched = facebookPages.find(p => p.sector.toLowerCase() === val.toLowerCase());
                              if (matched) setSelectedFacebookPageId(matched.id);
                            }}>
                              <SelectTrigger id="facebook-sector">
                                <SelectValue placeholder="Sector" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {filteredTelegramTiers.length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground text-xs">No matching sectors</div>
                                ) : (
                                  filteredTelegramTiers.map((tier) => (
                                    <SelectGroup key={tier.name}>
                                      <SelectLabel className="font-bold text-primary text-xs bg-muted/40 px-2 py-1 sticky top-0 z-10">{tier.name}</SelectLabel>
                                      {tier.terms.map((term) => (
                                        <SelectItem key={term} value={term}>{term}</SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Content Type</Label>
                          <RadioGroup
                            defaultValue="jobs"
                            value={facebookSourceType}
                            onValueChange={(val: "jobs" | "updates") => {
                              setFacebookSourceType(val);
                              setSelectedFacebookJobIds([]);
                              setSelectedFacebookUpdateIds([]);
                            }}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="jobs" id="fb-source-jobs" />
                              <Label htmlFor="fb-source-jobs" className="cursor-pointer">Active Jobs</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="updates" id="fb-source-updates" />
                              <Label htmlFor="fb-source-updates" className="cursor-pointer">Job Updates</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-2">
                            <Label>
                              {facebookSourceType === "jobs" ? "Available Active Jobs" : "Available Updates"}
                            </Label>
                            {(facebookSourceType === "jobs" ? activeJobsForFacebook.length > 0 : (facebookExamUpdates && facebookExamUpdates.length > 0)) && (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id="select-all-facebook"
                                  checked={
                                    facebookSourceType === "jobs"
                                      ? activeJobsForFacebook.length > 0 && activeJobsForFacebook.every(j => selectedFacebookJobIds.includes(j.id))
                                      : !!(facebookExamUpdates && facebookExamUpdates.length > 0 && facebookExamUpdates.every(u => selectedFacebookUpdateIds.includes(u.id)))
                                  }
                                  onCheckedChange={(checked) => {
                                    if (facebookSourceType === "jobs") {
                                      if (checked) {
                                        setSelectedFacebookJobIds(activeJobsForFacebook.map(j => j.id));
                                      } else {
                                        setSelectedFacebookJobIds([]);
                                      }
                                    } else {
                                      if (checked && facebookExamUpdates) {
                                        setSelectedFacebookUpdateIds(facebookExamUpdates.map(u => u.id));
                                      } else {
                                        setSelectedFacebookUpdateIds([]);
                                      }
                                    }
                                  }}
                                />
                                <Label htmlFor="select-all-facebook" className="text-xs cursor-pointer font-normal text-muted-foreground select-none">
                                  Select All ({facebookSourceType === "jobs" ? activeJobsForFacebook.length : facebookExamUpdates?.length || 0})
                                </Label>
                              </div>
                            )}
                          </div>

                          {facebookSourceType === "jobs" && activeJobsForFacebook.length > 0 && (
                            <div className="flex items-center gap-2 mb-2 bg-muted/20 p-2 rounded border text-xs">
                              <span className="text-muted-foreground font-medium">Sort:</span>
                              <Select
                                value={facebookSortField || ""}
                                onValueChange={(val: any) => {
                                  setFacebookSortField(val);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
                                  <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="created_at">Date Added (Newest)</SelectItem>
                                  <SelectItem value="last_date">Deadline Date</SelectItem>
                                  <SelectItem value="vacancies">Vacancies (Highest)</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setFacebookSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                }}
                              >
                                {facebookSortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          )}
                          
                          <div className="flex-1 border rounded-md overflow-y-auto max-h-[350px]">
                            {facebookSourceType === "jobs" ? (
                              activeJobsForFacebook.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground text-sm">
                                  No active jobs in this sector.
                                </div>
                              ) : (
                                <div className="divide-y">
                                  {activeJobsForFacebook.map((job) => (
                                    <div
                                      key={job.id}
                                      className={`p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors flex items-start gap-2.5 ${
                                        selectedFacebookJobIds.includes(job.id) ? "bg-muted/60 font-medium" : ""
                                      }`}
                                      onClick={() => {
                                        setSelectedFacebookJobIds(prev =>
                                          prev.includes(job.id) ? prev.filter(id => id !== job.id) : [...prev, job.id]
                                        );
                                      }}
                                    >
                                      <Checkbox
                                        checked={selectedFacebookJobIds.includes(job.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={(checked) => {
                                          setSelectedFacebookJobIds(prev =>
                                            checked
                                              ? [...prev, job.id]
                                              : prev.filter(id => id !== job.id)
                                          );
                                        }}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm line-clamp-1">{job.title}</div>
                                        <div className="text-muted-foreground mt-1 line-clamp-1">{job.department}</div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                                          <span>Vacancies: {job.vacancies_display || job.vacancies || "TBD"}</span>
                                          <span>Last Date: {(() => {
                                            const d = getJobDeadlineDate(job);
                                            if (d) {
                                              const isCurrentYear = d.getFullYear() === new Date().getFullYear();
                                              return format(d, isCurrentYear ? "dd MMM" : "dd MMM yyyy");
                                            }
                                            return job.last_date_display || job.last_date;
                                          })()}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            ) : (
                              telegramUpdatesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                              ) : !facebookExamUpdates || facebookExamUpdates.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground text-sm">
                                  No updates found in this sector.
                                </div>
                              ) : (
                                <div className="divide-y">
                                  {facebookExamUpdates.map((update) => (
                                    <div
                                      key={update.id}
                                      className={`p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors flex items-start gap-2.5 ${
                                        selectedFacebookUpdateIds.includes(update.id) ? "bg-muted/60 font-medium" : ""
                                      }`}
                                      onClick={() => {
                                        setSelectedFacebookUpdateIds(prev =>
                                          prev.includes(update.id) ? prev.filter(id => id !== update.id) : [...prev, update.id]
                                        );
                                      }}
                                    >
                                      <Checkbox
                                        checked={selectedFacebookUpdateIds.includes(update.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={(checked) => {
                                          setSelectedFacebookUpdateIds(prev =>
                                            checked
                                              ? [...prev, update.id]
                                              : prev.filter(id => id !== update.id)
                                          );
                                        }}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm line-clamp-1">{update.title}</div>
                                        <div className="text-muted-foreground mt-1">Status: {update.status || "N/A"}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1.5">
                                          Published: {update.published_date || format(new Date(update.created_at), "dd MMM yyyy")}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Live Preview & Action */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card className="flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Message Live Preview</CardTitle>
                        <CardDescription>Verification before broadcasting</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="flex-1 bg-muted/30 border rounded-lg p-4 font-mono text-xs overflow-y-auto whitespace-pre-wrap max-h-[350px]">
                          {getFacebookPreviewMessage()}
                        </div>
                        <div className="space-y-3 border-t pt-4">
                          {selectedFacebookPageId ? (
                            <div className="text-xs text-muted-foreground bg-primary/5 p-2.5 rounded border border-primary/20 flex flex-col gap-1">
                              <div>
                                <strong>Sending To:</strong> {facebookPages.find(p => p.id === selectedFacebookPageId)?.name}
                              </div>
                              <div>
                                <strong>Page ID:</strong> {facebookPages.find(p => p.id === selectedFacebookPageId)?.page_id}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-destructive bg-destructive/5 p-2.5 rounded border border-destructive/20">
                              Please select or configure a Facebook page first.
                            </div>
                          )}
                          
                          <Button
                            className="w-full gap-2 h-11"
                            disabled={
                              postingToFacebook ||
                              !selectedFacebookPageId ||
                              (facebookSourceType === "jobs" ? selectedFacebookJobIds.length === 0 : selectedFacebookUpdateIds.length === 0)
                            }
                            onClick={handlePostToFacebook}
                          >
                            {postingToFacebook ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Posting notification...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Publish to Facebook
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="flex flex-col">
                      <CardHeader className="pb-3 pt-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-primary" />
                          Execution Console
                        </CardTitle>
                        <CardDescription className="text-[10px]">Real-time Facebook posting logs</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-4 pt-0">
                        <div className="bg-black/95 text-green-400 font-mono text-[10px] p-3 rounded border border-border/40 min-h-[120px] max-h-[180px] overflow-y-auto">
                          {facebookConsoleLogs.length === 0 ? (
                            <span className="text-muted-foreground italic">Idle. Console waiting for execution...</span>
                          ) : (
                            facebookConsoleLogs.map((log, index) => (
                              <div key={index} className="line-clamp-2 leading-relaxed">
                                {log}
                              </div>
                            ))
                          )}
                          <div ref={facebookConsoleBottomRef} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Posting History & Status Tab */}
              <TabsContent value="history" className="space-y-6">
                {/* Pages Grid with statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {facebookPages.map(page => {
                    const stats = facebookPageStats[page.id] || { total: 0, lastSent: null, lastTitle: null, lastStatus: null };
                    return (
                      <Card key={page.id} className="bg-card hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                              <Globe className="h-4 w-4 text-primary" />
                              {page.name}
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                              {page.sector}
                            </Badge>
                          </div>
                          <CardDescription className="text-[11px] font-mono truncate">
                            ID: {page.page_id}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2.5 text-xs">
                          <div className="flex justify-between items-center border-b pb-1.5">
                            <span className="text-muted-foreground">Total Broadcasts:</span>
                            <span className="font-semibold text-primary">{stats.total} successful</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground block text-[11px]">Last Sent Item:</span>
                            {stats.lastSent ? (
                              <div className="bg-muted/30 p-1.5 rounded text-[11px] space-y-1">
                                <div className="font-medium line-clamp-1 text-foreground">
                                  {stats.lastTitle}
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>{format(new Date(stats.lastSent), "dd MMM yyyy, HH:mm")}</span>
                                  <span>
                                    {stats.lastStatus === "success" ? (
                                      <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/10 text-[9px] py-0 px-1 border-none">
                                        Success
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="text-[9px] py-0 px-1 border-none">
                                        Failed
                                      </Badge>
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">No posts yet</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* History Logs Table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-md flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Recent Broadcast History
                      </CardTitle>
                      <CardDescription>
                        Real-time duplicate-checking and dispatch log of the last 100 posts
                      </CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={fetchFacebookLogs}
                      disabled={loadingFacebookLogs}
                      className="gap-1.5"
                    >
                      {loadingFacebookLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Refresh logs
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loadingFacebookLogs ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : facebookLogs.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No posting logs found. Successful and failed Facebook broadcasts will be logged here.
                      </div>
                    ) : (
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Broadcast Date</TableHead>
                              <TableHead>Page Name</TableHead>
                              <TableHead>Sector</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="min-w-[200px]">Item Title</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="max-w-[180px]">Details/Errors</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="text-xs">
                            {facebookLogs.map((log) => {
                              const title = log.jobs?.title || log.exam_updates?.title || "Unknown Title";
                              const subtitle = log.jobs?.department || "";
                              return (
                                <TableRow key={log.id}>
                                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                                    {format(new Date(log.sent_at), "dd MMM yyyy, HH:mm")}
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {log.facebook_pages?.name || "Deleted Page"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px]">
                                      {log.facebook_pages?.sector || "N/A"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {log.job_id ? (
                                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-none text-[10px]">Job</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-none text-[10px]">Update</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium line-clamp-1">{title}</div>
                                    {subtitle && (
                                      <div className="text-[10px] text-muted-foreground line-clamp-1">{subtitle}</div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {log.status === "success" ? (
                                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-none text-[10px] flex items-center gap-1 w-fit">
                                        <Check className="h-3 w-3" /> Success
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                                        <X className="h-3 w-3" /> Failed
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground max-w-[180px] truncate" title={log.error_message || ""}>
                                    {log.status === "success" ? (
                                      <span className="text-[10px] text-green-600 flex items-center gap-1 font-medium">
                                        <CheckCircle className="h-3.5 w-3.5" /> Delivered
                                      </span>
                                    ) : (
                                      log.error_message || "Unknown error"
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
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
                    </div>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden divide-y">
                      {userStats.allUsers.map((user) => (
                        <div key={user.id} className="p-4 space-y-3 bg-card hover:bg-muted/10 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-sm text-foreground truncate">{user.full_name || "Not set"}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email || "Not set"}</p>
                            </div>
                            <Badge variant={user.api_call_count > 0 ? "default" : "outline"} className="text-[9px] py-0 px-1.5 h-4.5 flex-shrink-0">
                              {user.api_call_count} API Calls
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">Qual:</span>
                              {user.highest_qualification ? (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 border-none">{user.highest_qualification}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-[10px] font-mono">-</span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">Joined: {format(new Date(user.created_at), "dd MMM yyyy")}</span>
                          </div>
                        </div>
                      ))}
                      {userStats.allUsers.length === 0 && (
                        <div className="text-center text-muted-foreground py-12 text-xs bg-card">
                          No registered users yet
                        </div>
                      )}
                    </div>
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
                  Drag & drop logo files to upload. Titles are auto-parsed from filenames (e.g., "DBIM_BIS_Hallmark_PNG_#6C1340 (1).png" → "BIS Hallmark").
                  Recommended size: 128×128px or 256×256px PNG with transparent background.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Manual Upload Form */}
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

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or bulk upload</span>
                  </div>
                </div>

                {/* Drag & Drop Zone */}
                <div
                  ref={logoDropRef}
                  onDragOver={handleLogoDragOver}
                  onDragLeave={handleLogoDragLeave}
                  onDrop={handleLogoDrop}
                  onClick={() => logoFileInputRef.current?.click()}
                  className={`relative cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${isDraggingOver
                      ? "border-primary bg-primary/5 scale-[1.01] shadow-lg"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                    }`}
                >
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        processLogoFiles(e.target.files);
                        e.target.value = "";
                      }
                    }}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full transition-colors ${isDraggingOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                      <Upload className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isDraggingOver ? "Drop files here" : "Drag & drop logo files here"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse • PNG, JPG, SVG, WebP
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload Queue */}
                {logoQueue.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">
                        Upload Queue ({logoQueue.length} file{logoQueue.length !== 1 ? "s" : ""})
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            logoQueue.forEach((item) => URL.revokeObjectURL(item.preview));
                            setLogoQueue([]);
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear All
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleBatchLogoUpload}
                          disabled={batchUploading || logoQueue.every((i) => i.duplicateStatus === "exact" || !i.editedTitle.trim())}
                        >
                          {batchUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading {batchProgress}/{logoQueue.filter((i) => i.duplicateStatus !== "exact" && i.editedTitle.trim()).length}
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload All ({logoQueue.filter((i) => i.duplicateStatus !== "exact" && i.editedTitle.trim()).length})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {logoQueue.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${item.duplicateStatus === "exact"
                              ? "border-destructive/30 bg-destructive/5"
                              : item.duplicateStatus === "similar"
                                ? "border-yellow-500/30 bg-yellow-500/5"
                                : "border-border bg-card"
                            }`}
                        >
                          {/* Thumbnail */}
                          <img
                            src={item.preview}
                            alt={item.editedTitle}
                            className="h-12 w-12 rounded-lg object-contain bg-muted flex-shrink-0"
                          />

                          {/* Title Input */}
                          <div className="flex-1 min-w-0">
                            <Input
                              value={item.editedTitle}
                              onChange={(e) => updateLogoQueueTitle(item.id, e.target.value)}
                              placeholder="Enter logo title"
                              className="h-8 text-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {item.file.name}
                            </p>
                          </div>

                          {/* Duplicate Status Badge */}
                          <div className="flex-shrink-0">
                            {item.duplicateStatus === "exact" && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <XCircle className="h-3 w-3" />
                                Duplicate{item.similarTo ? ` of "${item.similarTo}"` : ""}
                              </Badge>
                            )}
                            {item.duplicateStatus === "similar" && (
                              <Badge variant="outline" className="text-xs gap-1 border-yellow-500/50 text-yellow-600">
                                <AlertTriangle className="h-3 w-3" />
                                Similar to "{item.similarTo}"
                              </Badge>
                            )}
                            {item.duplicateStatus === "new" && (
                              <Badge variant="outline" className="text-xs gap-1 border-green-500/50 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                New
                              </Badge>
                            )}
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => removeFromLogoQueue(item.id)}
                            className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Logo Grid */}
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
                      <p className="text-xs mt-1">Drop logo files above to get started.</p>
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

                {/* Unmatched Departments Report */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">
                      Unmatched Departments
                    </h3>
                  </div>
                  {jobsLoading || logosLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (() => {
                    const departments = (jobs || []).map(j => j.department);
                    const unmatched = getUnmatchedDepartments(departments);
                    return unmatched.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-60" />
                        <p className="text-sm">All departments have matching logos!</p>
                      </div>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="bg-destructive/5 px-4 py-2 border-b">
                          <p className="text-xs font-medium text-destructive">
                            {unmatched.length} department{unmatched.length > 1 ? 's' : ''} with no logo match
                          </p>
                        </div>
                        <ScrollArea className="max-h-64">
                          <div className="divide-y">
                            {unmatched.map((dept) => (
                              <div key={dept} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/50">
                                <span className="truncate mr-2">{dept}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">No logo</Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                      {scraperResult.official_apply_link && !isFreeJobAlertUrl(scraperResult.official_apply_link) && (
                        <a href={scraperResult.official_apply_link} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Apply Link
                          </Button>
                        </a>
                      )}
                      {scraperResult.notification_pdf && !isFreeJobAlertUrl(scraperResult.notification_pdf) && (
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
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Badge className="bg-primary text-white text-[10px] px-2 py-0">Step 2</Badge>
                        Discovered Links
                        <Badge variant="secondary" className="ml-1">
                          {discoveredLinks.length} found · {Object.keys(discoverScrapedResults).length} scraped · {discoverSavedUrls.size} saved
                        </Badge>
                      </h3>
                      <div className="flex gap-2">
                        {discoverScrapingUrl !== null ? (
                          <Button size="sm" variant="destructive" onClick={() => { discoverScrapeAbortRef.current = true; }}>
                            <Square className="h-3 w-3 mr-1" /> Stop
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={discoverSavingAll}
                            onClick={async () => {
                              discoverScrapeAbortRef.current = false;
                              for (const link of discoveredLinks) {
                                if (discoverScrapeAbortRef.current) break;
                                if (discoverScrapedResults[link.url]) continue;
                                await handleDiscoverScrapeOne(link.url);
                              }
                              setDiscoverScrapingUrl(null);
                              toast({ title: "Scrape All complete" });
                            }}
                          >
                            <Play className="h-3 w-3 mr-1" /> Scrape All
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={discoverSavingAll || discoverScrapingUrl !== null || Object.keys(discoverScrapedResults).filter(url => !discoverSavedUrls.has(url)).length === 0}
                          onClick={async () => {
                            setDiscoverSavingAll(true);
                            const unsaved = discoveredLinks.filter(l => discoverScrapedResults[l.url] && !discoverSavedUrls.has(l.url));
                            let saved = 0;
                            for (const link of unsaved) {
                              const success = await handleDiscoverSaveJob(link.url);
                              if (success) saved++;
                            }
                            setDiscoverSavingAll(false);
                            toast({ title: "Save All complete", description: `${saved} job${saved !== 1 ? "s" : ""} saved.` });
                          }}
                        >
                          {discoverSavingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                          Save All
                        </Button>
                      </div>
                    </div>

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
                                <React.Fragment key={link.url}>
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
                                </React.Fragment>
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

          {/* Updates Tab — Exam Updates Scraper */}
          <TabsContent value="updates">
            <div className="space-y-6">

              {/* Section A: Scrape Sources */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Scrape Sources
                      </CardTitle>
                      <CardDescription>Manage listing page URLs for automated scraping</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={govtScraper.triggerCron.isPending}
                        onClick={() => {
                          govtScraper.triggerCron.mutate(undefined, {
                            onSuccess: (data: any) => {
                              toast({
                                title: "Cron Run Complete",
                                description: `Scraped ${data?.summary?.total_scraped || 0} articles (${data?.summary?.total_new || 0} new, ${data?.summary?.total_updated || 0} updated)`,
                              });
                            },
                            onError: (e: any) => toast({ title: "Cron failed", description: e.message, variant: "destructive" }),
                          });
                        }}
                      >
                        {govtScraper.triggerCron.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                        Run All Active
                      </Button>
                      <Button size="sm" onClick={() => setUpdatesAddSourceOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Source
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {govtScraper.sourcesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : govtScraper.sources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No scrape sources configured.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">Active</TableHead>
                            <TableHead className="text-center">Limit</TableHead>
                            <TableHead>Last Scraped</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {govtScraper.sources.map((source) => (
                            <TableRow key={source.id}>
                              <TableCell className="font-medium text-sm">{source.name}</TableCell>
                              <TableCell>
                                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline max-w-[200px] truncate block">
                                  {source.url.replace(/^https?:\/\//, "").slice(0, 40)}...
                                </a>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">{source.category.replace(/_/g, " ")}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-7 w-7 p-0 ${source.is_active ? "text-green-600" : "text-muted-foreground"}`}
                                  onClick={() => govtScraper.toggleSourceActive.mutate({ id: source.id, is_active: !source.is_active })}
                                >
                                  {source.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                              <TableCell className="text-center text-sm">{source.limit_per_run}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {source.last_scraped_at ? format(new Date(source.last_scraped_at), "MMM d, HH:mm") : "Never"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={updatesCrawlingSourceId === source.id}
                                    onClick={() => {
                                      setUpdatesCrawlingSourceId(source.id);
                                      govtScraper.triggerSourceCrawl.mutate(
                                        { sourceId: source.id, limit: source.limit_per_run },
                                        {
                                          onSuccess: (data: any) => {
                                            setUpdatesCrawlingSourceId(null);
                                            toast({
                                              title: `${source.name} scraped!`,
                                              description: `Found ${data?.result?.articles_found || 0}, New: ${data?.result?.articles_new || 0}, Updated: ${data?.result?.articles_updated || 0}`,
                                            });
                                          },
                                          onError: (e: any) => {
                                            setUpdatesCrawlingSourceId(null);
                                            toast({ title: "Scrape failed", description: e.message, variant: "destructive" });
                                          },
                                        },
                                      );
                                    }}
                                  >
                                    {updatesCrawlingSourceId === source.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                                    Scrape
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive"
                                    onClick={() => govtScraper.deleteSource.mutate(source.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Add Source Form (inline) */}
                  {updatesAddSourceOpen && (
                    <div className="mt-4 p-4 border rounded-lg bg-secondary/30 space-y-3">
                      <h4 className="text-sm font-medium">Add New Source</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            placeholder="e.g. Railway Jobs"
                            value={updatesNewSource.name}
                            onChange={(e) => setUpdatesNewSource({ ...updatesNewSource, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">URL</Label>
                          <Input
                            placeholder="https://www.freejobalert.com/..."
                            value={updatesNewSource.url}
                            onChange={(e) => setUpdatesNewSource({ ...updatesNewSource, url: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select value={updatesNewSource.category} onValueChange={(v) => setUpdatesNewSource({ ...updatesNewSource, category: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admit_card">Admit Card</SelectItem>
                              <SelectItem value="result">Result</SelectItem>
                              <SelectItem value="answer_key">Answer Key</SelectItem>
                              <SelectItem value="syllabus">Syllabus</SelectItem>
                              <SelectItem value="latest">Latest</SelectItem>
                              <SelectItem value="recruitment">Recruitment</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Limit per run</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={updatesNewSource.limit_per_run}
                            onChange={(e) => setUpdatesNewSource({ ...updatesNewSource, limit_per_run: parseInt(e.target.value) || 6 })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setUpdatesAddSourceOpen(false); setUpdatesNewSource({ name: "", url: "", category: "custom", limit_per_run: 6 }); }}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!updatesNewSource.name.trim() || !updatesNewSource.url.trim() || govtScraper.addSource.isPending}
                          onClick={() => {
                            govtScraper.addSource.mutate(updatesNewSource, {
                              onSuccess: () => {
                                toast({ title: "Source added!" });
                                setUpdatesAddSourceOpen(false);
                                setUpdatesNewSource({ name: "", url: "", category: "custom", limit_per_run: 6 });
                              },
                              onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
                            });
                          }}
                        >
                          {govtScraper.addSource.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section B: Manual Discover & Scrape */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Manual Discover & Scrape
                    </CardTitle>
                    <CardDescription>
                      Load article links from a listing page, then scrape individual articles
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
                    {govtScraper.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-xs text-muted-foreground">Quick:</span>
                        {govtScraper.sources.map((s, i) => (
                          <Button
                            key={s.id}
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] px-2"
                            onClick={() => { setUpdatesDiscoverUrl(s.url); setUpdatesDiscoverLimit(s.limit_per_run); }}
                          >
                            {i + 1}. {s.name}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={updatesDiscoverUrl}
                        onChange={(e) => setUpdatesDiscoverUrl(e.target.value)}
                        placeholder="https://www.freejobalert.com/admit-card/"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && updatesDiscoverUrl && !govtScraper.scrapeLinks.isPending) {
                            govtScraper.scrapeLinks.mutate(
                              { url: updatesDiscoverUrl, limit: updatesDiscoverLimit },
                              {
                                onSuccess: (data) => {
                                  setUpdatesDiscoveredLinks(data.links);
                                  setUpdatesScrapedResults({});
                                  setUpdatesSavedUrls(new Set());
                                  setUpdatesExpandedUrl(null);
                                  setUpdatesScrapingUrl(null);
                                },
                                onError: (e: any) => toast({ title: "Failed to load links", description: e.message, variant: "destructive" }),
                              },
                            );
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={updatesDiscoverLimit}
                            onChange={(e) => setUpdatesDiscoverLimit(parseInt(e.target.value) || 10)}
                            className="w-20"
                          />
                          <span className="text-[10px] text-muted-foreground">Links</span>
                        </div>
                        <Button
                          disabled={!updatesDiscoverUrl.trim() || govtScraper.scrapeLinks.isPending}
                          onClick={() => {
                            govtScraper.scrapeLinks.mutate(
                              { url: updatesDiscoverUrl, limit: updatesDiscoverLimit },
                              {
                                onSuccess: (data) => {
                                  setUpdatesDiscoveredLinks(data.links);
                                  setUpdatesScrapedResults({});
                                  setUpdatesSavedUrls(new Set());
                                  setUpdatesExpandedUrl(null);
                                  toast({ title: `Loaded ${data.total} links` });
                                },
                                onError: (e: any) => toast({ title: "Failed to load links", description: e.message, variant: "destructive" }),
                              },
                            );
                          }}
                        >
                          {govtScraper.scrapeLinks.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                          Load Links
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Results table */}
                  {updatesDiscoveredLinks.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Badge className="bg-primary text-white text-[10px] px-2 py-0">Step 2</Badge>
                          Discovered Links
                          <Badge variant="secondary" className="ml-1">
                            {updatesDiscoveredLinks.length} found · {Object.keys(updatesScrapedResults).length} scraped · {updatesSavedUrls.size} saved
                          </Badge>
                        </h3>
                        <div className="flex gap-2 items-center">
                          <div className="flex items-center gap-1.5 mr-1">
                            <Switch
                              id="rephrase-toggle"
                              checked={updatesRephraseOn}
                              onCheckedChange={(checked: boolean) => setUpdatesRephraseOn(checked)}
                            />
                            <label htmlFor="rephrase-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                              Rephrase text
                            </label>
                          </div>
                          {updatesScrapingUrl !== null ? (
                            <Button size="sm" variant="destructive" onClick={() => { updatesScrapeAbortRef.current = true; }}>
                              <Square className="h-3 w-3 mr-1" /> Stop
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatesSavingAll}
                              onClick={async () => {
                                updatesScrapeAbortRef.current = false;
                                let failed = 0;
                                for (const link of updatesDiscoveredLinks) {
                                  if (updatesScrapeAbortRef.current) break;
                                  if (updatesScrapedResults[link.url]) continue;
                                  setUpdatesScrapingUrl(link.url);
                                  try {
                                    const result = await govtScraper.scrapeSingleArticle.mutateAsync({ articleUrl: link.url, rephrase: updatesRephraseOn });
                                    setUpdatesScrapedResults((prev) => ({ ...prev, [link.url]: result.article }));
                                  } catch (e: any) {
                                    console.error("Scrape failed for", link.url, e);
                                    failed++;
                                  }
                                }
                                setUpdatesScrapingUrl(null);
                                if (failed > 0) {
                                  toast({ title: "Scrape All complete", description: `${failed} article(s) failed to scrape.`, variant: "destructive" });
                                } else {
                                  toast({ title: "Scrape All complete" });
                                }
                              }}
                            >
                              <Play className="h-3 w-3 mr-1" /> Scrape All
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatesSavingAll || updatesScrapingUrl !== null || Object.keys(updatesScrapedResults).filter(url => !updatesSavedUrls.has(url)).length === 0}
                            onClick={async () => {
                              setUpdatesSavingAll(true);
                              const unsaved = updatesDiscoveredLinks.filter(l => updatesScrapedResults[l.url] && !updatesSavedUrls.has(l.url));
                              let saved = 0;
                              let failed = 0;
                              for (const link of unsaved) {
                                try {
                                  await govtScraper.saveArticle.mutateAsync({ article: updatesScrapedResults[link.url] });
                                  setUpdatesSavedUrls((prev) => new Set(prev).add(link.url));
                                  saved++;
                                } catch (e: any) {
                                  console.error("Save failed for", link.url, e);
                                  failed++;
                                }
                              }
                              setUpdatesSavingAll(false);
                              const total = unsaved.length;
                              if (failed > 0) {
                                toast({ title: "Save All complete", description: `${saved}/${total} saved, ${failed} failed.`, variant: "destructive" });
                              } else {
                                toast({ title: "Save All complete", description: `${saved} article${saved !== 1 ? "s" : ""} saved.` });
                              }
                            }}
                          >
                            {updatesSavingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                            Save All
                          </Button>
                        </div>
                      </div>

                      <div className="relative max-h-[600px] w-full overflow-auto rounded-md border bg-card">
                          <Table className="min-w-[700px] relative">
                            <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
                              <TableRow>
                                <TableHead className="w-[40px] whitespace-nowrap">#</TableHead>
                                <TableHead className="min-w-[200px]">Title</TableHead>
                                <TableHead className="w-[90px]">Category</TableHead>
                                <TableHead className="w-[90px]">Status</TableHead>
                                <TableHead className="w-[200px] text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {updatesDiscoveredLinks.map((link, idx) => {
                                const isScraped = !!updatesScrapedResults[link.url];
                                const isScraping = updatesScrapingUrl === link.url;
                                const isSaved = updatesSavedUrls.has(link.url);
                                const isExpanded = updatesExpandedUrl === link.url;
                                const isSaving = updatesSavingUrl === link.url;

                                return (
                                  <React.Fragment key={link.url}>
                                    <TableRow key={link.url} className={isScraped ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                                      <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                                      <TableCell>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline font-medium line-clamp-2">
                                          {link.title}
                                        </a>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-[10px] capitalize">{link.category.replace(/_/g, " ")}</Badge>
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
                                              className="h-7 text-xs"
                                              disabled={isScraping}
                                              onClick={() => {
                                                setUpdatesScrapingUrl(link.url);
                                                govtScraper.scrapeSingleArticle.mutate({ articleUrl: link.url, rephrase: updatesRephraseOn }, {
                                                  onSuccess: (result) => {
                                                    setUpdatesScrapedResults((prev) => ({ ...prev, [link.url]: result.article }));
                                                    setUpdatesScrapingUrl(null);
                                                  },
                                                  onError: (e: any) => {
                                                    setUpdatesScrapingUrl(null);
                                                    toast({ title: "Scrape failed", description: e.message, variant: "destructive" });
                                                  },
                                                });
                                              }}
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
                                                className="h-7 text-xs"
                                                onClick={() => setUpdatesExpandedUrl(isExpanded ? null : link.url)}
                                              >
                                                {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                                View
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs"
                                                onClick={() => {
                                                  setUpdatesScrapingUrl(link.url);
                                                  govtScraper.scrapeSingleArticle.mutate({ articleUrl: link.url, rephrase: updatesRephraseOn }, {
                                                    onSuccess: (result) => {
                                                      setUpdatesScrapedResults((prev) => ({ ...prev, [link.url]: result.article }));
                                                      setUpdatesScrapingUrl(null);
                                                    },
                                                    onError: (e: any) => {
                                                      setUpdatesScrapingUrl(null);
                                                      toast({ title: "Re-scrape failed", description: e.message, variant: "destructive" });
                                                    },
                                                  });
                                                }}
                                              >
                                                <RefreshCw className="h-3 w-3 mr-1" /> Re-scrape
                                              </Button>
                                              {!isSaved && (
                                                <Button
                                                  size="sm"
                                                  className="h-7 text-xs"
                                                  disabled={isSaving || updatesSavingAll}
                                                  onClick={() => {
                                                    setUpdatesSavingUrl(link.url);
                                                    govtScraper.saveArticle.mutate({ article: updatesScrapedResults[link.url] }, {
                                                      onSuccess: (result) => {
                                                        setUpdatesSavedUrls((prev) => new Set(prev).add(link.url));
                                                        setUpdatesSavingUrl(null);
                                                        toast({ title: result.action === "new" ? "Saved!" : "Updated!", description: link.title });
                                                      },
                                                      onError: (e: any) => {
                                                        setUpdatesSavingUrl(null);
                                                        toast({ title: "Save failed", description: e.message, variant: "destructive" });
                                                      },
                                                    });
                                                  }}
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

                                    {/* Expandable detail panel */}
                                    {isExpanded && isScraped && (
                                      <TableRow key={`${link.url}-detail`}>
                                        <TableCell colSpan={5} className="p-0 max-w-0">
                                          <div className="bg-secondary/30 border-y border-primary/20 p-4 space-y-3 w-full">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-semibold text-primary">
                                                  {updatesScrapedResults[link.url]?.title || "Article"}
                                                </h4>
                                                {updatesScrapedResults[link.url]?.is_rephrased && (
                                                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                                    Rephrased
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="flex gap-1">
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                  const { url: _url, scraped_at: _sat, ...displayData } = updatesScrapedResults[link.url] || {};
                                  navigator.clipboard.writeText(JSON.stringify(displayData, null, 2));
                                  toast({ title: "Copied!" });
                                }}>
                                  <Copy className="h-3 w-3 mr-1" />Copy JSON
                                </Button>
                                              </div>
                                            </div>

                                            {/* Quick info */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                              <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                                <div className="text-[10px] text-muted-foreground">Category</div>
                                                <div className="text-xs font-medium capitalize">{updatesScrapedResults[link.url]?.category?.replace(/_/g, " ") || "—"}</div>
                                              </div>
                                              <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                                <div className="text-[10px] text-muted-foreground">Status</div>
                                                <div className="text-xs font-medium">{updatesScrapedResults[link.url]?.status || "—"}</div>
                                              </div>
                                              <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                                <div className="text-[10px] text-muted-foreground">Published</div>
                                                <div className="text-xs font-medium">{updatesScrapedResults[link.url]?.published_date || "—"}</div>
                                              </div>
                                              <div className="bg-white dark:bg-card rounded-lg px-3 py-2">
                                                <div className="text-[10px] text-muted-foreground">Dates</div>
                                                <div className="text-xs font-medium">{updatesScrapedResults[link.url]?.important_dates?.length || 0} entries</div>
                                              </div>
                                            </div>

                                            {/* Important dates table */}
                                            {updatesScrapedResults[link.url]?.important_dates?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Important Dates</h5>
                                                <div className="max-h-[150px] overflow-auto rounded border">
                                                  <Table>
                                                    <TableBody>
                                                      {updatesScrapedResults[link.url].important_dates.map((d: any, i: number) => (
                                                        <TableRow key={i}>
                                                          <TableCell className="text-xs py-1">{d.event}</TableCell>
                                                          <TableCell className="text-xs py-1 font-medium">{d.date}</TableCell>
                                                          <TableCell className="text-xs py-1 text-muted-foreground">{d.status}</TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            )}

                                            {/* Download links */}
                                            {updatesScrapedResults[link.url]?.download_links?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Download Links</h5>
                                                <div className="flex flex-wrap gap-1">
                                                  {updatesScrapedResults[link.url].download_links.map((dl: any, i: number) => (
                                                    <a key={i} href={dl.url} target="_blank" rel="noopener noreferrer">
                                                      <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10">
                                                        <ExternalLink className="h-2.5 w-2.5 mr-1" />{dl.text.slice(0, 40)}
                                                      </Badge>
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {/* Images */}
                                            {updatesScrapedResults[link.url]?.images?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Images ({updatesScrapedResults[link.url].images.length})</h5>
                                                <div className="flex flex-wrap gap-2">
                                                  {updatesScrapedResults[link.url].images.map((img: string, i: number) => (
                                                    <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="block">
                                                      <img src={img} alt={`img-${i}`} className="h-16 w-auto rounded border hover:opacity-80 transition-opacity" />
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {/* Vacancy Table */}
                                            {updatesScrapedResults[link.url]?.vacancy_table?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Vacancy Table</h5>
                                                <div className="max-h-[150px] overflow-auto rounded border">
                                                  <Table>
                                                    <TableBody>
                                                      {updatesScrapedResults[link.url].vacancy_table.map((v: any, i: number) => (
                                                        <TableRow key={i}>
                                                          <TableCell className="text-xs py-1">{v.post_name}</TableCell>
                                                          <TableCell className="text-xs py-1 font-medium">{v.vacancies}</TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            )}

                                            {/* Fee Table */}
                                            {updatesScrapedResults[link.url]?.fee_table?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Application Fee</h5>
                                                <div className="max-h-[150px] overflow-auto rounded border">
                                                  <Table>
                                                    <TableBody>
                                                      {updatesScrapedResults[link.url].fee_table.map((f: any, i: number) => (
                                                        <TableRow key={i}>
                                                          <TableCell className="text-xs py-1">{f.category}</TableCell>
                                                          <TableCell className="text-xs py-1 font-medium">{f.fee}</TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            )}

                                            {/* Cutoff Table */}
                                            {updatesScrapedResults[link.url]?.cutoff_table?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Cutoff / Qualifying Marks</h5>
                                                <div className="max-h-[150px] overflow-auto rounded border">
                                                  <Table>
                                                    <TableBody>
                                                      {updatesScrapedResults[link.url].cutoff_table.map((c: any, i: number) => (
                                                        <TableRow key={i}>
                                                          <TableCell className="text-xs py-1">{c.category}</TableCell>
                                                          <TableCell className="text-xs py-1 font-medium">{c.marks}</TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            )}

                                            {/* Official Links */}
                                            {updatesScrapedResults[link.url]?.official_links?.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-medium mb-1">Official Links</h5>
                                                <div className="flex flex-wrap gap-1">
                                                  {updatesScrapedResults[link.url].official_links.map((ol: any, i: number) => (
                                                    <a key={i} href={ol.url} target="_blank" rel="noopener noreferrer">
                                                      <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-green-50 border-green-200 text-green-700">
                                                        <ExternalLink className="h-2.5 w-2.5 mr-1" />{ol.text.slice(0, 40)}
                                                      </Badge>
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {/* Raw JSON */}
                                            <div className="max-h-[300px] w-full overflow-auto rounded-md border bg-secondary/50 p-3">
                                              <pre className="text-[11px] font-mono w-max">
                                                {JSON.stringify(updatesScrapedResults[link.url], null, 2)}
                                              </pre>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </TableBody>
                          </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section C: Stats & Run History */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Stats & Run History
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-secondary/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{govtScraper.examUpdates.length}</div>
                        <div className="text-xs text-muted-foreground">Total Updates</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-secondary/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {govtScraper.examUpdates.filter((u) => {
                            const today = new Date().toISOString().split("T")[0];
                            return u.created_at.startsWith(today);
                          }).length}
                        </div>
                        <div className="text-xs text-muted-foreground">New Today</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-secondary/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {govtScraper.examUpdates.filter((u) => {
                            const today = new Date().toISOString().split("T")[0];
                            return u.updated_at.startsWith(today) && !u.created_at.startsWith(today);
                          }).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Updated Today</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-secondary/50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {govtScraper.runLogs.filter((l) => l.errors > 0).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Runs with Errors</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent exam updates */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Recent Exam Updates</h3>
                    {govtScraper.updatesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : govtScraper.examUpdates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No exam updates scraped yet.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Scraped</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {govtScraper.examUpdates.map((update) => {
                              const isNew = Math.abs(new Date(update.created_at).getTime() - new Date(update.updated_at).getTime()) < 2000;
                              return (
                                <TableRow key={update.id}>
                                  <TableCell className="max-w-[250px]">
                                    <div className="flex items-center gap-2">
                                      <a href={update.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline line-clamp-1">
                                        {update.title}
                                      </a>
                                      {!isNew && (
                                        <Badge variant="outline" className="text-[9px] px-1 shrink-0">Updated</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px] capitalize">{update.category.replace(/_/g, " ")}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{update.status || "—"}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(update.scraped_at), "MMM d, HH:mm")}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => setUpdatesDetailView(update)}
                                      >
                                        <Eye className="h-3 w-3 mr-1" /> View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-destructive"
                                        onClick={() => govtScraper.deleteExamUpdate.mutate(update.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </div>

                  {/* Run history */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Run History</h3>
                    {govtScraper.logsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : govtScraper.runLogs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">No runs yet.</div>
                    ) : (
                      <ScrollArea className="h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Time</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Found</TableHead>
                              <TableHead>New</TableHead>
                              <TableHead>Updated</TableHead>
                              <TableHead>Errors</TableHead>
                              <TableHead>Type</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {govtScraper.runLogs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {format(new Date(log.run_at), "MMM d, HH:mm")}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px] capitalize">{(log.category || "all").replace(/_/g, " ")}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">{log.articles_found}</TableCell>
                                <TableCell className="text-sm text-green-600">{log.articles_new}</TableCell>
                                <TableCell className="text-sm text-blue-600">{log.articles_updated}</TableCell>
                                <TableCell>
                                  {log.errors > 0 ? (
                                    <Badge variant="destructive" className="text-xs">{log.errors}</Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={log.is_cron ? "secondary" : "outline"} className="text-[10px]">
                                    {log.is_cron ? "Cron" : "Manual"}
                                  </Badge>
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
            </div>
          </TabsContent>

          {/* AI Keys Tab */}
          <TabsContent value="ai-keys">
            <div className="space-y-4">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Keys</CardDescription>
                    <CardTitle className="text-2xl">{apiKeysHook.keys.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Active</CardDescription>
                    <CardTitle className="text-2xl text-green-600">{apiKeysHook.keys.filter(k => k.is_active).length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Calls</CardDescription>
                    <CardTitle className="text-2xl">{apiKeysHook.keys.reduce((s, k) => s + (k.total_calls || 0), 0)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Errors</CardDescription>
                    <CardTitle className="text-2xl text-red-500">{apiKeysHook.keys.reduce((s, k) => s + (k.total_errors || 0), 0)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card className="border-0 shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>API Keys &amp; Models</CardTitle>
                      <CardDescription>Manage AI provider keys with automatic rotation on exhaustion</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => apiKeysHook.refetch()}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => {
                        setEditingKey(null);
                        setKeyForm({ provider: "gemini", model_name: "gemini-2.5-flash", api_key: "", label: "" });
                        setKeyFormPriority(apiKeysHook.keys.length);
                        setShowAddKeyDialog(true);
                      }}>
                        <Plus className="h-4 w-4 mr-1" /> Add Key
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {apiKeysHook.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : apiKeysHook.keys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No API keys configured yet.</p>
                      <p className="text-xs mt-1">Add keys from OpenRouter, Gemini, OpenAI, or Groq to enable AI features.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-10">#</TableHead>
                            <TableHead className="text-xs">Provider</TableHead>
                            <TableHead className="text-xs">Model</TableHead>
                            <TableHead className="text-xs">Label</TableHead>
                            <TableHead className="text-xs">Key</TableHead>
                            <TableHead className="text-xs text-center">Active</TableHead>
                            <TableHead className="text-xs text-right">Calls</TableHead>
                            <TableHead className="text-xs text-right">Errors</TableHead>
                            <TableHead className="text-xs">Last Used</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apiKeysHook.keys.map((k, idx) => (
                            <TableRow key={k.id} className={!k.is_active ? "opacity-50" : ""}>
                              <TableCell className="text-xs font-mono">{k.priority}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px] capitalize">{k.provider}</Badge>
                              </TableCell>
                              <TableCell className="text-xs font-mono max-w-[140px] truncate">{k.model_name}</TableCell>
                              <TableCell className="text-xs">{k.label || "—"}</TableCell>
                              <TableCell className="text-xs font-mono">
                                <div className="flex items-center gap-1">
                                  <span className="max-w-[100px] truncate">
                                    {showKeyValues.has(k.id) ? k.api_key : `${k.api_key.slice(0, 6)}${"•".repeat(12)}`}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    onClick={() => {
                                      const next = new Set(showKeyValues);
                                      if (next.has(k.id)) next.delete(k.id); else next.add(k.id);
                                      setShowKeyValues(next);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    onClick={() => { navigator.clipboard.writeText(k.api_key); toast({ title: "Copied!" }); }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={k.is_active}
                                  onCheckedChange={(checked) => apiKeysHook.toggleActive.mutate({ id: k.id, is_active: checked })}
                                />
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">{k.total_calls || 0}</TableCell>
                              <TableCell className="text-xs text-right font-mono text-red-500">{k.total_errors || 0}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {k.last_used_at ? format(new Date(k.last_used_at), "MMM d, HH:mm") : "Never"}
                              </TableCell>
                              <TableCell>
                                {k.last_error ? (
                                  <Badge variant="destructive" className="text-[9px] max-w-[120px] truncate" title={k.last_error}>
                                    {k.last_error.slice(0, 20)}
                                  </Badge>
                                ) : k.total_calls > 0 ? (
                                  <Badge className="text-[9px] bg-green-100 text-green-700">OK</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                                    setEditingKey(k);
                                    setKeyForm({ provider: k.provider, model_name: k.model_name, api_key: k.api_key, label: k.label || "" });
                                    setKeyFormPriority(k.priority);
                                    setShowAddKeyDialog(true);
                                  }}>
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteKeyId(k.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* How rotation works info */}
                  <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
                    <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> How Key Rotation Works</h4>
                    <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      <li>Keys are tried in <strong>priority order</strong> (lowest number first).</li>
                      <li>If a key returns 429 (rate limit) or 402 (quota exhausted), the next key is tried automatically.</li>
                      <li>Server errors (5xx) also trigger rotation to the next key.</li>
                      <li>Usage stats (calls, errors, last used) are tracked per key.</li>
                      <li>Supports <strong>Gemini, OpenRouter, OpenAI, and Groq</strong> providers — mix and match freely.</li>
                      <li>Falls back to <code>GEMINI_API_KEY</code> env vars if no DB keys are configured.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add/Edit API Key Dialog */}
      <Dialog open={showAddKeyDialog} onOpenChange={(open) => { if (!open) { setShowAddKeyDialog(false); setEditingKey(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Edit API Key" : "Add API Key"}</DialogTitle>
            <DialogDescription>Configure a provider API key with model for rotation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Select value={keyForm.provider} onValueChange={(val) => {
                const models = PROVIDER_PRESETS[val]?.models || [];
                setKeyForm({ ...keyForm, provider: val, model_name: models[0] || "" });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PROVIDER_PRESETS).map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={keyForm.model_name} onValueChange={(val) => setKeyForm({ ...keyForm, model_name: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(PROVIDER_PRESETS[keyForm.provider]?.models || []).map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Or type a custom model name..."
                value={keyForm.model_name}
                onChange={(e) => setKeyForm({ ...keyForm, model_name: e.target.value })}
                className="text-xs mt-1"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                placeholder="sk-... or AIza..."
                value={keyForm.api_key}
                onChange={(e) => setKeyForm({ ...keyForm, api_key: e.target.value })}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Label (optional)</Label>
                <Input
                  placeholder="e.g. Personal Key 1"
                  value={keyForm.label || ""}
                  onChange={(e) => setKeyForm({ ...keyForm, label: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority (lower = first)</Label>
                <Input
                  type="number"
                  min={0}
                  value={keyFormPriority}
                  onChange={(e) => setKeyFormPriority(parseInt(e.target.value) || 0)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddKeyDialog(false); setEditingKey(null); }}>Cancel</Button>
            <Button
              disabled={!keyForm.api_key || !keyForm.model_name || apiKeysHook.addKey.isPending || apiKeysHook.updateKey.isPending}
              onClick={() => {
                if (editingKey) {
                  apiKeysHook.updateKey.mutate({
                    id: editingKey.id,
                    provider: keyForm.provider,
                    model_name: keyForm.model_name,
                    api_key: keyForm.api_key,
                    label: keyForm.label || null,
                    priority: keyFormPriority,
                  }, {
                    onSuccess: () => { setShowAddKeyDialog(false); setEditingKey(null); },
                  });
                } else {
                  apiKeysHook.addKey.mutate({
                    ...keyForm,
                    priority: keyFormPriority,
                  }, {
                    onSuccess: () => { setShowAddKeyDialog(false); },
                  });
                }
              }}
            >
              {(apiKeysHook.addKey.isPending || apiKeysHook.updateKey.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingKey ? "Update" : "Add Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete API Key Confirm */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => { if (!open) setDeleteKeyId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this key from rotation. Edge functions will no longer use it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (deleteKeyId) {
                  apiKeysHook.deleteKey.mutate(deleteKeyId, { onSuccess: () => setDeleteKeyId(null) });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exam Update Detail Dialog */}
      <Dialog open={!!updatesDetailView} onOpenChange={(open) => { if (!open) setUpdatesDetailView(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{updatesDetailView?.title}</DialogTitle>
          </DialogHeader>
          {updatesDetailView && (
            <div className="space-y-4 py-2">
              {/* Meta info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-secondary/50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Category</div>
                  <div className="text-sm font-medium capitalize">{updatesDetailView.category.replace(/_/g, " ")}</div>
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Status</div>
                  <div className="text-sm font-medium">{updatesDetailView.status || "—"}</div>
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Published</div>
                  <div className="text-sm font-medium">{updatesDetailView.published_date || "—"}</div>
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">Scraped</div>
                  <div className="text-sm font-medium">{format(new Date(updatesDetailView.scraped_at), "MMM d, HH:mm")}</div>
                </div>
              </div>

              {/* Summary */}
              {updatesDetailView.summary && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Summary</h4>
                  <p className="text-xs text-muted-foreground">{updatesDetailView.summary}</p>
                </div>
              )}

              {/* Important Dates */}
              {updatesDetailView.important_dates?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Important Dates</h4>
                  <div className="rounded-md border overflow-auto max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Event</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {updatesDetailView.important_dates.map((d: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{d.event}</TableCell>
                            <TableCell className="text-xs font-medium">{d.date}</TableCell>
                            <TableCell className="text-xs">{d.status || "—"}</TableCell>
                            <TableCell>
                              {d.link ? (
                                <a href={d.link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 text-primary" />
                                </a>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Overview */}
              {updatesDetailView.overview?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Overview</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {updatesDetailView.overview.map((item: any, i: number) => (
                      <div key={i} className="flex gap-2 bg-secondary/30 rounded px-3 py-2">
                        <span className="text-xs text-muted-foreground min-w-[80px]">{item.field}</span>
                        <span className="text-xs font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Links */}
              {updatesDetailView.download_links?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Download Links</h4>
                  <div className="space-y-1">
                    {updatesDetailView.download_links.map((dl: any, i: number) => (
                      <a key={i} href={dl.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        {dl.text}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {updatesDetailView.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {updatesDetailView.tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              )}

              {/* Source link */}
              <div className="pt-2 border-t">
                <a href={updatesDetailView.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Open source article
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Configure Telegram Channel Dialog */}
      <Dialog open={showTelegramAddChannelDialog} onOpenChange={setShowTelegramAddChannelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Telegram Channel</DialogTitle>
            <DialogDescription>
              Connect a bot and chat ID to a job sector.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="chan-name">Channel Name / Alias</Label>
              <Input
                id="chan-name"
                placeholder="e.g. UPSC Jobs Channel"
                value={newTelegramChannelForm.name}
                onChange={(e) => setNewTelegramChannelForm({ ...newTelegramChannelForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chan-sector">Mapped Job Sector</Label>
              <Select
                value={newTelegramChannelForm.sector}
                onValueChange={(val) => setNewTelegramChannelForm({ ...newTelegramChannelForm, sector: val })}
              >
                <SelectTrigger id="chan-sector">
                  <SelectValue placeholder="Sector" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {allUniqueSectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot-token">Telegram Bot Token</Label>
              <Input
                id="bot-token"
                type="password"
                placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx"
                value={newTelegramChannelForm.bot_token}
                onChange={(e) => setNewTelegramChannelForm({ ...newTelegramChannelForm, bot_token: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-id">Telegram Channel / Chat ID</Label>
              <Input
                id="chat-id"
                placeholder="e.g. @upscjobalerts or -100123456789"
                value={newTelegramChannelForm.channel_id}
                onChange={(e) => setNewTelegramChannelForm({ ...newTelegramChannelForm, channel_id: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                For public channels, use their @handle. For private channels, use their numerical ID starting with -100.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTelegramAddChannelDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTelegramChannel}>
              Save Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Facebook Page Dialog */}
      <Dialog open={showFacebookAddPageDialog} onOpenChange={setShowFacebookAddPageDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Facebook Page</DialogTitle>
            <DialogDescription>
              Connect a page ID and page access token to a job sector.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fb-page-name">Page Name / Alias</Label>
              <Input
                id="fb-page-name"
                placeholder="e.g. UPSC Jobs Page"
                value={newFacebookPageForm.name}
                onChange={(e) => setNewFacebookPageForm({ ...newFacebookPageForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-page-sector">Mapped Job Sector</Label>
              <Select
                value={newFacebookPageForm.sector}
                onValueChange={(val) => setNewFacebookPageForm({ ...newFacebookPageForm, sector: val })}
              >
                <SelectTrigger id="fb-page-sector">
                  <SelectValue placeholder="Sector" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {allUniqueSectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-page-token">Facebook Page Access Token</Label>
              <Input
                id="fb-page-token"
                type="password"
                placeholder="Page Access Token from Graph API"
                value={newFacebookPageForm.access_token}
                onChange={(e) => setNewFacebookPageForm({ ...newFacebookPageForm, access_token: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-page-id">Facebook Page ID</Label>
              <Input
                id="fb-page-id"
                placeholder="e.g. 104847385930193"
                value={newFacebookPageForm.page_id}
                onChange={(e) => setNewFacebookPageForm({ ...newFacebookPageForm, page_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFacebookAddPageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFacebookPage}>
              Save Page
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

      {/* Bulk Delete Expired Jobs Confirmation AlertDialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Delete Expired Jobs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {selectedExpiredJobs.size} selected expired jobs? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteExpiredJobs}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

      {/* Vacancy Checker Dialog */}
      <Dialog open={showVacancyChecker} onOpenChange={(open) => { if (!open) setShowVacancyChecker(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Job Vacancy Mismatch Detector
            </DialogTitle>
            <DialogDescription>
              The following jobs have vacancy counts mentioned in their title that mismatch with the vacancies stored in the database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-4 border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[50px] p-4">
                    <Checkbox
                      checked={
                        vacancyMismatches.length > 0 &&
                        selectedVacancyUpdates.size === vacancyMismatches.length
                      }
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedVacancyUpdates(new Set(vacancyMismatches.map(m => m.jobId)));
                        } else {
                          setSelectedVacancyUpdates(new Set());
                        }
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead className="text-center w-[120px]">Stored Vacancy</TableHead>
                  <TableHead className="text-center w-[120px]">Title Vacancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacancyMismatches.map((item) => (
                  <TableRow key={item.jobId} className="hover:bg-muted/50">
                    <TableCell className="p-4">
                      <Checkbox
                        checked={selectedVacancyUpdates.has(item.jobId)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedVacancyUpdates);
                          if (checked) {
                            next.add(item.jobId);
                          } else {
                            next.delete(item.jobId);
                          }
                          setSelectedVacancyUpdates(next);
                        }}
                        aria-label={`Select job ${item.jobTitle}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-xs sm:text-sm">
                      {item.jobTitle}
                    </TableCell>
                    <TableCell className="text-center text-xs sm:text-sm font-semibold text-muted-foreground">
                      {item.storedVacancy !== null ? item.storedVacancy : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs sm:text-sm font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
                      {item.extractedVacancy}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {selectedVacancyUpdates.size} of {vacancyMismatches.length} job(s) selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowVacancyChecker(false)}>
                Cancel
              </Button>
              <Button
                disabled={selectedVacancyUpdates.size === 0 || updatingVacancies}
                onClick={handleApproveVacancyChanges}
              >
                {updatingVacancies ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Approve Selected Changes"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
