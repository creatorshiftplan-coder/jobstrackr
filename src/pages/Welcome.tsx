import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { CheckCircle, ChevronRight } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import welcomeLight from "@/assets/welcome-light.png";
import welcomeDark from "@/assets/welcome-dark.png";

const Welcome = () => {
  const navigate = useNavigate();
  const { user, loading, enterGuestMode } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      console.error("Google sign in error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const features = [
    "We track the exams — you focus on studying",
    "Upload documents once & fill forms hassle-free",
    "Find jobs that match your qualification and goals",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col lg:grid lg:grid-cols-12 lg:overflow-hidden select-none">
      {/* Skip Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => {
            enterGuestMode();
            navigate("/", { replace: true });
          }}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium bg-card/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/40 shadow-sm"
        >
          Skip for now
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Left Panel - Premium Government Portal Branding & Mockups (Desktop only) */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 bg-slate-950 text-white p-8 xl:p-10 flex-col justify-between relative overflow-hidden border-r border-border/10">
        {/* Decorative Glowing Orbs & Grid Patterns */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
              Live Tracker Network
            </span>
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            JobsTrackr
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
            The intelligent companion for tracking government exams & application workflows.
          </p>
        </div>

        {/* Dynamic Mockup Visuals Container */}
        <div className="relative z-10 my-auto space-y-5">
          {/* Card 1: Exam Progress */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary/80">Exam Status</span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">Active</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200">UPSC CSE Prelims 2026</span>
                  <span className="text-slate-400">12 Days Left</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '85%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200">SSC CGL Registration</span>
                  <span className="text-amber-400">Apply Now</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: FormMate Document Scan */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors shadow-2xl">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-5 w-5 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">FormMate Document Vault</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-950/40 p-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Aadhaar Card</span>
                <span className="text-emerald-500 font-bold">PDF</span>
              </div>
              <div className="bg-slate-950/40 p-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Mark Sheet</span>
                <span className="text-emerald-500 font-bold">OCR</span>
              </div>
              <div className="bg-slate-950/40 p-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Signature</span>
                <span className="text-emerald-500 font-bold">PNG</span>
              </div>
              <div className="bg-slate-950/40 p-2 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-slate-400">Category Cert</span>
                <span className="text-emerald-500 font-bold">PDF</span>
              </div>
            </div>
          </div>

          {/* Card 3: Live Vacancies Notification */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors shadow-2xl flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl flex items-center justify-center mt-0.5">
              <span className="text-indigo-400 text-sm">🔔</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">New Vacancy Alert</span>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">RRB NTPC Notification</p>
              <p className="text-[10px] text-slate-400 leading-normal mt-0.5">11,558 openings matching your profiles.</p>
            </div>
          </div>
        </div>

        {/* Footer Branding */}
        <div className="relative z-10 flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>SECURE GATEWAY</span>
          <span>v2.1.0</span>
        </div>
      </div>

      {/* Right Panel - User Actions */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto lg:col-span-7 xl:col-span-8 relative py-8 lg:py-16">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-6 max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            <img src={logoColor} alt="JobsTrackr" className="h-16 sm:h-20 w-auto mb-2 invert dark:invert-0" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-widest font-display uppercase">
              JOBSTRACKR
            </h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
              All your government job tracking, documents, and notifications in one secure dashboard.
            </p>
          </div>

          {/* Illustration for mobile/tablet view only */}
          <div className="w-full max-w-[200px] lg:hidden my-2">
            <img
              src={theme === "dark" ? welcomeDark : welcomeLight}
              alt="JobsTrackr illustration"
              className="w-full h-auto object-contain mx-auto"
              loading="lazy"
            />
          </div>

          {/* Feature Lines */}
          <div className="w-full space-y-2.5 px-1 mt-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/50 hover:bg-secondary/20 transition-all duration-200 shadow-sm">
                <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-foreground leading-normal">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="px-6 max-w-md mx-auto w-full space-y-3.5">
          {/* Sign up Button */}
          <Button
            onClick={() => navigate("/auth?mode=signup")}
            className="w-full h-12 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/95 text-white shadow-md btn-modern"
          >
            Create Free Account
          </Button>

          {/* Continue with Google Button */}
          <Button
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full h-12 text-sm font-semibold rounded-xl bg-card border-border hover:bg-muted btn-modern flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Login Link */}
          <p className="text-center text-xs text-muted-foreground pt-1">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/auth?mode=login")}
              className="text-primary font-bold hover:underline"
            >
              Log In
            </button>
          </p>

          {/* Legal Links */}
          <p className="text-center text-[10px] text-muted-foreground/80 leading-normal pt-2">
            By signing up or signing in, you agree to our{" "}
            <Link to="/terms-of-service" className="text-primary font-medium hover:underline">
              Terms of Service
            </Link>
            {" "}and{" "}
            <Link to="/privacy-policy" className="text-primary font-medium hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
