import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoColor from "@/assets/logo-color.png";
import logoWhite from "@/assets/logo-white.png";
import { ArrowLeft, Loader2, Target, User, Check, AlertTriangle, ChevronDown, ChevronUp, Calendar, GraduationCap, Briefcase, IndianRupee, MapPin, Award, SkipForward, FlaskConical, Settings, Wrench, Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { JobCard } from "@/components/JobCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Profile, useProfile } from "@/hooks/useProfile";
import { EducationQualification, useEducation } from "@/hooks/useEducation";
import { useJobs } from "@/hooks/useJobs";
import { useExams } from "@/hooks/useExams";
import { Job } from "@/types/job";
import { INDIAN_STATES, EXAM_SECTORS } from "@/constants/filters";
import { QualStream, matchAndSort, getEducationRank, getQualLabel, getQualStreamLabel, getSkillLabel, inferQualificationStream, MatchPreferences, MatchedJob, getBestJobLocation } from "@/lib/jobMatcher";
import { isAllIndiaLocationText, resolveStateFromLocationText } from "@/lib/jobUtils";
import { hybridRecommend, qualificationToTag, HybridMatchedJob } from "@/lib/hybridScorer";
import { cn } from "@/lib/utils";
import { useSmartBack } from "@/hooks/useSmartBack";
import { toast } from "sonner";

// ── Wizard Step Definitions ─────────────────────────────────────────────

interface WizardStep {
  id: string;
  icon: React.ElementType;
  question: string;
  subtitle: string;
  suggestions: { label: string; value: string }[];
  multiSelect?: boolean;
  showInput?: "date";
  conditionalOn?: (answers: Record<string, string | string[]>) => boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "dob",
    icon: Calendar,
    question: "What's your age range?",
    subtitle: "Helps filter jobs by age eligibility",
    suggestions: [
      { label: "18-20", value: "18-20" },
      { label: "21-25", value: "21-25" },
      { label: "26-30", value: "26-30" },
      { label: "31-35", value: "31-35" },
      { label: "36-40", value: "36-40" },
      { label: "40+", value: "40+" },
    ],
    showInput: "date",
  },
  {
    id: "qualification",
    icon: GraduationCap,
    question: "What's your highest qualification?",
    subtitle: "We'll only show jobs you're qualified for",
    suggestions: [
      { label: "10th Pass", value: "10th" },
      { label: "12th Pass", value: "12th" },
      { label: "Diploma / ITI", value: "diploma" },
      { label: "Graduate", value: "graduation" },
      { label: "Post Graduate", value: "post_graduation" },
      { label: "PhD", value: "phd" },
    ],
  },
  {
    id: "stream",
    icon: FlaskConical,
    question: "What's your degree stream?",
    subtitle: "BSc ≠ B.Tech — we'll match the right jobs",
    suggestions: [
      { label: "Arts / Science / Commerce", value: "general" },
      { label: "Engineering (B.Tech, B.E, M.Tech)", value: "engineering" },
      { label: "Medical (MBBS, BDS)", value: "medical" },
      { label: "Teaching (B.Ed, TET)", value: "teaching" },
      { label: "Law (LLB)", value: "law" },
      { label: "Nursing", value: "nursing" },
      { label: "Pharmacy", value: "pharmacy" },
    ],
    // Only show if user picked graduation or above
    conditionalOn: (ans) => {
      const q = ans.qualification as string;
      return q === "graduation" || q === "post_graduation" || q === "phd";
    },
  },
  {
    id: "skills",
    icon: Wrench,
    question: "Do you have any extra skills?",
    subtitle: "Jobs needing these skills will be prioritized",
    multiSelect: true,
    suggestions: [
      { label: "Stenography (Shorthand)", value: "stenography" },
      { label: "Computer (CCC / O Level)", value: "computer" },
      { label: "Typing — Hindi", value: "typing_hindi" },
      { label: "Typing — English", value: "typing_english" },
      { label: "Driving License", value: "driving" },
      { label: "Swimming", value: "swimming" },
      { label: "Physical Fitness (Running)", value: "physical_fitness" },
    ],
  },
  {
    id: "sectors",
    icon: Briefcase,
    question: "Which sectors interest you?",
    subtitle: "Select one or more — we'll prioritize these",
    multiSelect: true,
    suggestions: EXAM_SECTORS.map((s) => ({ label: s, value: s })),
  },
  {
    id: "salary",
    icon: IndianRupee,
    question: "What salary range do you expect?",
    subtitle: "Jobs outside this range will be hidden",
    suggestions: [
      { label: "Under ₹20k", value: "0-20000" },
      { label: "₹20k - ₹50k", value: "20000-50000" },
      { label: "₹50k - ₹1L", value: "50000-100000" },
      { label: "₹1L - ₹2L", value: "100000-200000" },
      { label: "Any Salary", value: "any" },
    ],
  },
  {
    id: "location",
    icon: MapPin,
    question: "Preferred location(s)?",
    subtitle: "Matching jobs appear first — others still shown below",
    multiSelect: true,
    suggestions: [
      { label: "All India", value: "All India" },
      { label: "Delhi", value: "Delhi" },
      { label: "Uttar Pradesh", value: "Uttar Pradesh" },
      { label: "Maharashtra", value: "Maharashtra" },
      { label: "Bihar", value: "Bihar" },
      { label: "Rajasthan", value: "Rajasthan" },
      { label: "West Bengal", value: "West Bengal" },
      { label: "Madhya Pradesh", value: "Madhya Pradesh" },
    ],
  },
  {
    id: "grade",
    icon: Award,
    question: "Job grade preference?",
    subtitle: "Select one or more government job classifications",
    multiSelect: true,
    suggestions: [
      { label: "Group A (Officers)", value: "Group A" },
      { label: "Group B (Gazetted)", value: "Group B" },
      { label: "Group C (Clerical / SSC)", value: "Group C" },
      { label: "Group D (MTS / Support)", value: "Group D" },
    ],
  },
];

