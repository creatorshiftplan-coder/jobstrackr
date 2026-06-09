import { useState } from "react";
import { ArrowLeft, HelpCircle, Search, MessageSquare, ShieldCheck, RefreshCw, Send, AlertCircle, Smartphone, Bell, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSmartBack } from "@/hooks/useSmartBack";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  icon: any;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "account-need",
    question: "Do I need an account to use the app?",
    answer: "No – you can browse as a Guest. Creating an account unlocks personalised recommendations, exam tracking, profile saving, and notifications.",
    icon: MessageSquare,
  },
  {
    id: "data-safety",
    question: "Is my personal data safe?",
    answer: "Yes. Data resides in an encrypted Supabase database. Sensitive identifiers (Aadhaar, PAN, Passport) are encrypted at rest and are decrypted only on the FormMate page when you explicitly copy them.",
    icon: ShieldCheck,
  },
  {
    id: "refresh-frequency",
    question: "How often is job information refreshed?",
    answer: "Job listings are pulled from the source every 5 minutes (cached via Redis). Your personalised sections update immediately when you pull‑to‑refresh or navigate to a new screen.",
    icon: RefreshCw,
  },
  {
    id: "direct-apply",
    question: "Can I apply for a job directly from the app?",
    answer: "The Apply Now button redirects you to the official government portal where the application is hosted. The app does not host application forms.",
    icon: Send,
  },
  {
    id: "report-error",
    question: "I spotted an error in a job listing – what should I do?",
    answer: "Use the Report button (if present) on the job detail page, or contact us via the Help Center (contact@jobstrackr.in).",
    icon: AlertCircle,
  },
  {
    id: "platforms-supported",
    question: "Does the app work on iOS and Android?",
    answer: "Yes – it is a Progressive Web App (PWA). Install it via the browser's 'Add to Home Screen' option for an app-like experience on both platforms.",
    icon: Smartphone,
  },
  {
    id: "push-notifications",
    question: "How do I enable or disable push notifications?",
    answer: "When you first open the app, a browser prompt asks for notification permission. You can later toggle this in your browser's site settings or via the app's Settings → Notifications.",
    icon: Bell,
  },
  {
    id: "forgot-password",
    question: "What if I forget my password?",
    answer: "On the login screen, tap Forgot Password? and follow the email‑based reset link sent to your registered address.",
    icon: Key,
  },
  {
    id: "telegram-alerts",
    question: "How do I configure Telegram alerts?",
    answer: "Go to More > Telegram Alerts, tap 'Connect Telegram Bot', and click 'Start' in Telegram to link your account. Once connected, configure categories (SSC, UPSC, Banking, etc.), alert types, qualifications, and state preferences to receive personalized, real-time alerts.",
    icon: Send,
  },
  {
    id: "telegram-stop",
    question: "How do I temporarily pause or stop Telegram notifications?",
    answer: "You can toggle the 'Alerts Status' switch on the Telegram Alerts page in the app, or send the command '/stop' directly to the Telegram bot. To resume, toggle it back on or send '/resume' to the bot.",
    icon: Bell,
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/more");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
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
            <HelpCircle className="h-5 w-5 text-white" />
            <h1 className="font-display font-bold text-xl text-white">Frequently Asked Questions</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search FAQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-card border-border/50 shadow-sm rounded-xl"
          />
        </div>

        {/* FAQ Accordion */}
        {filteredFaqs.length > 0 ? (
          <Card className="border-0 shadow-card bg-white dark:bg-card overflow-hidden rounded-xl">
            <CardContent className="p-2 sm:p-4">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq) => {
                  const Icon = faq.icon;
                  return (
                    <AccordionItem key={faq.id} value={faq.id} className="border-b border-border last:border-0">
                      <AccordionTrigger className="hover:no-underline text-left text-sm py-4 font-medium text-foreground">
                        <span className="flex items-center gap-3 pr-2">
                          <span className="h-8 w-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </span>
                          {faq.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-xs leading-relaxed pl-11 pb-4">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No FAQs found matching "{searchQuery}"
          </div>
        )}

        {/* Footer Guidance */}
        <Card className="border-0 shadow-card bg-primary/5 dark:bg-primary/10 border-primary/20 rounded-xl">
          <CardContent className="p-4 text-center text-xs text-muted-foreground space-y-1">
            <p>Still have questions?</p>
            <p>
              Get in touch with us at{" "}
              <a
                href="mailto:contact@jobstrackr.in"
                className="text-primary font-medium hover:underline"
              >
                contact@jobstrackr.in
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
