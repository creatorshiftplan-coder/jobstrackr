import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Menu, Edit2, Calendar, User, GraduationCap, Briefcase, CheckCircle, Phone, MapPin, ChevronRight, Bookmark, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useExams } from "@/hooks/useExams";
import { useEducation } from "@/hooks/useEducation";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { EmbeddedProfileProgress } from "@/components/ProfileCompleteness";

export default function Profile() {
  const { user, loading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: savedJobs } = useSavedJobs();
  const { userExams } = useExams();
  const { education, isLoading: educationLoading } = useEducation();
  const navigate = useNavigate();

  if (loading || profileLoading || educationLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl px-4 pt-12 pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <Link to="/more">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                <Menu className="h-5 w-5 text-foreground/70" />
              </div>
            </Link>
            <h1 className="font-display font-bold text-xl text-foreground flex-1 text-center">Profile</h1>
            <Link to="/saved">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                <Bookmark className="h-5 w-5 text-foreground/70" />
              </div>
            </Link>
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

  // Get highest education
  const qualificationOrder = ["phd", "post_graduation", "graduation", "diploma", "12th", "10th"];
  const highestEducation = education.sort((a, b) => {
    return qualificationOrder.indexOf(a.qualification_type) - qualificationOrder.indexOf(b.qualification_type);
  })[0];

  const getQualificationLabel = (type: string) => {
    const labels: Record<string, string> = {
      "10th": "Matriculation",
      "12th": "Intermediate",
      "diploma": "Diploma",
      "graduation": "Graduate",
      "post_graduation": "Post Graduate",
      "phd": "PhD",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-card to-background pb-20">
        <header className="sticky top-0 z-40 px-4 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/more">
              <div className="h-10 w-10 rounded-xl bg-muted/50 backdrop-blur-xl flex items-center justify-center hover:bg-muted transition-colors">
                <Menu className="h-5 w-5 text-foreground/70" />
              </div>
            </Link>
            <div className="flex-1" />
            <Link to="/saved">
              <div className="h-10 w-10 rounded-xl bg-muted/50 backdrop-blur-xl flex items-center justify-center hover:bg-muted transition-colors">
                <Bookmark className="h-5 w-5 text-foreground/70" />
              </div>
            </Link>
            <Link to="/edit-profile" className="flex items-center gap-2 text-primary font-medium hover:text-primary/80 transition-colors bg-primary/10 px-3 py-2 rounded-xl">
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </header>

        {/* Profile Avatar & Name */}
        <div className="flex flex-col items-center text-center px-4 -mb-16">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-3 shadow-glow ring-4 ring-background">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt={userName} className="h-24 w-24 rounded-2xl object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary-foreground">{userInitials}</span>
            )}
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">{userName}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm text-muted-foreground">
              {highestEducation ? getQualificationLabel(highestEducation.qualification_type) : "Add Education"}
            </span>
            {highestEducation && <CheckCircle className="h-4 w-4 text-success fill-success/20" />}
          </div>
          
          {/* Embedded Profile Progress */}
          <EmbeddedProfileProgress profile={profile} education={education} />
        </div>
      </div>

      <main className="px-4 py-6 space-y-5 -mt-12">

        {/* Stats Row */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 divide-x divide-border/50">
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
            <Link to="/edit-profile" className="text-sm text-primary font-medium flex items-center hover:text-primary/80 transition-colors">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Father's Name</p>
                    <p className="text-sm font-medium text-foreground">{profile?.father_name || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Mother's Name</p>
                    <p className="text-sm font-medium text-foreground">{profile?.mother_name || "Not set"}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning/15 to-warning/5 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-warning" />
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

        {/* Contact Information */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Contact Information</h3>
            <Link to="/edit-profile" className="text-sm text-primary font-medium flex items-center hover:text-primary/80 transition-colors">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-info/15 to-info/5 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-info" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Mobile</p>
                    <p className="text-sm font-medium text-foreground">{profile?.phone || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                    <p className="text-sm font-medium text-foreground truncate">{profile?.email || user?.email || "Not set"}</p>
                  </div>
                </div>
              </div>
              {profile?.address && (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-success/15 to-success/5 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                    <p className="text-sm font-medium text-foreground">{profile.address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Education */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Education</h3>
            <Link to="/edit-education" className="text-sm text-primary font-medium flex items-center hover:text-primary/80 transition-colors">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="border-border/40">
            <CardContent className="p-4">
              {education.length === 0 ? (
                <div className="text-center py-4">
                  <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No education records added</p>
                  <Link to="/edit-education">
                    <Button size="sm" variant="soft" className="mt-3">Add Education</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {education.slice(0, 2).map((edu) => (
                    <div key={edu.id} className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{edu.qualification_name || getQualificationLabel(edu.qualification_type)}</p>
                          {edu.percentage && <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">{edu.percentage}%</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{edu.board_university || edu.institute_name}</p>
                        {edu.date_of_passing && (
                          <p className="text-xs text-muted-foreground">Passed: {edu.date_of_passing}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category & Other Details */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Other Details</h3>
            <Link to="/edit-profile" className="text-sm text-primary font-medium flex items-center hover:text-primary/80 transition-colors">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-destructive/15 to-destructive/5 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                    <p className="text-sm font-medium text-foreground">{profile?.category || "General"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Current Status</p>
                    <p className="text-sm font-medium text-foreground">{profile?.current_status || "Job Seeker"}</p>
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
