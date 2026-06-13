import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
  const { toast } = useToast();

  useEffect(() => {
    // Check if user arrived via password reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsValidSession(!!session);
      setCheckingSession(false);
    };
    
    checkSession();

    // Listen for auth state changes (handles the recovery token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsValidSession(true);
          setCheckingSession(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({ password });
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
      });
      navigate("/");
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logoColor} alt="JobsTrackr" className="h-16 w-auto mx-auto mb-4 invert dark:invert-0" />
            <CardTitle className="text-xl text-foreground">Invalid or Expired Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md border border-border/40 shadow-xl rounded-2xl bg-card/60 backdrop-blur-xl p-4">
        <CardHeader className="text-center pb-4">
          <img src={logoColor} alt="JobsTrackr" className="h-16 w-auto mx-auto mb-2 invert dark:invert-0" />
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Password Gate</span>
          <CardTitle className="text-xl font-extrabold tracking-tight text-foreground mt-1">Set New Password</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Choose a strong password to secure your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-muted-foreground/40 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-muted-foreground/40 text-sm"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl font-bold shadow-md bg-primary hover:bg-primary/95 text-white btn-modern text-xs uppercase tracking-wider mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full h-11 rounded-xl border border-border/20 mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
