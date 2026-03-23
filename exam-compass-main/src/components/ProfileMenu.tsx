import { useState } from "react";
import {
  User,
  Edit,
  FileText,
  Search,
  Briefcase,
  ClipboardList,
  Upload,
  BookOpen,
  Moon,
  Settings,
  HelpCircle,
  Shield,
  CreditCard,
  Scale,
  Lock,
  LogOut,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const menuSections = [
  {
    items: [
      { icon: User, label: "Profile", desc: "" },
      { icon: Edit, label: "Edit My Profile", desc: "" },
      { icon: FileText, label: "Track an Exam", desc: "" },
      { icon: Search, label: "Find an Exam", desc: "" },
      {
        icon: Briefcase,
        label: "Jobs For You",
        desc: "Find eligible jobs matching your age, qualification & preferences",
      },
      {
        icon: ClipboardList,
        label: "Online Application Guidance",
        desc: "Don't waste time searching or recalling — copy and paste what you need with a tap.",
      },
      {
        icon: Upload,
        label: "Upload Your Documents",
        desc: "AI auto-fills your profile from documents",
      },
      {
        icon: BookOpen,
        label: "Syllabus Finder",
        desc: "Search and view exam syllabi powered by AI",
      },
    ],
  },
];

const bottomLinks = [
  { icon: Settings, label: "Sector Preferences" },
  { icon: HelpCircle, label: "Help & Support" },
  { icon: Shield, label: "Privacy Policy" },
  { icon: CreditCard, label: "Refund Policy" },
  { icon: Scale, label: "Terms of Service" },
  { icon: Lock, label: "Admin Panel" },
];

export function ProfileMenu() {
  const [darkMode, setDarkMode] = useState(false);

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95">
          PR
        </button>
      </SheetTrigger>
      <SheetContent className="w-[360px] overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="text-left text-lg font-bold">Menu</SheetTitle>
        </SheetHeader>

        <div className="space-y-1 px-3">
          {menuSections[0].items.map((item) => (
            <button
              key={item.label}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted active:scale-[0.98]"
            >
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                {item.desc && (
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                )}
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          ))}

          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Dark Mode</span>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDark} />
          </div>
        </div>

        <Separator className="my-2" />

        <div className="space-y-0.5 px-3">
          {bottomLinks.map((item) => (
            <button
              key={item.label}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <Separator className="my-2" />

        <div className="px-3 pb-6 flex gap-2">
          <button className="flex-1 rounded-lg border border-input py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]">
            Reset Password
          </button>
          <button className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90 active:scale-[0.98]">
            Logout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}