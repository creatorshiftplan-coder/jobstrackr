import { useState } from "react";
import { ArrowLeft, Copy, Check, User, Phone, GraduationCap, Shield, Briefcase } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile, useDecryptedProfile } from "@/hooks/useProfile";
import { useEducation } from "@/hooks/useEducation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GUEST_PROFILE, GUEST_EDUCATION } from "@/lib/guestData";
import { useAuthRequired } from "@/components/AuthRequiredDialog";

interface CopyFieldProps {
  label: string;
  value: string | null | undefined;
}

function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">
          {value || <span className="text-muted-foreground italic">Not provided</span>}
        </p>
      </div>
      {value && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="ml-2 h-8 w-8 p-0 shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}

export default function FormMate() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isGuestMode } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: decryptedProfile } = useDecryptedProfile();
  const { education, isLoading: educationLoading } = useEducation();
  const { showAuthRequired } = useAuthRequired();

  // Use guest data when in guest mode
  const displayProfile = isGuestMode ? GUEST_PROFILE : profile;
  const displayEducation = isGuestMode ? GUEST_EDUCATION : education;

  if (authLoading || (!isGuestMode && (profileLoading || educationLoading))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Please login to access FormMate</p>
            <Link to="/auth">
              <Button>Login / Sign Up</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEditClick = () => {
    if (isGuestMode) {
      showAuthRequired("Login to edit your profile");
    } else {
      navigate("/edit-profile");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-primary-foreground dark:text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-primary-foreground dark:text-foreground">Online Application Guidance</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Intro Card */}
        <Card className="border-0 shadow-card bg-primary/10 dark:bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-primary dark:text-foreground">
              No more searching documents or memorizing details — just tap copy and paste in the form.
            </p>
          </CardContent>
        </Card>

        {/* Personal Details */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CopyField label="Full Name" value={displayProfile?.full_name} />
            <CopyField label="Father's Name" value={displayProfile?.father_name} />
            <CopyField label="Mother's Name" value={displayProfile?.mother_name} />
            <CopyField label="Date of Birth" value={formatDate(displayProfile?.date_of_birth)} />
            <CopyField label="Gender" value={displayProfile?.gender} />
            <CopyField label="Marital Status" value={isGuestMode ? "Single" : profile?.marital_status} />
          </CardContent>
        </Card>

        {/* Identity Documents - Shows full decrypted values for easy copying */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" />
              Identity Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CopyField label="Aadhaar Number" value={isGuestMode ? displayProfile?.aadhar_number : (decryptedProfile?.decrypted_aadhar_number || profile?.aadhar_number)} />
            <CopyField label="PAN Number" value={isGuestMode ? displayProfile?.pan_number : (decryptedProfile?.decrypted_pan_number || profile?.pan_number)} />
            <CopyField label="Passport Number" value={isGuestMode ? "J1234567" : (decryptedProfile?.decrypted_passport_number || profile?.passport_number)} />
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CopyField label="Phone Number" value={displayProfile?.phone} />
            <CopyField label="Email" value={displayProfile?.email} />
            <CopyField label="Address" value={displayProfile?.address} />
            <CopyField label="PIN Code" value={displayProfile?.pincode} />
          </CardContent>
        </Card>

        {/* Educational Qualifications */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5 text-primary" />
              Educational Qualifications
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {displayEducation && displayEducation.length > 0 ? (
              displayEducation.map((edu, index) => (
                <div key={edu.id} className={index > 0 ? "mt-4 pt-4 border-t-2 border-border" : ""}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    {edu.qualification_type}
                  </p>
                  <CopyField label="Qualification" value={edu.specialization || edu.qualification_name} />
                  <CopyField label="Board/University" value={edu.board_university} />
                  <CopyField label="Institute" value={edu.institution_name || edu.institute_name} />
                  <CopyField label="Roll Number" value={isGuestMode ? "12345678" : edu.roll_number} />
                  <CopyField label="Year of Passing" value={edu.passing_year?.toString() || edu.date_of_passing} />
                  <CopyField label="Percentage" value={edu.percentage?.toString()} />
                  <CopyField label="CGPA" value={isGuestMode ? "7.5" : edu.cgpa?.toString()} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic py-2">
                No education details added yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Category Details */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-5 w-5 text-primary" />
              Category Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CopyField label="Category" value={displayProfile?.category} />
            <CopyField label="Caste Name" value={isGuestMode ? "N/A" : profile?.caste_name} />
            <CopyField label="Sub-Category" value={isGuestMode ? "N/A" : profile?.sub_category} />
            <CopyField label="Caste Certificate No." value={isGuestMode ? "N/A" : profile?.caste_certificate_number} />
            <CopyField label="Caste Issuing Authority" value={isGuestMode ? "N/A" : profile?.caste_issuing_authority} />
            <CopyField label="EWS Certificate No." value={isGuestMode ? "N/A" : profile?.ews_certificate_number} />
            <CopyField label="EWS Issuing Authority" value={isGuestMode ? "N/A" : profile?.ews_issuing_authority} />
            <CopyField label="Disability Type" value={isGuestMode ? "None" : profile?.disability_type} />
            <CopyField label="Disability Certificate No." value={isGuestMode ? "N/A" : profile?.disability_certificate_number} />
          </CardContent>
        </Card>

        {/* Current Status */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-5 w-5 text-primary" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CopyField label="Current Status" value={isGuestMode ? "Job Seeker" : profile?.current_status} />
          </CardContent>
        </Card>

        {/* Edit Profile Link */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleEditClick}
        >
          Edit Profile Details
        </Button>
      </main>
    </div>
  );
}