// ── Age Range Helpers ───────────────────────────────────────────────────

function ageRangeToMidAge(range: string): number {
  switch (range) {
    case "18-20": return 19;
    case "21-25": return 23;
    case "26-30": return 28;
    case "31-35": return 33;
    case "36-40": return 38;
    case "40+": return 45;
    default: return 25;
  }
}

function ageToDob(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().split("T")[0];
}

function parseSalaryRange(val: string): [number | null, number | null] {
  if (val === "any") return [null, null];
  const [min, max] = val.split("-").map(Number);
  return [min || null, max || null];
}

const LOCALSTORAGE_KEY = "jfy_preferences";
const COMPLETION_KEY = "jfy_preferences_completed";
const AGE_RANGE_VALUES = new Set(["18-20", "21-25", "26-30", "31-35", "36-40", "40+"]);

function getStorageKey(userId: string) {
  return `${LOCALSTORAGE_KEY}:${userId}`;
}

function getCompletionKey(userId: string) {
  return `${COMPLETION_KEY}:${userId}`;
}

function readStoredAnswers(userId: string | null | undefined): Record<string, string | string[]> {
  if (!userId) return {};

  try {
    const saved = localStorage.getItem(getStorageKey(userId));
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.warn("Failed to read Jobs For You preferences:", error);
    return {};
  }
}

function hasStoredAnswers(userId: string | null | undefined): boolean {
  if (!userId) return false;

  try {
    return !!localStorage.getItem(getStorageKey(userId));
  } catch (error) {
    console.warn("Failed to check Jobs For You preferences:", error);
    return false;
  }
}

function hasCompletedPreferences(userId: string | null | undefined): boolean {
  if (!userId) return false;

  try {
    return localStorage.getItem(getCompletionKey(userId)) === "true";
  } catch (error) {
    console.warn("Failed to check Jobs For You completion flag:", error);
    return false;
  }
}

function persistAnswers(userId: string | null | undefined, answers: Record<string, string | string[]>) {
  if (!userId) return;

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(answers));
  } catch (error) {
    console.warn("Failed to save Jobs For You preferences:", error);
  }
}

function markPreferencesCompleted(userId: string | null | undefined) {
  if (!userId) return;

  try {
    localStorage.setItem(getCompletionKey(userId), "true");
  } catch (error) {
    console.warn("Failed to save Jobs For You completion flag:", error);
  }
}

function normalizeDobAnswer(dob: string | string[] | undefined): string | null {
  if (typeof dob !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  if (AGE_RANGE_VALUES.has(dob)) return ageToDob(ageRangeToMidAge(dob));
  return null;
}

function normalizeSkillInput(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, " ");
}

function getHighestEducation(education: EducationQualification[]): EducationQualification | null {
  if (education.length === 0) return null;

  return education.reduce<EducationQualification | null>((highest, current) => {
    if (!highest) return current;
    return getEducationRank(current.qualification_type) > getEducationRank(highest.qualification_type)
      ? current
      : highest;
  }, null);
}

function getVisibleSteps(
  profile: Profile | null | undefined,
  education: EducationQualification[],
  answers: Record<string, string | string[]>,
  editMode: boolean
) {
  return WIZARD_STEPS.filter((step) => {
    if (step.conditionalOn && !step.conditionalOn(answers)) return false;

    switch (step.id) {
      case "dob":
        return !profile?.date_of_birth;
      case "qualification":
      case "stream":
        return education.length === 0;
      case "sectors":
        return editMode || !profile?.preferred_sectors || profile.preferred_sectors.length === 0;
      default:
        return true;
    }
  });
}

// ── Main Component ──────────────────────────────────────────────────────

