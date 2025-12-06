import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Edit2, Calendar, User, GraduationCap, Briefcase, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useExams } from "@/hooks/useExams";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { user, loading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: savedJobs } = useSavedJobs();
  const { userExams } = useExams();
  const navigate = useNavigate();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="font-display font-bold text-xl text-foreground">Profile</h1>
            <div className="w-10" />
          </div>
        </header>
        <main className="px-4 py-8 text-center">
          <p className="text-muted-foreground mb-4">Please login to view your profile</p>
          <Link to="/auth">
            <Button>Login / Sign Up</Button>
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const userName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = userName.substring(0, 2).toUpperCase();

  // Stats calculations
  const savedExamsCount = savedJobs?.length || 0;
  const admitCardAwaitedCount = userExams?.filter(e => e.status === "tracking" || e.status === "applied")?.length || 0;
  const resultCount = userExams?.filter(e => e.status === "result")?.length || 0;

  // Format date of birth
  const formattedDOB = profile?.date_of_birth 
    ? format(new Date(profile.date_of_birth), "dd/MM/yyyy")
    : "Not set";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Link to="/more" className="flex items-center gap-2 text-primary font-medium">
            <Edit2 className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Profile Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 rounded-full gradient-primary flex items-center justify-center mb-3 shadow-lg">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt={userName} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary-foreground">{userInitials}</span>
            )}
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">{userName}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm text-muted-foreground">Graduate</span>
            <CheckCircle className="h-4 w-4 text-green-500 fill-green-500" />
          </div>
        </div>

        {/* Stats Row */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{savedExamsCount}</span>
                <span className="text-xs text-muted-foreground text-center">Saved Exam</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{admitCardAwaitedCount}</span>
                <span className="text-xs text-muted-foreground text-center">Admit card Awaited</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{resultCount}</span>
                <span className="text-xs text-muted-foreground text-center">Result</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Details */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Personal Details</h3>
            <Link to="/more" className="text-sm text-primary font-medium">See all</Link>
          </div>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Date of Birth</p>
                    <p className="text-sm font-medium text-foreground">{formattedDOB}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Gender</p>
                    <p className="text-sm font-medium text-foreground">{profile?.gender || "Not set"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Education */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Education</h3>
            <Link to="/more" className="text-sm text-primary font-medium">See all</Link>
          </div>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Graduation</p>
                    <p className="text-xs text-muted-foreground">India</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Bachelor's Degree</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Other Details */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Other Details</h3>
            <Link to="/more" className="text-sm text-primary font-medium">See all</Link>
          </div>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                    <p className="text-sm font-medium text-foreground">{profile?.category || "General"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Current Status</p>
                    <p className="text-sm font-medium text-foreground">Job Seeker</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

