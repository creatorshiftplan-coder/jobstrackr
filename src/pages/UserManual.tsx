import { ArrowLeft, BookOpen, Smartphone, Laptop, LayoutDashboard, Search, FileText, Bookmark, User, Copy, ClipboardList, Bell, Settings, HelpCircle, Sparkles, CheckCircle, Info, ShieldCheck, TrendingUp, Upload, MessageSquare, Plus, Brain, RefreshCw } from "lucide-react";
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

        {/* 3. Home Dashboard & Jobs For You */}
        <Section title="3. Home Dashboard & Jobs For You" icon={LayoutDashboard}>
          <p>
            The Home dashboard is organized to display the most relevant government job opportunities for your profile instantly:
          </p>

          <div className="space-y-3 mt-2">
            {[
              { title: "New Government Jobs", content: "The 7 most recent active jobs verified on the platform.", action: "Tap a card for details; swipe or click arrows to scroll." },
              { title: "My Active Exams", content: "Exams you are currently tracking.", action: "Shows tracking status, notifications, and links to syllabus." },
              { title: "Based on Your Exams", content: "Directly lists jobs associated with your tracked exams.", action: "Renders relevant recruitment alerts automatically." },
              { 
                title: "Jobs For You", 
                content: "Personalized matching engine recommendations.", 
                action: "How it works: The platform matches active vacancies against your Profile Wizard details (including qualification level, specific stream/specialization, preferred sectors, location, and age limits). Tap 'Show All' to open the complete recommendations list." 
              }
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

        {/* 4. Search, Explore & AI Search */}
        <Section title="4. Search, Explore & AI Search" icon={Search}>
          <div className="space-y-3 text-xs">
            <p>Our search interface enables you to look up any active recruitment posting on the platform:</p>
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>Navigate to the <span className="font-semibold text-foreground">Search</span> tab.</li>
              <li>Type keywords like department name, location (state/city), role title, or exam category.</li>
              <li>Use tags and filters to narrow down by category, location, or educational requirements.</li>
            </ol>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
              <span className="font-semibold text-primary text-xs flex items-center gap-1">
                <Brain className="h-3.5 w-3.5" /> 🤖 No Results? Search with AI!
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                If the specific job or recruitment drive you are typing does not show up in the results, simply click the **"Search with AI"** button. This invokes our advanced AI parser which crawls official announcements, fetches the job details, and backfills it into the database for you instantly.
              </p>
            </div>
          </div>
        </Section>

        {/* 5. Job Details & Tracking Exams */}
        <Section title="5. Job Details & Tracking Exams" icon={FileText}>
          <p className="text-xs mb-2">Each job details sheet maps important information extracted directly from official alerts:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 border border-border rounded-lg"><strong>Important Dates:</strong> Form start date, deadline, and exam dates</div>
            <div className="p-2 border border-border rounded-lg"><strong>Eligibility:</strong> Requirements checklist (Degree, Age bounds)</div>
            <div className="p-2 border border-border rounded-lg"><strong>Application Fee:</strong> Breakdown by candidate categories</div>
            <div className="p-2 border border-border rounded-lg"><strong>Official Links:</strong> Direct, secure links to apply on official portals</div>
          </div>
          
          <div className="mt-3 space-y-2 text-xs border-t pt-3">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-primary" /> Tracking an Exam
            </h4>
            <p className="text-muted-foreground">
              Tracking an exam binds it to your dashboard so you never miss notifications, admit cards, or results. You can track any exam via two paths:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1 pl-1 text-[11px] text-muted-foreground">
              <li><strong className="text-foreground">From the Job Details page:</strong> When viewing a job posting, scroll down to the bottom actions card and tap the **"Track Exam"** button.</li>
              <li><strong className="text-foreground">From the dashboard:</strong> Navigate to your dashboard, locate the **"My Exams"** section, tap the **"+" (plus sign)** to open the Exam Catalog, search for your exam, and click to start tracking.</li>
            </ul>
          </div>
        </Section>

        {/* 6. My Active Exams & Syllabus Finder */}
        <Section title="6. My Active Exams & Syllabus Finder" icon={BookOpen}>
          <div className="space-y-3 text-xs">
            <div>
              <h4 className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <BookOpen className="h-4 w-4 text-primary" /> Active Exam Cards & Details
              </h4>
              <p className="text-muted-foreground">
                Tap or click on any exam card under your **"My Active Exams"** section to expand it and reveal detailed tabs:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1 pl-1 text-[11px] text-muted-foreground">
                <li><strong className="text-foreground">Syllabus & Info:</strong> Access structured exam papers, subject-wise weightage, and download official syllabus PDFs.</li>
                <li><strong className="text-foreground">Dates & News:</strong> View key timelines (form deadlines, card release, exam dates), active notifications, and relevant resources.</li>
                <li><strong className="text-foreground">Credentials Vault:</strong> Keep track of your registration numbers and passwords securely on the card so you never lose them during application phases.</li>
              </ul>
              <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/20 mt-2 flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-primary shrink-0 mt-0.5 animate-spin-slow" />
                <div>
                  <strong className="text-foreground">Refresh Status:</strong> You can pull the latest official alerts, date changes, and notification statuses dynamically by clicking the <strong className="text-foreground">"Refresh Status"</strong> button on the exam card.
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" /> Trending Exams
              </h4>
              <p className="text-muted-foreground">
                Located on the Search and Dashboard view, this lists examinations currently seeing the highest search and tracking volume among all candidates. You can track them directly, see active vacancy statistics, and review body-wise recruitment counts.
              </p>
            </div>
          </div>
        </Section>

        {/* 7. Saving & Managing Jobs */}
        <Section title="7. Saving & Managing Jobs" icon={Bookmark}>
          <div className="space-y-2 text-xs">
            <p><span className="font-semibold text-foreground">Bookmark:</span> Tap the bookmark icon on any job card. It turns solid once saved.</p>
            <p><span className="font-semibold text-foreground">View Saved:</span> Navigate to the Saved tab to see all marked listings.</p>
            <p><span className="font-semibold text-foreground">Remove:</span> Tap the bookmark icon again to unsave.</p>
          </div>
        </Section>

        {/* 8. Profile & FormMate (Document Upload) */}
        <Section title="8. Profile & FormMate (Document Upload)" icon={User}>
          <p>Complete your profile fields to generate tailored match alerts and use autofill features:</p>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex justify-between border-b pb-1">
              <span>Personal Details</span>
              <span className="text-foreground font-medium">Name, DOB, gender, and category details</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Education Details</span>
              <span className="text-foreground font-medium">Degrees, stream names, percentages, and board data</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Preferred Sectors</span>
              <span className="text-foreground font-medium">Railways, Defence, banking, state PSCs, etc.</span>
            </div>
          </div>

          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2 text-xs mt-3">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-primary" /> FormMate Document Upload (OCR)
            </h4>
            <p className="text-muted-foreground">
              Tired of entering form details manually? Open FormMate and choose **"Upload Your Documents"**. You can upload photos or PDFs of your certificates, resume, Aadhaar, or PAN card. FormMate's built-in intelligent OCR pipeline will read your documents and automatically extract fields (like name, date of birth, document numbers, and marks) to pre-fill your profile instantly.
            </p>
          </div>

          <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs rounded-xl border border-amber-500/20 flex gap-2 mt-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Security Note:</strong> Identifiers such as Aadhaar, PAN, and passport numbers are encrypted at rest. They are decrypted locally inside your browser on demand.
            </div>
          </div>
        </Section>

        {/* 9. Telegram Alerts & Settings */}
        <Section title="9. Telegram Alerts & Settings" icon={Bell}>
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

        {/* 10. Feedback & Grievances Hub */}
        <Section title="10. Feedback & Grievances Hub" icon={MessageSquare}>
          <div className="space-y-2 text-xs">
            <p>
              We value your experience and review all bug reports, database errors, and recommendations closely:
            </p>
            <p>
              <strong>How to use:</strong> At the bottom of the Home dashboard or under the Settings page, locate the **"Suggestions & Grievances"** form. You can submit suggestions for new features, report technical issues, or highlight incorrect job notifications.
            </p>
            <p className="text-muted-foreground">
              Once submitted, administrators can inspect the grievance, track status updates (Pending, Under Review, Resolved), and make database fixes immediately.
            </p>
          </div>
        </Section>

        {/* 11. Pro Tips */}
        <Section title="11. Pro Tips & Best Practices" icon={Sparkles}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-secondary/20 dark:bg-secondary/10 rounded-lg">
              <strong className="text-foreground block mb-1">⚡ Complete the For-You Wizard</strong>
              Adding detailed qualifications and stream choices yields much more accurate match results.
            </div>
            <div className="p-3 bg-secondary/20 dark:bg-secondary/10 rounded-lg">
              <strong className="text-foreground block mb-1">🌐 Offline Access (PWA)</strong>
              The app remains fully browsable for previously fetched lists even when offline.
            </div>
          </div>
        </Section>

        {/* 12. You're Ready to Begin */}
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