export default function Recommendations() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, upsertProfile } = useProfile();
  const { education, isLoading: educationLoading, addEducation } = useEducation();
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  // Collected answers — try to load from localStorage first
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [wizardComplete, setWizardComplete] = useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [showPartial, setShowPartial] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputValue, setDateInputValue] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [sectorQuery, setSectorQuery] = useState("");
  const [customSkillInput, setCustomSkillInput] = useState("");
  const highestEducation = useMemo(() => getHighestEducation(education), [education]);
  const inferredEducationStream = useMemo<QualStream>(
    () => inferQualificationStream(highestEducation?.qualification_name, highestEducation?.qualification_type),
    [highestEducation]
  );

  // Determine which steps need to be shown (filter out steps with unmet conditions + known data)
  const stepsToShow = useMemo(() => {
    return getVisibleSteps(profile, education, answers, editMode);
  }, [profile, education, answers, editMode]);

  // Current step index
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Reset date input state when moving between steps
  useEffect(() => setShowDateInput(false), [currentStepIndex]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setAnswers({});
      setWizardComplete(false);
      setPreferencesHydrated(true);
      return;
    }

    const storedAnswers = readStoredAnswers(user.id);
    const hasSavedPreferences = hasCompletedPreferences(user.id) || hasStoredAnswers(user.id);

    setAnswers(storedAnswers);
    setWizardComplete(hasSavedPreferences);
    setPreferencesHydrated(true);
  }, [authLoading, user?.id]);

  // Check if wizard should be skipped entirely (all data present and not editing)
  useEffect(() => {
    if (!preferencesHydrated) return;

    if (!profileLoading && !educationLoading && !editMode) {
      if (stepsToShow.length === 0) {
        setWizardComplete(true);
      }
    }
  }, [stepsToShow, profileLoading, educationLoading, editMode, preferencesHydrated]);

  // Pre-fill answers from profile
  useEffect(() => {
    if (profile && !editMode) {
      const prefill: Record<string, string | string[]> = {};
      if (profile.date_of_birth) prefill.dob = profile.date_of_birth;
      if (profile.preferred_sectors && profile.preferred_sectors.length > 0) {
        prefill.sectors = profile.preferred_sectors;
      }
      if (highestEducation) {
        prefill.qualification = highestEducation.qualification_type;
        prefill.stream = inferredEducationStream;
      }
      setAnswers((prev) => ({ ...prev, ...prefill }));
    }
  }, [profile, highestEducation, inferredEducationStream, editMode]);

  const currentStep = stepsToShow[currentStepIndex] || null;

  const handleSaveEditMode = async () => {
    try {
      if (!user) return;
      persistAnswers(user.id, answers);
      markPreferencesCompleted(user.id);

      const updates: Partial<Profile> = {};
      const normalizedDob = normalizeDobAnswer(answers.dob);
      if (!profile?.date_of_birth && normalizedDob) updates.date_of_birth = normalizedDob;
      if (Array.isArray(answers.sectors)) updates.preferred_sectors = answers.sectors;
      
      if (Object.keys(updates).length > 0) {
        await upsertProfile.mutateAsync(updates);
      }

      const hasQual = answers.qualification && typeof answers.qualification === "string";
      if (hasQual && education.length === 0) {
        await addEducation.mutateAsync({
          qualification_type: answers.qualification as string,
        });
      }

      setEditMode(false);
      setWizardComplete(true);
      toast.success("Preferences saved successfully!");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save preferences.");
    }
  };

  // Complete wizard and save data
  const completeWizard = useCallback(async () => {
    setWizardComplete(true);
    setEditMode(false);

    // Persist to localStorage so wizard won't show again
    persistAnswers(user?.id, answers);
    markPreferencesCompleted(user?.id);

    // Save to DB in background
    try {
      const profileUpdates: Partial<Profile> = {};

      // Save DOB
      const normalizedDob = normalizeDobAnswer(answers.dob);
      if (normalizedDob) {
        profileUpdates.date_of_birth = normalizedDob;
      }

      // Save sectors
      if (answers.sectors && Array.isArray(answers.sectors) && answers.sectors.length > 0) {
        profileUpdates.preferred_sectors = answers.sectors;
      }

      if (Object.keys(profileUpdates).length > 0 && user) {
        await upsertProfile.mutateAsync(profileUpdates);
      }

      // Save qualification if new
      if (answers.qualification && typeof answers.qualification === "string" && education.length === 0 && user) {
        await addEducation.mutateAsync({
          qualification_type: answers.qualification,
        });
      }
    } catch {
      // Non-critical
    }
  }, [answers, user, education, upsertProfile, addEducation]);

  // Advance to next step or complete
  const advanceStep = useCallback(() => {
    // Find the next valid step (skip conditional steps whose condition isn't met)
    let nextIndex = currentStepIndex + 1;
    while (nextIndex < stepsToShow.length) {
      const nextStep = stepsToShow[nextIndex];
      if (!nextStep.conditionalOn || nextStep.conditionalOn(answers)) {
        break;
      }
      nextIndex++;
    }
    if (nextIndex < stepsToShow.length) {
      setCurrentStepIndex(nextIndex);
    } else {
      completeWizard();
    }
  }, [currentStepIndex, stepsToShow, answers, completeWizard]);

  const advanceStepRef = useRef(advanceStep);
  useEffect(() => { advanceStepRef.current = advanceStep; }, [advanceStep]);

  // Handle selecting a suggestion
  const handleSelect = useCallback((stepId: string, value: string, multi?: boolean) => {
    if (multi) {
      setAnswers((prev) => {
        const existing = (prev[stepId] as string[]) || [];
        const updated = existing.includes(value)
          ? existing.filter((v) => v !== value)
          : [...existing, value];
        return { ...prev, [stepId]: updated };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [stepId]: value }));
      // Auto-advance for single-select after a brief delay
      setTimeout(() => advanceStepRef.current(), 300);
    }
  }, []);

  // Handle date input
  const handleDateSubmit = useCallback(() => {
    if (dateInputValue) {
      setAnswers((prev) => ({ ...prev, dob: dateInputValue }));
      setTimeout(() => advanceStepRef.current(), 300);
    }
  }, [dateInputValue]);

  // Multi-select confirm (sectors)
  const handleMultiConfirm = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  const handleAddCustomSkill = useCallback(() => {
    const normalizedSkill = normalizeSkillInput(customSkillInput);
    if (!normalizedSkill) return;

    setAnswers((prev) => {
      const existingSkills = Array.isArray(prev.skills) ? prev.skills : [];
      if (existingSkills.includes(normalizedSkill)) return prev;
      return { ...prev, skills: [...existingSkills, normalizedSkill] };
    });
    setCustomSkillInput("");
  }, [customSkillInput]);

  // Skip current step
  const handleSkip = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  // Build preferences from answers (uses new MatchPreferences interface)
  const preferences: MatchPreferences = useMemo(() => {
    let dob: string | null = null;
    if (answers.dob && typeof answers.dob === "string") {
      if (answers.dob.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dob = answers.dob;
      } else {
        dob = ageToDob(ageRangeToMidAge(answers.dob));
      }
    } else if (profile?.date_of_birth) {
      dob = profile.date_of_birth;
    }

    // Qualification type
    let qualificationType: string | null = null;
    if (answers.qualification && typeof answers.qualification === "string") {
      qualificationType = answers.qualification;
    } else if (highestEducation) {
      qualificationType = highestEducation.qualification_type;
    }

    const qualificationStream = (
      (typeof answers.stream === "string" ? answers.stream : null) ||
      inferredEducationStream ||
      "general"
    ) as QualStream;

    const sectors = (answers.sectors as string[]) || profile?.preferred_sectors || [];

    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    if (answers.salary && typeof answers.salary === "string") {
      [salaryMin, salaryMax] = parseSalaryRange(answers.salary);
    }

    const locations = (answers.location as string[]) || [];
    const filteredLocations = locations.filter((l) => l !== "All India");
    const gradesRaw = (answers.grade as string[]) || [];
    const grades = gradesRaw.filter((g) => g !== "any");
    const skills = (answers.skills as string[]) || [];

    return {
      dob,
      qualificationType,
      qualificationStream,
      qualificationName: highestEducation?.qualification_name || null,
      sectors,
      salaryMin,
      salaryMax,
      locations: filteredLocations,
      grades,
      skills,
      category: profile?.category || null,
      gender: profile?.gender || null,
    };
  }, [answers, profile, highestEducation, inferredEducationStream]);

  // Match & sort
  const matchedJobs: MatchedJob[] = useMemo(() => {
    if (!jobs) return [];
    return matchAndSort(jobs, preferences);
  }, [jobs, preferences]);

  // Hybrid scoring: re-rank eligible jobs using exam intent + tag overlap
  const { userExams } = useExams();
  const hybridMatchedJobs: HybridMatchedJob[] = useMemo(() => {
    const eligible = matchedJobs.filter((m) => m.eligibility.eligible);
    const qualTag = qualificationToTag(preferences.qualificationType);
    return hybridRecommend(
      eligible,
      (answers.sectors as string[]) || profile?.preferred_sectors || [],
      userExams,
      qualTag,
      eligible.length // don't limit — Recommendations shows all
    );
  }, [matchedJobs, preferences, answers.sectors, profile?.preferred_sectors, userExams]);

  // Set of job IDs that match tracked exams (for badge display)
  const examMatchedIds = useMemo(() => {
    return new Set(hybridMatchedJobs.filter((h) => h.matchesTrackedExam).map((h) => h.job.id));
  }, [hybridMatchedJobs]);

  // Four-tier classification (use hybrid-ranked order for eligible jobs)
  const canApplyJobs = useMemo(() => hybridMatchedJobs.filter((m) => m.eligibility.skillsMissing.length === 0), [hybridMatchedJobs]);

  // Split canApply into preferred location -> all India -> other state buckets
  const selectedLocations = useMemo(() => {
    const locs = (answers.location as string[]) || [];
    return locs.filter((l) => l !== "All India");
  }, [answers.location]);

  const hasPreferredLocations = selectedLocations.length > 0;

  const isAllIndiaJob = useCallback((job: Job) => {
    const bestLocation = getBestJobLocation(job);
    const resolvedState = resolveStateFromLocationText(bestLocation) || resolveStateFromLocationText(job.location);
    if (resolvedState) return false;
    return isAllIndiaLocationText(bestLocation) || isAllIndiaLocationText(job.location);
  }, []);

  const matchesSelectedLocation = useCallback((job: Job) => {
    const bestLocation = getBestJobLocation(job);
    const resolvedState = resolveStateFromLocationText(bestLocation) || resolveStateFromLocationText(job.location);

    return selectedLocations.some((selectedState) => {
      const normalizedSelected = selectedState.toLowerCase();
      return (
        bestLocation.toLowerCase().includes(normalizedSelected) ||
        (resolvedState ? resolvedState.toLowerCase() === normalizedSelected : false)
      );
    });
  }, [selectedLocations]);

  const preferredLocationJobs = useMemo(() => {
    if (!hasPreferredLocations) return canApplyJobs;
    return canApplyJobs.filter(({ job }) => matchesSelectedLocation(job));
  }, [canApplyJobs, hasPreferredLocations, matchesSelectedLocation]);

  const allIndiaJobs = useMemo(() => {
    if (!hasPreferredLocations) return [];
    return canApplyJobs.filter(({ job }) => !matchesSelectedLocation(job) && isAllIndiaJob(job));
  }, [canApplyJobs, hasPreferredLocations, isAllIndiaJob, matchesSelectedLocation]);

  const otherStateJobs = useMemo(() => {
    if (!hasPreferredLocations) return [];
    return canApplyJobs.filter(
      ({ job }) => !matchesSelectedLocation(job) && !isAllIndiaJob(job)
    );
  }, [canApplyJobs, hasPreferredLocations, isAllIndiaJob, matchesSelectedLocation]);

  const skillsNeededJobs = useMemo(() => hybridMatchedJobs.filter((m) => m.eligibility.skillsMissing.length > 0), [hybridMatchedJobs]);
  const preferredLocationSkillsNeededJobs = useMemo(() => {
    if (!hasPreferredLocations) return [];
    return skillsNeededJobs.filter(({ job }) => matchesSelectedLocation(job));
  }, [hasPreferredLocations, matchesSelectedLocation, skillsNeededJobs]);

  const allIndiaSkillsNeededJobs = useMemo(() => {
    if (!hasPreferredLocations) return skillsNeededJobs;
    return skillsNeededJobs.filter(({ job }) => !matchesSelectedLocation(job) && isAllIndiaJob(job));
  }, [hasPreferredLocations, matchesSelectedLocation, skillsNeededJobs, isAllIndiaJob]);

  const otherStateSkillsNeededJobs = useMemo(() => {
    if (!hasPreferredLocations) return [];
    return skillsNeededJobs.filter(({ job }) => !matchesSelectedLocation(job) && !isAllIndiaJob(job));
  }, [hasPreferredLocations, matchesSelectedLocation, skillsNeededJobs, isAllIndiaJob]);

  const notEligibleJobs = useMemo(() => matchedJobs.filter((m) => !m.eligibility.eligible), [matchedJobs]);
  const visibleEditSteps = useMemo(() => getVisibleSteps(profile, education, answers, true), [profile, education, answers]);
  const filteredSectorSuggestions = useMemo(
    () => EXAM_SECTORS.filter((sector) => sector.toLowerCase().includes(sectorQuery.toLowerCase())),
    [sectorQuery]
  );
  const filteredLocationSuggestions = useMemo(
    () => INDIAN_STATES.filter((state) => state.toLowerCase().includes(locationQuery.toLowerCase())),
    [locationQuery]
  );

  const isLoading = authLoading || profileLoading || educationLoading || jobsLoading || !preferencesHydrated;

  // ── Auth Gate ─────────────────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="font-display font-bold text-lg text-foreground">Jobs For You</h1>
          </div>
        </header>
        <div className="text-center py-16 px-5">
          <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <User className="h-10 w-10 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">Login Required</h3>
          <p className="text-sm text-muted-foreground mb-6">Login to get personalized job recommendations based on your profile</p>
          <Link to="/auth"><Button>Login / Sign Up</Button></Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading && !wizardComplete) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="font-display font-bold text-lg text-foreground">Jobs For You</h1>
          </div>
        </header>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Edit Settings Mode (Table View) ────────────────────────────────────
  if (!wizardComplete && editMode) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              setEditMode(false);
              setWizardComplete(true);
            }} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="font-display font-bold text-lg text-foreground">Edit Preferences</h1>
          </div>
        </header>

        <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
          {profile?.date_of_birth && (
            <Card className="border-border/50 bg-secondary/30">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Age eligibility is using your saved date of birth</p>
                  <p className="text-xs text-muted-foreground mt-1">If this needs to change, update it from your profile.</p>
                </div>
                <Link to="/edit-profile">
                  <Button variant="outline" size="sm">Edit Profile</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {highestEducation && (
            <Card className="border-border/50 bg-secondary/30">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Using your highest saved education automatically</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getQualLabel(highestEducation.qualification_type)}
                    {" · "}
                    {getQualStreamLabel(inferredEducationStream)}
                    {highestEducation.qualification_name ? ` · ${highestEducation.qualification_name}` : ""}
                  </p>
                </div>
                <Link to="/edit-education">
                  <Button variant="outline" size="sm">Edit Education</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6 bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
            {visibleEditSteps.map((step) => {
              const StepIcon = step.icon;
              const isMulti = step.multiSelect;
              const selectedValues = isMulti ? ((answers[step.id] as string[]) || []) : null;
              const selectedSingle = !isMulti ? (answers[step.id] as string) : null;
              const options = step.id === "location"
                ? filteredLocationSuggestions.map((state) => ({ label: state, value: state }))
                : step.id === "sectors"
                  ? filteredSectorSuggestions.map((sector) => ({ label: sector, value: sector }))
                  : step.suggestions;

              return (
                <div key={step.id} className="space-y-3 pb-6 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <StepIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{step.question}</h3>
                      <p className="text-xs text-muted-foreground">{step.subtitle}</p>
                    </div>
                  </div>

                  {(step.id === "location" || step.id === "sectors") && (
                    <div className="relative">
                      <Input
                        value={step.id === "location" ? locationQuery : sectorQuery}
                        onChange={(event) => {
                          if (step.id === "location") setLocationQuery(event.target.value);
                          else setSectorQuery(event.target.value);
                        }}
                        placeholder={step.id === "location" ? "Search all Indian states and UTs" : "Search sectors"}
                        className="h-10 pr-9"
                      />
                      {(step.id === "location" ? locationQuery : sectorQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (step.id === "location") setLocationQuery("");
                            else setSectorQuery("");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {step.id === "skills" && (
                    <div className="flex gap-2">
                      <Input
                        value={customSkillInput}
                        onChange={(event) => setCustomSkillInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddCustomSkill();
                          }
                        }}
                        placeholder="Type any extra skill and press Add"
                        className="h-10"
                      />
                      <Button type="button" variant="outline" onClick={handleAddCustomSkill} disabled={!customSkillInput.trim()}>
                        Add
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {options.map((sug, idx) => {
                      const isSelected = isMulti
                        ? selectedValues?.includes(sug.value)
                        : selectedSingle === sug.value;

                      return (
                        <button
                          key={`${sug.value}-${idx}`}
                          onClick={() => {
                            if (isMulti) {
                              setAnswers((prev) => {
                                const curr = (prev[step.id] as string[]) || [];
                                const newSelection = curr.includes(sug.value)
                                  ? curr.filter((v) => v !== sug.value)
                                  : [...curr, sug.value];
                                return { ...prev, [step.id]: newSelection };
                              });
                            } else {
                              setAnswers((prev) => ({ ...prev, [step.id]: sug.value }));
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                              : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 inline mr-1" />}
                          {sug.label}
                        </button>
                      );
                    })}
                  </div>

                  {step.id === "skills" && Array.isArray(selectedValues) && selectedValues.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedValues.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            setAnswers((prev) => ({
                              ...prev,
                              skills: ((prev.skills as string[]) || []).filter((value) => value !== skill),
                            }));
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5"
                        >
                          <Wrench className="h-3 w-3 text-primary" />
                          {getSkillLabel(skill)}
                          <span className="text-muted-foreground">x</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {step.id === "sectors" && Array.isArray(selectedValues) && selectedValues.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnswers((prev) => ({ ...prev, sectors: [] }))}
                      >
                        Clear all sectors
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button className="w-full" size="lg" onClick={handleSaveEditMode}>
            Save Preferences
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── Wizard Mode ───────────────────────────────────────────────────────
  if (!wizardComplete && !editMode && currentStep) {
    const StepIcon = currentStep.icon;
    const isMulti = currentStep.multiSelect;
    const selectedValues = isMulti ? ((answers[currentStep.id] as string[]) || []) : null;
    const selectedSingle = !isMulti ? (answers[currentStep.id] as string) : null;
    const stepProgress = ((currentStepIndex + 1) / stepsToShow.length) * 100;

    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (currentStepIndex > 0) setCurrentStepIndex((i) => i - 1);
              else handleBack();
            }} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="font-display font-bold text-lg text-foreground">Jobs For You</h1>
            <span className="ml-auto text-xs text-muted-foreground font-medium">
              {currentStepIndex + 1} / {stepsToShow.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${stepProgress}%` }}
            />
          </div>
        </header>

        <main className="px-4 py-6 flex flex-col items-center">
          {/* Card */}
          <Card className="w-full max-w-md border-border/50 shadow-lg animate-fadeIn">
            <CardContent className="p-6 space-y-5">
              {/* Icon + Question */}
              <div className="text-center space-y-2">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <StepIcon className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-display font-bold text-xl text-foreground">{currentStep.question}</h2>
                <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
              </div>

              {/* Suggestion Chips */}
              <div className="flex flex-wrap gap-2 justify-center">
                {currentStep.suggestions.map((sug, idx) => {
                  const isSelected = isMulti
                    ? selectedValues?.includes(sug.value)
                    : selectedSingle === sug.value;

                  return (
                    <button
                      key={`${sug.value}-${idx}`}
                      onClick={() => handleSelect(currentStep.id, sug.value, isMulti)}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                        "border-2 hover:scale-[1.03] active:scale-[0.97]",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 inline mr-1.5" />}
                      {sug.label}
                    </button>
                  );
                })}
              </div>

              {/* Exact date input for DOB */}
              {currentStep.showInput === "date" && (
                <div className="space-y-2">
                  {!showDateInput ? (
                    <button
                      onClick={() => setShowDateInput(true)}
                      className="w-full text-center text-xs text-primary font-medium hover:underline"
                    >
                      Or enter exact date of birth
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={dateInputValue}
                        onChange={(e) => setDateInputValue(e.target.value)}
                        className="flex-1 h-10"
                      />
                      <Button size="sm" onClick={handleDateSubmit} disabled={!dateInputValue}>
                        Set
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Location — show full state list below suggestions */}
              {currentStep.id === "location" && (
                <details className="text-center">
                  <summary className="text-xs text-primary font-medium cursor-pointer hover:underline">
                    Show all states
                  </summary>
                  <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                    {INDIAN_STATES.filter((s) => !currentStep.suggestions.some((sug) => sug.value === s)).map((state) => {
                      const isStateSel = selectedValues?.includes(state);
                      return (
                        <button
                          key={state}
                          onClick={() => handleSelect("location", state, true)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            "border hover:border-primary/50 hover:bg-primary/5",
                            isStateSel
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border"
                          )}
                        >
                          {isStateSel && <Check className="h-3 w-3 inline mr-0.5" />}
                          {state}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Multi-select confirm button */}
              {isMulti && (
                <Button className="w-full" onClick={handleMultiConfirm}>
                  {(selectedValues?.length || 0) > 0
                    ? `Continue with ${selectedValues?.length} selected`
                    : "Continue without selecting"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Skip link */}
          <button
            onClick={handleSkip}
            className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="h-4 w-4" />
            Skip this step
          </button>
        </main>

        <BottomNav />
      </div>
    );
  }

  // ── Results Mode ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">

      {/* ── Compact sticky nav header ── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/50 px-4 py-2.5 md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={handleBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoColor} alt="JobsTrackr" className="h-5 w-5 object-contain dark:hidden" />
            <img src={logoWhite} alt="JobsTrackr" className="h-5 w-5 object-contain hidden dark:block" />
            <span className="font-display font-bold text-sm text-foreground">JobsTrackr</span>
          </div>
          <button
            onClick={() => navigate("/edit-sector-preferences")}
            className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
            title="Open Settings"
          >
            <Settings className="h-4 w-4 text-primary" />
          </button>
        </div>
      </header>

      <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.52)_48%,hsl(var(--primary)/0.12)_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Target className="h-3.5 w-3.5" />
                Personalized Matching Engine
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Jobs For You</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                View government jobs matched to your profile, education, and preferences in a more refined desktop recommendation workspace.
              </p>
            </div>
            <div className="flex flex-col items-end gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/edit-sector-preferences")}
                className="rounded-xl border-border/70 bg-card/80 px-4 py-2.5 shadow-sm backdrop-blur-sm"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <div className="grid min-w-[340px] grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Can Apply</p>
                <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300">{canApplyJobs.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Skills Gap</p>
                <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-300">{skillsNeededJobs.length}</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Not Eligible</p>
                <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-300">{notEligibleJobs.length}</p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="px-4 py-4 space-y-4 md:mx-auto md:max-w-6xl md:px-6 lg:px-8">

        {/* ── Hero banner ── */}
        <div className="rounded-2xl bg-gradient-to-r from-primary to-info text-white relative overflow-hidden p-5 shadow-lg">
          <div className="absolute top-0 right-0 w-44 h-44 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10 flex items-center gap-4">
            <img src={logoWhite} alt="JobsTrackr" className="h-12 w-12 object-contain drop-shadow-md flex-shrink-0" />
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">JobsTrackr</p>
              <h1 className="font-display font-bold text-xl leading-tight">Jobs For You</h1>
              <p className="text-white/70 text-xs mt-0.5">Personally matched to your profile</p>
            </div>
          </div>
        </div>

        {/* ── Education info card (redesigned) ── */}
        {highestEducation && (
          <div className="flex items-start gap-3 bg-gradient-to-r from-primary/5 to-info/5 border border-primary/10 rounded-2xl p-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Matching based on your highest qualification</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {getQualLabel(highestEducation.qualification_type)}
                {" · "}
                {getQualStreamLabel(inferredEducationStream)}
                {highestEducation.qualification_name ? ` · ${highestEducation.qualification_name}` : ""}
              </p>
            </div>
            <Link to="/edit-education" className="text-[10px] text-primary font-semibold hover:underline flex-shrink-0 mt-0.5">Edit</Link>
          </div>
        )}

        {/* ── Stat cards ── */}
        {!jobsLoading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
              <div className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">{canApplyJobs.length}</div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium mt-0.5 leading-tight">Can Apply</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
              <div className="text-2xl font-display font-bold text-amber-600 dark:text-amber-400">{skillsNeededJobs.length}</div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 font-medium mt-0.5 leading-tight">Skills Gap</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-center">
              <div className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{notEligibleJobs.length}</div>
              <div className="text-[10px] text-red-700 dark:text-red-300 font-medium mt-0.5 leading-tight">Not Eligible</div>
            </div>
          </div>
        )}

        {/* ── Active filter pills ── */}
        {!jobsLoading && (preferences.qualificationType || (answers.location && Array.isArray(answers.location) && answers.location.length > 0) || (answers.grade && Array.isArray(answers.grade) && answers.grade.length > 0) || (answers.skills && Array.isArray(answers.skills) && (answers.skills as string[]).length > 0)) && (
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {preferences.qualificationType && (
              <Badge variant="secondary" className="text-[10px] py-0.5">
                <GraduationCap className="h-3 w-3 mr-0.5" />
                {getQualLabel(preferences.qualificationType)}
                {preferences.qualificationStream !== "general" && ` (${getQualStreamLabel(preferences.qualificationStream)})`}
              </Badge>
            )}
            {answers.location && Array.isArray(answers.location) && answers.location.length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0.5">
                <MapPin className="h-3 w-3 mr-0.5" />
                {answers.location.length === 1 ? answers.location[0] : `${answers.location.length} states`}
              </Badge>
            )}
            {answers.grade && Array.isArray(answers.grade) && answers.grade.length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0.5">
                <Award className="h-3 w-3 mr-0.5" />
                {(answers.grade as string[]).join(", ")}
              </Badge>
            )}
            {answers.skills && Array.isArray(answers.skills) && (answers.skills as string[]).length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0.5">
                <Wrench className="h-3 w-3 mr-0.5" />
                {(answers.skills as string[]).length} skill{(answers.skills as string[]).length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {jobsLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* ── Your Location — Can Apply ── */}
        {!jobsLoading && preferredLocationJobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground">
                {hasPreferredLocations ? "Your Location" : "Can Apply"}
              </span>
              <span className="text-xs text-muted-foreground font-medium">({preferredLocationJobs.length})</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
            {preferredLocationJobs.map(({ job }, index) => (
              <div key={job.id} className="animate-fadeIn relative" style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}>
                {examMatchedIds.has(job.id) && (
                  <Badge className="absolute -top-2 right-3 z-10 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 shadow-sm">
                    <Target className="h-3 w-3 mr-1" />
                    Tracked Exam
                  </Badge>
                )}
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}

        {/* ── Your Location + Skills Needed ── */}
        {!jobsLoading && hasPreferredLocations && preferredLocationSkillsNeededJobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground">Your Location · Skills Gap</span>
              <span className="text-xs text-muted-foreground font-medium">({preferredLocationSkillsNeededJobs.length})</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
            {preferredLocationSkillsNeededJobs.map(({ job, eligibility }, index) => (
              <div key={job.id} className="space-y-1.5 animate-fadeIn" style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {eligibility.skillsMissing.map((skill, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                      <Wrench className="h-3 w-3" />{skill}
                    </span>
                  ))}
                </div>
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}

        {/* ── All India ── */}
        {!jobsLoading && (allIndiaJobs.length > 0 || allIndiaSkillsNeededJobs.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                <Globe className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground">All India</span>
              <span className="text-xs text-muted-foreground font-medium">({allIndiaJobs.length + allIndiaSkillsNeededJobs.length})</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
            {allIndiaJobs.map(({ job }, index) => (
              <div key={job.id} className="animate-fadeIn" style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}>
                <JobCard job={job} />
              </div>
            ))}
            {allIndiaSkillsNeededJobs.map(({ job, eligibility }, index) => (
              <div key={job.id} className="space-y-1.5 animate-fadeIn" style={{ animationDelay: `${(allIndiaJobs.length + index) * 50}ms`, animationFillMode: "both" }}>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {eligibility.skillsMissing.map((skill, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                      <Wrench className="h-3 w-3" />{skill}
                    </span>
                  ))}
                </div>
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}

        {/* ── Other States ── */}
        {!jobsLoading && (otherStateJobs.length > 0 || otherStateSkillsNeededJobs.length > 0) && (
          <div className="space-y-3 opacity-90">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground">Other States</span>
              <span className="text-xs text-muted-foreground font-medium">({otherStateJobs.length + otherStateSkillsNeededJobs.length})</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
            {otherStateJobs.map(({ job }, index) => (
              <div key={job.id} className="animate-fadeIn" style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}>
                <JobCard job={job} />
              </div>
            ))}
            {otherStateSkillsNeededJobs.map(({ job, eligibility }, index) => (
              <div key={job.id} className="space-y-1.5 animate-fadeIn" style={{ animationDelay: `${(otherStateJobs.length + index) * 50}ms`, animationFillMode: "both" }}>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {eligibility.skillsMissing.map((skill, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                      <Wrench className="h-3 w-3" />{skill}
                    </span>
                  ))}
                </div>
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!jobsLoading && canApplyJobs.length === 0 && skillsNeededJobs.length === 0 && (
          <div className="text-center py-16 px-5">
            <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-info/20 flex items-center justify-center mb-5">
              <Target className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-2">No matching jobs yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Try widening your filters — add more locations or adjust your qualification level</p>
            <Button variant="outline" onClick={() => navigate("/edit-sector-preferences")}>
              <Settings className="h-4 w-4 mr-2" />
              Open Settings
            </Button>
          </div>
        )}

        {/* ── Not Eligible (collapsible) ── */}
        {!jobsLoading && notEligibleJobs.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowPartial(!showPartial)}
              className="flex items-center gap-2.5 w-full text-left px-3 py-3 rounded-xl bg-red-500/5 border border-red-500/15 hover:bg-red-500/10 transition-colors"
            >
              <div className="h-7 w-7 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-sm font-semibold text-foreground flex-1">Not Eligible</span>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{notEligibleJobs.length} jobs</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showPartial && "rotate-180")} />
            </button>
            {showPartial && (
              <div className="space-y-3">
                {notEligibleJobs.map(({ job, eligibility }, index) => (
                  <div key={job.id} className="space-y-1.5 opacity-60 animate-fadeIn" style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}>
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {eligibility.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                          {r}
                        </span>
                      ))}
                    </div>
                    <JobCard job={job} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  );
}
