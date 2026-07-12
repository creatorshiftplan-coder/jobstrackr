import { useState, useEffect } from "react";
import {
  Home,
  Search,
  TrendingUp,
  FileText,
  CalendarDays,
  User,
  Briefcase,
  BookOpen,
  ClipboardList,
  Upload,
  Settings,
  LogOut,
  Bookmark,
  HelpCircle,
  ShieldCheck,
  CreditCard,
  Shield,
  Moon,
  Sun,
  Send,
  MessageSquare,
  Share2,
  EyeOff,
  Loader2,
  Sparkles,
  Timer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { GUEST_PROFILE } from "@/lib/guestData";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import logoColor from "@/assets/logo-color.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Jobs", url: "/search", icon: Search },
  { title: "Updates", url: "/trending", icon: TrendingUp },
  { title: "My Exams", url: "/tracker", icon: FileText },
  { title: "Exam Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Saved Jobs", url: "/saved", icon: Bookmark },
  { title: "Profile", url: "/profile", icon: User },
];

export function DesktopSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut, isGuestMode } = useAuth();
  const { isAdmin } = useAdminRole();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const toolItems = [
    { title: "Jobs For You", url: "/for-you", icon: Briefcase },
    // Standalone page (separate Vite entry), not a Router route — needs a full
    // navigation, so it's flagged `external` and rendered as an <a> below.
    { title: "Govt Job Quiz", url: "/quiz", icon: Sparkles, external: true },
    { title: "Exam Countdown", url: "/countdown", icon: Timer },
    { title: "Syllabus Finder", url: "/syllabus", icon: BookOpen },
    { title: "Application Guide", url: "/formmate", icon: ClipboardList },
    { title: "Upload Documents", url: "/documents", icon: Upload },
    { title: "Sector Preferences", url: "/edit-sector-preferences", icon: Settings },
    ...(user ? [{ title: "Telegram Alerts", url: "/settings/notifications", icon: Send }] : []),
  ];

  const supportItems = [
    { title: "User Manual", url: "/user-manual", icon: BookOpen },
    { title: "Frequently Asked Questions", url: "/faq", icon: HelpCircle },
    { title: "Feedback & Grievances", onClick: () => setIsFeedbackOpen(true), icon: MessageSquare },
    { title: "Help & Support", url: "/help", icon: HelpCircle },
    { title: "Share this App", onClick: handleShareApp, icon: Share2 },
    { title: "Privacy Policy", url: "/privacy-policy", icon: ShieldCheck },
    { title: "Refund Policy", url: "/refund-policy", icon: CreditCard },
    { title: "Terms of Service", url: "/terms-of-service", icon: FileText },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/welcome");
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <img
            src={logoColor}
            alt="JobsTrackr Logo"
            className="h-8 w-8 shrink-0 object-contain invert dark:invert-0"
          />
          {!collapsed && (
            <span className="text-lg font-bold text-foreground tracking-tight">
              JobsTrackr
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-primary font-semibold"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    {item.external ? (
                      <a
                        href={item.url}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </a>
                    ) : (
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-primary font-semibold"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Panel - only for admins */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-primary font-semibold"
                    >
                      <Shield className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span>Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Support
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {supportItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    {'onClick' in item ? (
                      <SidebarMenuButton
                        onClick={item.onClick}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer"
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url!}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          activeClassName="bg-sidebar-accent text-primary font-semibold"
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px] shrink-0" />
              ) : (
                <Moon className="h-[18px] w-[18px] shrink-0" />
              )}
              {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

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
    </>
  );
}
