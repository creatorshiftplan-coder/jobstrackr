import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSmartBack } from "@/hooks/useSmartBack";
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import logoColor from "@/assets/logo-color.png";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
  const { toast } = useToast();

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "Welcome back!" });
        navigate("/");
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account, then login.",
        });
        setIsLogin(true);
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch (error: any) {
      let message = error.message;
      if (error.message.includes("User already registered")) {
        message = "An account with this email already exists. Please login instead.";
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:grid lg:grid-cols-12 lg:overflow-hidden select-none">
      {/* Left Panel - Onboarding Visual Tracking & Timeline (Desktop only) */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 bg-slate-950 text-white p-8 xl:p-10 flex-col justify-between relative overflow-hidden border-r border-border/10">
        {/* Grid and Glow Backgrounds */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 font-mono">
              Exam Tracking System
            </span>
          </div>
          <h2 className="text-xl font-bold font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            JobsTrackr
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Always stay one step ahead in your exam preparation workflow.
          </p>
        </div>

        {/* Middle Visual - Live Status Timeline Mockup */}
        <div className="relative z-10 my-auto p-5 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tracked Exam</span>
              <p className="text-xs font-bold text-slate-200">UPSC Civil Services 2026</p>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">Stage 3 / 5</span>
          </div>

          {/* Timeline Steps */}
          <div className="relative pl-6 space-y-4 text-xs">
            {/* Vertical Connector Line */}
            <div className="absolute left-2 top-1.5 bottom-1.5 w-0.5 bg-slate-800" />
            <div className="absolute left-2 top-1.5 h-1/2 w-0.5 bg-primary" />

            {/* Step 1 */}
            <div className="relative flex items-start gap-3">
              <div className="absolute -left-[21px] mt-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
              <div>
                <span className="font-semibold text-slate-200">Form Submission Filled</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Matched and validated via FormMate Vault.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-start gap-3">
              <div className="absolute -left-[21px] mt-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
              <div>
                <span className="font-semibold text-slate-200">Admit Card Generated</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Retrieved automatically from official registry.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-start gap-3">
              <div className="absolute -left-[21px] mt-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20 animate-pulse" />
              <div>
                <span className="font-semibold text-slate-100">Exam Date Announced</span>
                <p className="text-[10px] text-blue-400 font-medium mt-0.5">Sunday, July 12 — 28 Days remaining.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative flex items-start gap-3 opacity-40">
              <div className="absolute -left-[21px] mt-0.5 h-2.5 w-2.5 rounded-full bg-slate-800" />
              <div>
                <span className="font-semibold text-slate-300">Answer Key Release</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Estimated release: 48h post examination.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>SECURE END-TO-END</span>
          <span>COMPANION</span>
        </div>
      </div>

      {/* Right Panel - Login/Signup Card Form */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto lg:col-span-7 xl:col-span-8 relative py-6 lg:py-10">
        <header className="px-6 lg:px-8 py-2 flex items-center justify-between w-full">
          <button onClick={handleBack} className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-secondary/40 hover:bg-secondary/70 px-3 py-1.5 rounded-lg border border-border/20">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-6">
          <Card className="w-full max-w-md border-0 lg:border border-border/40 shadow-none lg:shadow-xl rounded-2xl bg-card/60 backdrop-blur-xl lg:p-4">
            <CardHeader className="text-center pb-4">
              <div className="flex flex-col items-center mb-2 lg:hidden">
                <img src={logoColor} alt="JobsTrackr" className="h-16 w-auto mb-1 invert dark:invert-0" />
                <span className="text-xs font-bold text-primary tracking-widest uppercase">JOBSTRACKR</span>
              </div>
              <CardTitle className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                {isLogin ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                {isLogin
                  ? "Login to access your saved jobs, tracked exams, and notifications"
                  : "Sign up to start tracking application status and syllabus guidelines"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {!isLogin && (
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        id="name"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-muted-foreground/40 text-sm"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-muted-foreground/40 text-sm"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive font-semibold mt-1">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Password</Label>
                    {isLogin && (
                      <button
                        type="button"
                        disabled={forgotPasswordLoading}
                        onClick={async () => {
                          if (!email) {
                            toast({
                              title: "Enter your email",
                              description: "Please enter your email address first.",
                              variant: "destructive",
                            });
                            return;
                          }
                          const emailResult = emailSchema.safeParse(email);
                          if (!emailResult.success) {
                            toast({
                              title: "Invalid email",
                              description: "Please enter a valid email address.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setForgotPasswordLoading(true);
                          const { error } = await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          setForgotPasswordLoading(false);
                          if (error) {
                            toast({
                              title: "Error",
                              description: error.message,
                              variant: "destructive",
                            });
                          } else {
                            toast({
                              title: "Reset email sent!",
                              description: "Check your inbox for the password reset link.",
                            });
                          }
                        }}
                        className="text-[11px] text-primary font-bold hover:underline"
                      >
                        {forgotPasswordLoading ? "Sending..." : "Forgot Password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-muted-foreground/40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive font-semibold mt-1">{errors.password}</p>
                  )}
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl font-bold shadow-md bg-primary hover:bg-primary/95 text-white btn-modern text-xs uppercase tracking-wider mt-2" disabled={loading}>
                  {loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-card px-2.5 text-muted-foreground font-semibold tracking-wider font-mono">or login with</span>
                  </div>
                </div>

                {/* Google Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl bg-card border-border/60 hover:bg-muted btn-modern flex items-center justify-center font-bold text-xs uppercase tracking-wider text-foreground shadow-sm"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="h-4.5 w-4.5 mr-2" viewBox="0 0 24 24">
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
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                  }}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
                </button>
              </div>

              {/* Legal Links */}
              <div className="text-center pt-2">
                <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                  {!isLogin ? (
                    <>
                      By signing up, you agree to our{" "}
                      <Link to="/terms-of-service" className="text-primary font-semibold hover:underline">
                        Terms of Service
                      </Link>
                      {" "}and{" "}
                      <Link to="/privacy-policy" className="text-primary font-semibold hover:underline">
                        Privacy Policy
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/terms-of-service" className="text-primary font-medium hover:underline">
                        Terms of Service
                      </Link>
                      {" · "}
                      <Link to="/privacy-policy" className="text-primary font-medium hover:underline">
                        Privacy Policy
                      </Link>
                      {" · "}
                      <Link to="/refund-policy" className="text-primary font-medium hover:underline">
                        Refund Policy
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
