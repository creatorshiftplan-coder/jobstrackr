import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { User, HelpCircle, LogOut, ChevronRight, Shield, Loader2, Bookmark, ArrowLeft, FileText, Moon, Sun, Upload, ClipboardList, Search, Edit } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTheme } from "next-themes";
import logo from "@/assets/logo.svg";

export default function More() {
  const { user, loading, signOut } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useAdminRole();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-primary-foreground dark:text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="JobsTrackr" className="h-8 w-auto brightness-0 invert dark:brightness-100 dark:invert-0" />
            <span className="font-display font-bold text-xl text-primary-foreground dark:text-foreground tracking-wider">JOBSTRACKR</span>
          </div>
          <Link to="/saved">
            <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
              <Bookmark className="h-5 w-5 text-primary-foreground dark:text-foreground" />
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
                Welcome to JobsTrackr
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
            {/* Avatar Card - Clickable to Profile */}
            <Card 
              className="border-0 shadow-card cursor-pointer hover:bg-secondary/30 transition-colors"
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

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Card 
                className="border-0 shadow-card cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => navigate("/tracker")}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <ClipboardList className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Track an Exam</span>
                </CardContent>
              </Card>
              
              <Card 
                className="border-0 shadow-card cursor-pointer hover:bg-secondary/30 transition-colors"
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
              <Card className="border-0 shadow-card hover:bg-secondary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">Online Application Guidance</h4>
                      <p className="text-xs text-muted-foreground">Just tap copy and paste in the form</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            {/* Upload Documents Link */}
            <Link to="/documents" className="block">
              <Card className="border-0 shadow-card hover:bg-secondary/30 transition-colors">
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
            </Link>

            {/* Day/Night Mode Toggle */}
            <Card className="border-0 shadow-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5 text-primary" />
                  ) : (
                    <Sun className="h-5 w-5 text-primary" />
                  )}
                  <span className="font-medium text-foreground">Dark Mode</span>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-0">
            {[
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

      <BottomNav />
    </div>
  );
}
