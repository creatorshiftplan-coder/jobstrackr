import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { User, HelpCircle, LogOut, ChevronRight, Shield, ShieldCheck, CreditCard, Loader2, Bookmark, ArrowLeft, FileText, Moon, Sun, Upload, ClipboardList, Search, Edit, Key, Sparkles, SearchCheck, Target, Share2, BookOpen, MessageSquare, Bell, Send, Flame, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTheme } from "next-themes";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { GUEST_PROFILE } from "@/lib/guestData";
import { useSmartBack } from "@/hooks/useSmartBack";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function More() {
  const { user, loading, signOut, resetPassword, isGuestMode } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useAdminRole();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
  const { toast } = useToast();
  const { showAuthRequired } = useAuthRequired();

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"suggestion" | "grievance">("suggestion");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Sync user email when loaded or when anonymity status changes
  useEffect(() => {
    if (isAnonymous) {
      setFeedbackEmail("");
    } else if (user?.email) {
      setFeedbackEmail(user.email);
    } else if (isGuestMode) {
      setFeedbackEmail(GUEST_PROFILE.email);
    } else {
      setFeedbackEmail("");
    }
  }, [user, isGuestMode, isAnonymous]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAnonymous && !feedbackEmail.trim()) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (!feedbackMessage.trim()) {
      toast({ title: "Message required", description: "Please write a message.", variant: "destructive" });
      return;
    }
    if (feedbackMessage.length > 500) {
      toast({ title: "Too long", description: "Message cannot exceed 500 characters.", variant: "destructive" });
      return;
    }

    // Client-side rate-limiting: max 5 submissions per hour
    const nowTime = Date.now();
    const submissionsKey = "jobstrackr_feedback_submissions";
    let pastSubmissions: number[] = [];
    try {
      pastSubmissions = JSON.parse(localStorage.getItem(submissionsKey) || "[]")
        .filter((timestamp: number) => nowTime - timestamp < 3600000); // last 1 hour
    } catch (err) {
      pastSubmissions = [];
    }

    if (pastSubmissions.length >= 5) {
      toast({
        title: "Rate limit exceeded",
        description: "You have submitted feedback too many times recently. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const { error } = await supabase
        .from("suggestions_grievances" as any)
        .insert({
          user_id: isAnonymous ? null : (user?.id || null),
          user_email: isAnonymous ? null : feedbackEmail.trim(),
          type: feedbackType,
          message: feedbackMessage.trim(),
        });

      if (error) throw error;

      // Update rate-limiting logs
      try {
        const updatedSubmissions = [...pastSubmissions, nowTime];
        localStorage.setItem(submissionsKey, JSON.stringify(updatedSubmissions));
      } catch (err) {
        // ignore storage write errors
      }

      toast({
        title: "Feedback submitted successfully!",
        description: "Thank you for helping us improve JobsTrackr.",
      });
      setFeedbackMessage("");
      setIsAnonymous(false);
      setIsFeedbackOpen(false);
    } catch (err: any) {
      console.error("Feedback error:", err);
      toast({
        title: "Failed to submit feedback",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleUploadDocuments = () => {
    if (!user) {
      showAuthRequired("Login to upload and manage your documents");
      return;
    }
    navigate("/documents");
  };

  const handleTrackExam = () => {
    if (!user) {
      showAuthRequired("Login to track exams and get status updates");
      return;
    }
    navigate("/tracker");
  };

  const handleShareApp = async () => {
    const shareText = `Jobstrackr – Your Smart Government Job Companion.\n\nLatest Govt Jobs • Exam Tracking • AI Recommendations • FormMate • OCR Documents\n\n🔗 https://www.jobstrackr.in/`;
    
    const shareData = {
      title: "JobsTrackr App",
      text: shareText,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Link Copied",
          description: "App share details copied to clipboard!",
        });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Link Copied",
          description: "App share details copied to clipboard!",
        });
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;

    const { error } = await resetPassword(user.email);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email Sent",
        description: "Check your inbox for the password reset link.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || profile?.full_name || user?.email?.split("@")[0] || (isGuestMode ? GUEST_PROFILE.full_name : "User");
  const userInitials = userName.substring(0, 2).toUpperCase();
  const userEmail = user?.email || (isGuestMode ? GUEST_PROFILE.email : "");

  const supportItems = [
    ...(user ? [
      { icon: Sparkles, label: "Sector Preferences", path: "/edit-sector-preferences" }
    ] : []),
    { icon: BookOpen, label: "User Manual", path: "/user-manual" },
    { icon: HelpCircle, label: "Frequently Asked Questions", path: "/faq" },
    { icon: MessageSquare, label: "Feedback & Grievances", onClick: () => setIsFeedbackOpen(true) },
    { icon: HelpCircle, label: "Help & Support", path: "/help" },
    { icon: Share2, label: "Share this App", onClick: handleShareApp },
    ...(user && isAdmin ? [{ icon: Shield, label: "Admin Panel", path: "/admin" }] : []),
  ];

  const legalItems = [
    { icon: ShieldCheck, label: "Privacy Policy", path: "/privacy-policy" },
    { icon: CreditCard, label: "Refund Policy", path: "/refund-policy" },
    { icon: FileText, label: "Terms of Service", path: "/terms-of-service" },
  ];

  const renderItem = (item: any) => {
    const Icon = item.icon;
    const content = (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-foreground">{item.label}</span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    );

    if ('onClick' in item) {
      return (
        <button
          key={item.label}
          onClick={item.onClick}
          className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors border-b border-border last:border-0 text-left"
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-12">
      {/* Mobile Sticky Header */}
      <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-2 md:hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-primary-foreground dark:text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoColor} alt="JobsTrackr" className="h-7 sm:h-8 w-auto dark:hidden" />
            <img src={logoWhite} alt="JobsTrackr" className="h-7 sm:h-8 w-auto hidden dark:block" />
            <span className="font-display font-bold text-base sm:text-lg text-primary-foreground dark:text-foreground tracking-wider">JOBSTRACKR</span>
          </div>
          <Link to="/saved">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
              <Bookmark className="h-4 w-4 text-primary-foreground dark:text-foreground" />
            </div>
          </Link>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 md:mx-auto md:max-w-6xl md:px-6 lg:px-8 md:py-8 md:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column (Profile & Settings) */}
          <div className="md:col-span-1 space-y-6">
            {/* Profile Card */}
            {!user ? (
              <Card
                className="bg-white dark:bg-card border-border/50 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate("/profile")}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-foreground truncate">Welcome to JobsTrackr</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Login to save jobs, track applications, and get recommendations</p>
                    <Link
                      to="/auth"
                      className="text-xs text-primary flex items-center gap-1 mt-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Login / Sign Up
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            ) : (
              <Card
                className="bg-white dark:bg-card border-border/50 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate("/profile")}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-primary-foreground">{userInitials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-foreground truncate">{userName}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                    <button
                      className="text-xs text-primary flex items-center gap-1 mt-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/profile");
                      }}
                    >
                      <Edit className="h-3 w-3" />
                      Edit My Profile
                    </button>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            )}

            {/* Dark Mode Card (Desktop Only) */}
            <Card className="hidden md:block bg-white dark:bg-card border-border/50 shadow-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                    {theme === "dark" ? (
                      <Moon className="h-5 w-5 text-primary" />
                    ) : (
                      <Sun className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">Dark Mode</h4>
                    <p className="text-xs text-muted-foreground">{theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}</p>
                  </div>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  className="data-[state=checked]:bg-primary"
                />
              </CardContent>
            </Card>

            {/* Session Actions (Reset Password & Logout) (Desktop Only) */}
            {user && (
              <div className="hidden md:block space-y-3 pt-2">
                <Button
                  variant="default"
                  className="w-full bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 font-medium transition-colors shadow-sm"
                  onClick={handleResetPassword}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </Button>

                <Button
                  variant="default"
                  className="w-full bg-destructive/5 hover:bg-destructive/10 text-destructive border border-destructive/20 font-medium transition-colors shadow-sm"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>

          {/* Right Column (Navigation, Tools & Policies) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Quick Actions/Navigation */}
            <div>
              <h3 className="font-display font-semibold text-foreground text-base mb-2.5">Quick Navigation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Card
                  className="bg-white dark:bg-card border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={handleTrackExam}
                >
                  <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <ClipboardList className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-foreground">Track an Exam</span>
                  </CardContent>
                </Card>

                <Card
                  className="bg-white dark:bg-card border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate("/search")}
                >
                  <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Search className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-foreground">Find an Exam</span>
                  </CardContent>
                </Card>

                <Card
                  className="bg-white dark:bg-card border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate("/trending")}
                >
                  <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Flame className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-foreground">Trending Exams</span>
                  </CardContent>
                </Card>

                <Card
                  className="bg-white dark:bg-card border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate("/saved")}
                >
                  <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Bookmark className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-foreground">Saved Jobs</span>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Smart Tools & Utilities */}
            <div>
              <h3 className="font-display font-semibold text-foreground text-lg mb-3">Smart Tools & Utilities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Jobs For You */}
                <div onClick={() => navigate("/for-you")} className="block cursor-pointer">
                  <Card className="bg-white dark:bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4 flex items-center justify-between h-full">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">Jobs For You</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Find jobs matching your qualification & age</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </div>

                {/* Online Application Guidance */}
                <Link to="/formmate" className="block">
                  <Card className="bg-white dark:bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4 flex items-center justify-between h-full">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">Application Guidance</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Copy and paste details into forms with a tap</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>

                {/* Upload Your Documents */}
                <div onClick={handleUploadDocuments} className="block cursor-pointer">
                  <Card className="bg-white dark:bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4 flex items-center justify-between h-full">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">Upload Your Documents</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Automatically fill profile details from documents</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </div>

                {/* Syllabus Finder */}
                <div onClick={() => navigate("/syllabus")} className="block cursor-pointer">
                  <Card className="bg-white dark:bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4 flex items-center justify-between h-full">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <SearchCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">Syllabus Finder</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Search and view exam syllabi instantly</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </div>

                {/* Telegram Alerts */}
                {user && (
                  <div onClick={() => navigate("/settings/notifications")} className="block cursor-pointer sm:col-span-2">
                    <Card className="bg-white dark:bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Send className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">Telegram Alerts</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">Configure state, qualification, and job category alerts</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Dark Mode Card (Mobile Only) */}
                <div className="block md:hidden sm:col-span-2">
                  <Card className="bg-white dark:bg-card border-border/50 shadow-md">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                          {theme === "dark" ? (
                            <Moon className="h-5 w-5 text-primary" />
                          ) : (
                            <Sun className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">Dark Mode</h4>
                          <p className="text-xs text-muted-foreground">{theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}</p>
                        </div>
                      </div>
                      <Switch
                        checked={theme === "dark"}
                        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                        className="data-[state=checked]:bg-primary"
                      />
                    </CardContent>
                  </Card>
                </div>

              </div>
            </div>

            {/* Resources & Support */}
            <div>
              <h3 className="font-display font-semibold text-foreground text-lg mb-3">Resources & Support</h3>
              <Card className="bg-white dark:bg-card border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {supportItems.map(renderItem)}
                </CardContent>
              </Card>
            </div>

            {/* Legal & Policies */}
            <div>
              <h3 className="font-display font-semibold text-foreground text-lg mb-3">Legal & Policies</h3>
              <Card className="bg-white dark:bg-card border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {legalItems.map(renderItem)}
                </CardContent>
              </Card>
            </div>

            {/* Session Actions (Reset Password & Logout) (Mobile Only, Bottom of Page) */}
            {user && (
              <div className="block md:hidden space-y-3 pt-6 pb-2">
                <Button
                  variant="default"
                  className="w-full bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 font-medium transition-colors shadow-sm"
                  onClick={handleResetPassword}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </Button>

                <Button
                  variant="default"
                  className="w-full bg-destructive/5 hover:bg-destructive/10 text-destructive border border-destructive/20 font-medium transition-colors shadow-sm"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* Suggestions & Grievances Dialog Modal */}
      <Dialog open={isFeedbackOpen} onOpenChange={(open) => { setIsFeedbackOpen(open); if (!open) setIsAnonymous(false); }}>
        <DialogContent className="max-w-md w-[92%] sm:w-full rounded-2xl p-6 border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden">
          {/* Subtle top primary gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 gradient-primary" />
          
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2.5 bg-primary/10 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-[10px] tracking-wider uppercase text-primary/80">
                  User Support
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">JobsTrackr Companion</span>
              </div>
            </div>
            <DialogTitle className="text-xl font-bold font-display text-foreground mt-1 tracking-tight">
              Feedback & Grievances
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Have a suggestion or facing an issue? Send us a message directly and we will address it promptly.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFeedbackSubmit} className="space-y-4 mt-4">
            {/* Feedback Type Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">What would you like to submit?</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFeedbackType("suggestion")}
                  className={`py-3 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    feedbackType === "suggestion"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  💡 Suggestion
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType("grievance")}
                  className={`py-3 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    feedbackType === "grievance"
                      ? "bg-destructive text-destructive-foreground border-destructive shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  ⚠️ Grievance
                </button>
              </div>
            </div>

            {/* Anonymous Toggle - Premium Card */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/35 border border-border/40 hover:bg-secondary/50">
              <div className="space-y-0.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Submit Anonymously
                </label>
                <p className="text-[10px] text-muted-foreground leading-normal">Do not attach your email address or account</p>
              </div>
              <Switch
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* Email Address or Anonymous Banner */}
            {isAnonymous ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                <EyeOff className="h-4.5 w-4.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Anonymous Mode Enabled</span>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    We will not collect your email address. Note that support agents will not be able to reply back directly.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="feedback-email" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Your Email Address</label>
                  {(!!user || isGuestMode) && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                      Verified
                    </span>
                  )}
                </div>
                <input
                  id="feedback-email"
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  disabled={!!user || isGuestMode}
                  placeholder="name@example.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 disabled:bg-secondary/20 transition-all font-medium placeholder:text-muted-foreground/60"
                />
              </div>
            )}

            {/* Message Body */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="feedback-message" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Your Message</label>
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                  feedbackMessage.length > 450 
                    ? "bg-destructive/10 text-destructive font-bold" 
                    : "bg-secondary/60 text-muted-foreground"
                }`}>
                  {feedbackMessage.length} / 500
                </span>
              </div>
              <Textarea
                id="feedback-message"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value.slice(0, 500))}
                placeholder={
                  feedbackType === "suggestion"
                    ? "Let us know how we can make JobsTrackr better..."
                    : "Describe the issue or error you encountered..."
                }
                required
                rows={4}
                className="rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm leading-relaxed placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsFeedbackOpen(false); setIsAnonymous(false); }}
                className="w-full text-xs py-5 rounded-xl font-semibold border-border hover:bg-secondary/50 transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={feedbackSubmitting}
                className={`w-full text-xs py-5 rounded-xl font-bold shadow-md transition-all ${
                  feedbackType === "grievance"
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-primary hover:bg-primary/95 text-white"
                }`}
              >
                {feedbackSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Submitting...
                  </>
                ) : (
                  "Submit Message"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
