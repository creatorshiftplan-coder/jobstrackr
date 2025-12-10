import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Edit2, Calendar, User, Users, GraduationCap, Briefcase, CheckCircle, Phone, Mail, MapPin, FileText, ChevronRight, Bookmark, Loader2, CircleUser, Activity } from "lucide-react";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
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
        <header className="sticky top-0 z-40 bg-card px-4 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/more">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <MenuBarsIcon className="h-5 w-5 text-primary" />
              </div>
            </Link>
            <h1 className="font-display font-bold text-xl text-foreground flex-1 text-center">Profile</h1>
            <Link to="/saved">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Bookmark className="h-5 w-5 text-primary" />
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 pb-12">
        <header className="sticky top-0 z-40 px-4 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/more">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <MenuBarsIcon className="h-5 w-5 text-primary" />
              </div>
            </Link>
            <div className="flex-1" />
            <Link to="/saved">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Bookmark className="h-5 w-5 text-primary" />
              </div>
            </Link>
            <Link to="/edit-profile" className="flex items-center gap-2 text-primary font-medium hover:text-primary/80 transition-colors">
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </header>

        {/* Profile Avatar & Name */}
        <div className="flex flex-col items-center text-center px-4 -mb-16">
          <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center mb-3 shadow-lg ring-4 ring-background">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt={userName} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary-foreground">{userInitials}</span>
            )}
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">{userName}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm text-muted-foreground">
              {highestEducation ? getQualificationLabel(highestEducation.qualification_type) : "Add Education"}
            </span>
            {highestEducation && <CheckCircle className="h-4 w-4 text-primary fill-primary/20" />}
          </div>

          {/* Embedded Profile Progress */}
          <EmbeddedProfileProgress profile={profile} education={education} />
        </div>
      </div>

      <main className="px-4 py-6 space-y-6 mt-2">

        {/* Stats Row */}
        <Card className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 border-blue-200/50 dark:border-blue-800/30 shadow-md">
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
            <Link to="/edit-profile" className="text-sm text-primary font-medium flex items-center">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 border-blue-200/50 dark:border-blue-800/30 shadow-md">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Father's Name</p>
                  <p className="text-sm font-medium text-foreground">{profile?.father_name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Mother's Name</p>
                  <p className="text-sm font-medium text-foreground">{profile?.mother_name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Date of Birth</p>
                  <p className="text-sm font-medium text-foreground">{formattedDOB}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CircleUser className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Gender</p>
                  <p className="text-sm font-medium text-foreground">{profile?.gender || "Not set"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Contact Information</h3>
            <Link to="/edit-profile" className="text-sm text-primary font-medium flex items-center">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 border-blue-200/50 dark:border-blue-800/30 shadow-md">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Mobile</p>
                  <p className="text-sm font-medium text-foreground">{profile?.phone || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-sm font-medium text-foreground truncate">{profile?.email || user?.email || "Not set"}</p>
                </div>
              </div>
              {profile?.address && (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
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
            <Link to="/edit-education" className="text-sm text-primary font-medium flex items-center">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 border-blue-200/50 dark:border-blue-800/30 shadow-md">
            <CardContent className="p-4">
              {education.length === 0 ? (
                <div className="text-center py-4">
                  <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No education records added</p>
                  <Link to="/edit-education">
                    <Button size="sm" variant="outline" className="mt-2">Add Education</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {education.slice(0, 2).map((edu) => (
                    <div key={edu.id} className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{edu.qualification_name || getQualificationLabel(edu.qualification_type)}</p>
                          {edu.percentage && <span className="text-xs text-muted-foreground">{edu.percentage}%</span>}
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
            <Link to="/edit-profile" className="text-sm text-primary font-medium flex items-center">
              See all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 border-blue-200/50 dark:border-blue-800/30 shadow-md">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                  <p className="text-sm font-medium text-foreground">{profile?.category || "General"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Current Status</p>
                  <p className="text-sm font-medium text-foreground">{profile?.current_status || "Job Seeker"}</p>
                </div>
              </div>
              {profile?.aadhar_number && (
                <div className="flex items-start gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Aadhaar</p>
                      <p className="text-sm font-medium text-foreground">XXXX-XXXX-{profile.aadhar_number.slice(-4)}</p>
                    </div>
                    {profile?.pan_number && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">PAN</p>
                        <p className="text-sm font-medium text-foreground">{profile.pan_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
