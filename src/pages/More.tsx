import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Settings, Bell, HelpCircle, LogOut, ChevronRight, Shield, Loader2, Bookmark, ArrowLeft, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useEducation } from "@/hooks/useEducation";
import { useAdminRole } from "@/hooks/useAdminRole";
import { DocumentUploader } from "@/components/DocumentUploader";
import { OCRResultModal } from "@/components/OCRResultModal";

// Define which fields belong to profiles vs education
const PROFILE_FIELDS = [
  'full_name', 'date_of_birth', 'gender', 'father_name', 'mother_name',
  'phone', 'email', 'address', 'aadhar_number', 'pan_number', 'passport_number',
  'category', 'caste_name', 'caste_certificate_number', 'caste_issuing_authority',
  'caste_issue_date', 'marital_status', 'pincode', 'ews_certificate_number',
  'ews_issuing_authority', 'sub_category', 'disability_type', 
  'disability_certificate_number', 'current_status'
];

const EDUCATION_FIELDS = [
  'board_university', 'institute_name', 'roll_number', 'qualification_type',
  'qualification_name', 'date_of_passing', 'marks_obtained', 'maximum_marks',
  'percentage', 'cgpa'
];

export default function More() {
  const { user, loading, signOut } = useAuth();
  const { profile, upsertProfile } = useProfile();
  const { addEducation } = useEducation();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrData, setOcrData] = useState<Record<string, any>>({});

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleOCRComplete = (documentId: string, extractedData: any) => {
    setOcrData(extractedData);
    setOcrModalOpen(true);
  };

  const handleConfirmOCR = (selectedFields: Record<string, any>) => {
    // Separate profile and education fields
    const profileData: Record<string, any> = {};
    const educationData: Record<string, any> = {};
    
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (PROFILE_FIELDS.includes(key)) {
        profileData[key] = value;
      } else if (EDUCATION_FIELDS.includes(key)) {
        educationData[key] = value;
      }
    });
    
    // Update profile if there are profile fields
    if (Object.keys(profileData).length > 0) {
      upsertProfile.mutate(profileData);
    }
    
    // Add education record if there are education fields
    if (Object.keys(educationData).length > 0) {
      addEducation.mutate(educationData);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[hsl(var(--blue-100))] pb-20">
      <header className="sticky top-0 z-40 bg-[hsl(var(--blue-900))] px-4 py-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="h-10 w-10 rounded-full bg-[hsl(var(--blue-700))] flex items-center justify-center hover:bg-[hsl(var(--blue-600))] transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-display font-bold text-xl text-white">More</h1>
          <Link to="/saved">
            <div className="h-10 w-10 rounded-full bg-[hsl(var(--blue-700))] flex items-center justify-center hover:bg-[hsl(var(--blue-600))] transition-colors">
              <Bookmark className="h-5 w-5 text-white" />
            </div>
          </Link>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {!user ? (
          <Card className="border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="mx-auto h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                Welcome to Govt Job Finder
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Login to save jobs, track applications, and get personalized recommendations
              </p>
              <Link to="/auth">
                <Button className="w-full">Login / Sign Up</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-0 shadow-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">{userInitials}</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{userName}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </CardContent>
            </Card>

            {/* Application Guidance Link */}
            <Link to="/formmate" className="block mt-6">
              <Card className="border-0 shadow-card mb-4 hover:bg-secondary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[hsl(var(--blue-100))] flex items-center justify-center">
                      <FileText className="h-5 w-5 text-[hsl(var(--blue-700))]" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">Application Guidance</h4>
                      <p className="text-xs text-muted-foreground">Quick copy your profile details</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <DocumentUploader onOCRComplete={handleOCRComplete} />
          </>
        )}

        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-0">
            {[
              { icon: Bell, label: "Notifications", path: "/notifications" },
              { icon: Settings, label: "Settings", path: "/settings" },
              { icon: HelpCircle, label: "Help & Support", path: "/help" },
              ...(user && isAdmin ? [{ icon: Shield, label: "Admin Panel", path: "/admin" }] : []),
            ].map(({ icon: Icon, label, path }) => (
              <Link
                key={path}
                to={path}
                className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{label}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {user && (
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        )}
      </main>

      <OCRResultModal
        isOpen={ocrModalOpen}
        onClose={() => setOcrModalOpen(false)}
        extractedData={ocrData}
        onConfirm={handleConfirmOCR}
      />

      <BottomNav />
    </div>
  );
}
