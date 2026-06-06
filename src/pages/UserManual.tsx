import { ArrowLeft, BookOpen, Smartphone, Laptop, LayoutDashboard, Search, FileText, Bookmark, User, Copy, ClipboardList, Bell, Settings, HelpCircle, Sparkles, CheckCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function UserManual() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/more");

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <Card className="border-0 shadow-card bg-white dark:bg-card">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-base sm:text-lg font-semibold text-foreground mt-0">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground space-y-3">
        {children}
      </CardContent>
    </Card>
  );

  const Step = ({ num, title, result }: { num: number; title: string; result: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-secondary/30 dark:bg-secondary/10 border border-border/50">
      <div className="flex items-center gap-2 min-w-[140px]">
        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
          {num}
        </div>
        <span className="font-semibold text-foreground text-sm">Step {num}</span>
      </div>
      <div className="flex-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{result}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F4FD] via-[#D6EEFF] to-[#F0F8FF] dark:from-[#101922] dark:via-[#141f2b] dark:to-[#1a2838] pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[hsl(var(--blue-900))] px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-10 w-10 rounded-full bg-[hsl(var(--blue-700))] flex items-center justify-center hover:bg-[hsl(var(--blue-600))] transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-white" />
            <h1 className="font-display font-bold text-xl text-white">User Manual</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-3xl mx-auto">
        {/* Intro */}
        <div className="text-center space-y-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 dark:bg-primary/20">Official Guide</Badge>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">📘 Welcome to JobsTrackr</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Your complete guide to discovering, tracking, and applying for government job opportunities in India.
          </p>
        </div>

        {/* 1. Getting Started */}
        <Section title="1. Getting Started" icon={Sparkles}>
          <p>Launch your job search journey in three simple steps:</p>
          <div className="space-y-3 mt-2">
            <Step num={1} title="Open JobsTrackr" result="The Welcome screen appears on your screen." />
            <Step num={2} title="Choose Access Mode" result="Choose 'Guest Mode' to explore immediately, or 'Login / Sign Up' for full access." />
            <Step num={3} title="Authentication (Optional)" result="Enter credentials or choose social sign-in to securely access your profile." />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs mt-3 border border-emerald-500/20">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Pro-tip:</span> Guest mode lets you browse instantly. You can always sign up later to save preferences, receive personalized recommendations, and track updates.
            </div>
          </div>
        </Section>

        {/* 2. Navigation Overview */}
        <Section title="2. Navigation Overview" icon={Laptop}>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-2">
                <Smartphone className="h-4 w-4 text-primary" /> Mobile Bottom Navigation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "🏠 Home", desc: "Your dashboard with live job feeds" },
                  { label: "🔍 Search", desc: "Find jobs by keyword, location, or exam" },
                  { label: "🔖 Saved", desc: "View and manage bookmarked jobs" },
                  { label: "👤 Profile", desc: "Edit qualifications, sectors, and preferences" },
                  { label: "⚙️ More", desc: "FAQ, Help, Settings, and other tools" }
                ].map(item => (
                  <div key={item.label} className="p-2.5 rounded-lg bg-secondary/20 dark:bg-secondary/10 flex flex-col">
                    <span className="font-medium text-foreground text-sm">{item.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-2">
                <Laptop className="h-4 w-4 text-primary" /> Desktop Sidebar Features
              </h4>
              <p className="text-xs mb-2">The sidebar displays all mobile options with text labels, and houses these toggles:</p>
              <ul className="list-disc list-inside text-xs space-y-1 ml-1 pl-1">
                <li><span className="font-medium text-foreground">Theme Toggle:</span> Switch between Light and Dark mode.</li>
                <li><span className="font-medium text-foreground">Logout:</span> Safely end your active session.</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 3. Home Dashboard */}
        <Section title="3. Home Dashboard" icon={LayoutDashboard}>
          <p>
            The Home dashboard is organized in horizontal sections designed to keep relevant postings at your fingertips:
          </p>

          <div className="space-y-3 mt-2">
            {[
              { title: "New Government Jobs", content: "The 7 most recent active jobs.", action: "Tap card for details, swipe or click arrows to scroll." },
              { title: "My Active Exams", content: "Exams you track (e.g. UPSC CSE, SSC CGL).", action: "Tap an exam to see upcoming jobs and syllabus links." },
              { title: "Based on Your Exams", content: "Jobs matching your tracked exams.", action: "Displays matching vacancies instantly." },
              { title: "Jobs For You", content: "Personalized suggestions using profile answers.", action: "Tap 'Show All' to open the complete recommendations list." }
            ].map(sec => (
              <div key={sec.title} className="p-3 rounded-lg border border-border bg-secondary/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-xs uppercase tracking-wider">{sec.title}</span>
                </div>
                <p className="text-xs text-foreground font-medium">{sec.content}</p>
                <p className="text-xs text-muted-foreground italic">{sec.action}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Searching for Jobs */}
        <Section title="4. Searching for Jobs" icon={Search}>
          <ol className="list-decimal list-inside space-y-2 ml-1 text-xs">
            <li>Go to the <span className="font-medium text-foreground">Search</span> tab.</li>
            <li>Enter keywords such as department, location, job title, or exam.</li>
            <li>Filter results by categories, states, or qualification requirements.</li>
            <li>Tap any card to see full specifications or save by clicking the bookmark icon.</li>
          </ol>
        </Section>

        {/* 5. Job Details Page */}
        <Section title="5. Job Details Page" icon={FileText}>
          <p>Each job page displays comprehensive details mapped directly from official resources:</p>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2 border border-border rounded-lg"><strong>Important Dates:</strong> Application window & exam timeline</div>
            <div className="p-2 border border-border rounded-lg"><strong>Eligibility:</strong> Qualification, Age and Experience check</div>
            <div className="p-2 border border-border rounded-lg"><strong>Application Fee:</strong> Detail by category</div>
            <div className="p-2 border border-border rounded-lg"><strong>Apply Now:</strong> Safe redirect to official portals</div>
          </div>
        </Section>

        {/* 6. Saving & Managing Jobs */}
        <Section title="6. Saving & Managing Jobs" icon={Bookmark}>
          <div className="space-y-2 text-xs">
            <p><span className="font-semibold text-foreground">Bookmark:</span> Tap the bookmark icon on any job card. It turns solid once saved.</p>
            <p><span className="font-semibold text-foreground">View Saved:</span> Navigate to the Saved tab to see all marked listings.</p>
            <p><span className="font-semibold text-foreground">Remove:</span> Tap the bookmark icon again to unsave.</p>
          </div>
        </Section>

        {/* 7. Profile Management */}
        <Section title="7. Profile Management" icon={User}>
          <p>Keep your profile current to drive personalized recommendations:</p>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex justify-between border-b pb-1">
              <span>Personal Details</span>
              <span className="text-foreground font-medium">Name, DOB, marital status, gender, address</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Education</span>
              <span className="text-foreground font-medium">Degrees, pass year, percentage, and streams</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Preferred Sectors</span>
              <span className="text-foreground font-medium">Sectors (e.g. Railways, Defence) used for feeds</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs rounded-xl border border-amber-500/20 flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Security Note:</strong> Identifiers such as Aadhaar, PAN, and passport numbers are encrypted at rest. They are decrypted locally inside your browser on demand.
            </div>
          </div>
        </Section>

        {/* 8. FormMate & 9. Exam Tracker */}
        <Section title="8. FormMate & 9. Exam Tracker" icon={Copy}>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1">FormMate App Helper</h4>
              <p className="text-xs">
                Autofills and copies your profile fields (DOB, names, ID numbers) with a single tap. Simply copy from FormMate and paste into official government application portals.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1">Exam Tracker</h4>
              <p className="text-xs">
                Follow specific exams to receive instant notifications on new openings, notifications release, admit card updates, and result declarations.
              </p>
            </div>
          </div>
        </Section>

        {/* 10. Notifications & 11. Settings */}
        <Section title="10. Notifications & 11. Settings" icon={Bell}>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1">Telegram Alerts Channel</h4>
              <p className="text-xs">
                Receive instant notifications on Telegram. Go to <strong>More &gt; Telegram Alerts</strong>, tap "Connect Telegram Bot", and click "Start" in the Telegram app to link your account.
              </p>
              <ul className="list-disc list-inside text-[11px] mt-1 space-y-0.5 text-muted-foreground ml-1">
                <li><strong>Categories:</strong> Filter alerts for SSC, UPSC, Banking, Defence, State PSC, Railways, PSU, or Healthcare.</li>
                <li><strong>Qualifications:</strong> Automatically match jobs to your education level (10th, 12th, Graduate, Postgraduate).</li>
                <li><strong>State Filters:</strong> Limit jobs to specific states or select "All India" to receive all national recruitment alerts.</li>
                <li><strong>Alert Types:</strong> Select which alerts to receive (New Jobs, Admit Cards, Results, Answer Keys).</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1">Telegram Bot Commands</h4>
              <p className="text-xs">
                Manage your alerts directly inside Telegram with these bot commands:
              </p>
              <ul className="list-disc list-inside text-[11px] mt-1 space-y-0.5 text-muted-foreground ml-1">
                <li><code>/start</code> - Link your JobsTrackr account</li>
                <li><code>/stop</code> - Temporarily pause alerts</li>
                <li><code>/resume</code> - Resume receiving notifications</li>
                <li><code>/preferences</code> - Get link to configure preferences</li>
                <li><code>/help</code> - Show list of available commands</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1">Preferences Dashboard</h4>
              <p className="text-xs">
                Tweak sector preferences, switch themes (Dark/Light), manage security and password reset, or export/delete your account data directly from the Settings section.
              </p>
            </div>
          </div>
        </Section>

        {/* 12. Pro Tips */}
        <Section title="12. Pro Tips & Best Practices" icon={Sparkles}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-secondary/20 dark:bg-secondary/10 rounded-lg">
              <strong className="text-foreground block mb-1">⚡ Complete the For-You Wizard</strong>
              Adding detailed qualifications and stream choices yields much more accurate match results.
            </div>
            <div className="p-3 bg-secondary/20 dark:bg-secondary/10 rounded-lg">
              <strong className="text-foreground block mb-1">🌐 Offline Access (PWA)</strong>
              The app remains fully browsable for previously fetched lists even when offline.
            </div>
            <div className="p-3 bg-secondary/20 dark:bg-secondary/10 rounded-lg">
              <strong className="text-foreground block mb-1">🎙️ Voice Search</strong>
              Tap the mic icon inside search to speak your queries directly instead of typing.
            </div>
            <div className="p-3 bg-secondary/20 dark:bg-secondary/10 rounded-lg">
              <strong className="text-foreground block mb-1">⌨️ Desktop Shortcuts</strong>
              Use <strong>Ctrl + K</strong> to focus Search, or <strong>Esc</strong> to close active drawers/modals.
            </div>
          </div>
        </Section>

        {/* 13. You're Ready to Begin */}
        <Card className="border-0 shadow-card bg-primary text-primary-foreground">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> You're Ready to Begin!
            </h3>
            <p className="text-sm text-primary-foreground/90">
              Start exploring, set up your profile, and let JobsTrackr do the heavy lifting of matching you with active government career opportunities.
            </p>
            <div className="pt-2 flex flex-col gap-1 text-xs text-primary-foreground/85">
              <span>📧 Support: <a href="mailto:contact@jobstrackr.in" className="underline font-medium hover:text-white">contact@jobstrackr.in</a></span>
              <span>🌐 Web: <a href="https://jobstrackr.in" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-white">jobstrackr.in</a></span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
