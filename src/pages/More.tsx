import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { User, HelpCircle, LogOut, ChevronRight, Shield, ShieldCheck, CreditCard, Loader2, Bookmark, ArrowLeft, FileText, Moon, Sun, Upload, ClipboardList, Search, Edit, Key, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTheme } from "next-themes";
import logoWhite from "@/assets/logo-white.png";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { GUEST_PROFILE } from "@/lib/guestData";

export default function More() {
  const { user, loading, signOut, resetPassword, isGuestMode } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useAdminRole();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showAuthRequired } = useAuthRequired();

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-primary-foreground dark:text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoWhite} alt="JobsTrackr" className="h-7 sm:h-8 w-auto" />
            <span className="font-display font-bold text-base sm:text-lg text-primary-foreground dark:text-foreground tracking-wider">JOBSTRACKR</span>
          </div>
          <Link to="/saved">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
              <Bookmark className="h-4 w-4 text-primary-foreground dark:text-foreground" />
            </div>
          </Link>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Profile Card - Shows for both guests and authenticated users */}
        {!user ? (
          // Guest user profile card with welcome message
          <Card
            className="bg-white dark:bg-card border-border/50 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/profile")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground">Welcome to JobsTrackr</h3>
                <p className="text-sm text-muted-foreground">Login to save jobs, track applications, and get personalized recommendations</p>
                <Link
                  to="/auth"
                  className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Login / Sign Up
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          // Authenticated user profile card
          <Card
            className="bg-white dark:bg-card border-border/50 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/profile")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-foreground">{userInitials}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground">{userName}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <button
                  className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/profile");
                  }}
                >
                  <Edit className="h-3 w-3" />
                  Edit My Profile
                </button>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions - Show for both guests and authenticated users */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="bg-white dark:bg-card border-border/50 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={handleTrackExam}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Track an Exam</span>
            </CardContent>
          </Card>

          <Card
            className="bg-white dark:bg-card border-border/50 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/search")}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Find an Exam</span>
            </CardContent>
          </Card>
        </div>

        {/* Online Application Guidance Link */}
        <Link to="/formmate" className="block">
          <Card className="bg-white dark:bg-card border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Online Application Guidance</h4>
                  <p className="text-xs text-muted-foreground">Don't waste time searching or recalling — copy and paste what you need with a tap.</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* Upload Documents Link */}
        <div onClick={handleUploadDocuments} className="block cursor-pointer">
          <Card className="bg-white dark:bg-card border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Upload Your Documents</h4>
                  <p className="text-xs text-muted-foreground">AI auto-fills your profile from documents</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Day/Night Mode Toggle */}
        <Card className="bg-white dark:bg-card border-border/50 shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                {theme === "dark" ? (
                  <Moon className="h-6 w-6 text-primary" />
                ) : (
                  <Sun className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Dark Mode</h4>
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

        <Card className="bg-white dark:bg-card border-border/50 shadow-md overflow-hidden">
          <CardContent className="p-0">
            {[
              ...(user ? [{ icon: Sparkles, label: "Sector Preferences", path: "/edit-sector-preferences" }] : []),
              { icon: HelpCircle, label: "Help & Support", path: "/help" },
              { icon: ShieldCheck, label: "Privacy Policy", path: "/privacy-policy" },
              { icon: CreditCard, label: "Refund Policy", path: "/refund-policy" },
              { icon: FileText, label: "Terms of Service", path: "/terms-of-service" },
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

        {/* Only show logout and reset password for authenticated users */}
        {user && (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full shadow-md"
              onClick={handleResetPassword}
            >
              <Key className="mr-2 h-4 w-4" />
              Reset Password
            </Button>

            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive shadow-md"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
