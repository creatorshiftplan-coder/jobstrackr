import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Profile } from "@/hooks/useProfile";
import { EducationQualification } from "@/hooks/useEducation";
import { Link } from "react-router-dom";

interface ProfileCompletenessProps {
  profile: Profile | null;
  education: EducationQualification[];
}

const REQUIRED_FIELDS = [
  { key: "full_name", label: "Full Name" },
  { key: "father_name", label: "Father's Name" },
  { key: "mother_name", label: "Mother's Name" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "phone", label: "Mobile Number" },
  { key: "email", label: "Email Address" },
  { key: "address", label: "Address" },
  { key: "category", label: "Category" },
  { key: "aadhar_number", label: "Aadhaar Number" },
  { key: "photo_url", label: "Passport Photo" },
  { key: "signature_url", label: "Signature" },
];

function calculateCompleteness(profile: Profile | null, education: EducationQualification[]) {
  const filledFields = REQUIRED_FIELDS.filter((field) => {
    const value = profile?.[field.key as keyof Profile];
    return value !== null && value !== undefined && value !== "";
  });

  const has10thEducation = education.some((e) => e.qualification_type === "10th");
  const has12thEducation = education.some((e) => e.qualification_type === "12th");

  const totalRequired = REQUIRED_FIELDS.length + 2;
  const totalFilled = filledFields.length + (has10thEducation ? 1 : 0) + (has12thEducation ? 1 : 0);
  const completionPercentage = Math.round((totalFilled / totalRequired) * 100);

  const missingFields = [
    ...REQUIRED_FIELDS.filter((field) => {
      const value = profile?.[field.key as keyof Profile];
      return value === null || value === undefined || value === "";
    }),
    ...(!has10thEducation ? [{ key: "10th", label: "Class 10 Details" }] : []),
    ...(!has12thEducation ? [{ key: "12th", label: "Class 12 Details" }] : []),
  ];

  return { completionPercentage, missingFields, totalFilled, totalRequired };
}

// Sleek embedded progress indicator for the blue header section
export function EmbeddedProfileProgress({ profile, education }: ProfileCompletenessProps) {
  const { completionPercentage } = calculateCompleteness(profile, education);

  if (completionPercentage === 100) {
    return (
      <div className="mt-4 w-4/5 mx-auto flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#0A4174]/15 backdrop-blur-sm border border-[#0A4174]/20">
        <CheckCircle2 className="h-4 w-4 text-[#0A4174]" />
        <span className="text-sm font-medium text-[#0A4174]">Profile Complete</span>
      </div>
    );
  }

  return (
    <div className="mt-4 w-4/5 mx-auto px-4 py-3 rounded-2xl bg-[#0A4174]/10 backdrop-blur-sm border border-[#0A4174]/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#0A4174]">{completionPercentage}% Complete</span>
        <Link 
          to="/edit-profile" 
          className="flex items-center gap-0.5 text-xs font-medium text-[#0A4174]/70 hover:text-[#0A4174] transition-colors"
        >
          Complete profile
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="h-2 w-full rounded-full bg-[#0A4174]/20 overflow-hidden">
        <div 
          className="h-full rounded-full bg-[#0A4174] transition-all duration-500 ease-out"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
    </div>
  );
}

// Original card-based component (keeping for backwards compatibility)
export function ProfileCompleteness({ profile, education }: ProfileCompletenessProps) {
  const { completionPercentage, missingFields } = calculateCompleteness(profile, education);

  if (completionPercentage === 100) {
    return null;
  }

  return (
    <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Profile {completionPercentage}% complete
        </span>
        <span className="text-xs text-amber-600">{missingFields.length} missing</span>
      </div>
      <Progress value={completionPercentage} className="h-2" />
      {missingFields.length <= 5 && (
        <div className="flex flex-wrap gap-1.5">
          {missingFields.slice(0, 5).map((field) => (
            <span
              key={field.key}
              className="text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
            >
              {field.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
