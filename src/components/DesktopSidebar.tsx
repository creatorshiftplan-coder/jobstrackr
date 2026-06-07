import {
  Home,
  Search,
  TrendingUp,
  FileText,
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
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
  { title: "Explore", url: "/search", icon: Search },
  { title: "Trending", url: "/trending", icon: TrendingUp },
  { title: "My Exams", url: "/tracker", icon: FileText },
  { title: "Saved Jobs", url: "/saved", icon: Bookmark },
  { title: "Profile", url: "/profile", icon: User },
];

export function DesktopSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    { title: "Syllabus Finder", url: "/syllabus", icon: BookOpen },
    { title: "Application Guide", url: "/formmate", icon: ClipboardList },
    { title: "Upload Documents", url: "/documents", icon: Upload },
    { title: "Sector Preferences", url: "/edit-sector-preferences", icon: Settings },
    ...(user ? [{ title: "Telegram Alerts", url: "/settings/notifications", icon: Send }] : []),
  ];

  const supportItems = [
    { title: "User Manual", url: "/user-manual", icon: BookOpen },
    { title: "Frequently Asked Questions", url: "/faq", icon: HelpCircle },
    { title: "Help & Support", url: "/help", icon: MessageSquare },
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Briefcase className="h-5 w-5 text-primary-foreground" />
          </div>
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
                    <NavLink
                      to={item.url}
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
  );
}
