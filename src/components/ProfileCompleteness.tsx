import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Profile } from "@/hooks/useProfile";
import { EducationQualification } from "@/hooks/useEducation";

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

export function ProfileCompleteness({ profile, education }: ProfileCompletenessProps) {
  const filledFields = REQUIRED_FIELDS.filter((field) => {
    const value = profile?.[field.key as keyof Profile];
    return value !== null && value !== undefined && value !== "";
  });

  const has10thEducation = education.some((e) => e.qualification_type === "10th");
  const has12thEducation = education.some((e) => e.qualification_type === "12th");

  const totalRequired = REQUIRED_FIELDS.length + 2; // +2 for 10th and 12th education
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

  if (completionPercentage === 100) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            Profile complete! You're ready for job applications.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Profile {completionPercentage}% complete
            </span>
          </div>
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
      </CardContent>
    </Card>
  );
}
