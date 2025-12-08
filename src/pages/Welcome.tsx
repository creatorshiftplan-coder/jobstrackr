import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import logoColor from "@/assets/logo-color.png";
import welcomeIllustrationDark from "@/assets/welcome-illustration-dark.png";

const Welcome = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
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

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-y-auto">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-between px-6 py-4 gap-4">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center mt-2 sm:mt-4">
          <img src={logoColor} alt="JobsTrackr" className="h-16 sm:h-20 w-auto mb-1" />
          <h2 className="text-lg sm:text-2xl font-bold text-primary tracking-wider">JOBSTRACKR</h2>
        </div>

        {/* Headline */}
        <h1 className="text-xl sm:text-3xl font-bold text-foreground text-center">
          Discover Your<br />Government Job
        </h1>

        {/* Illustration */}
        <div className="w-full max-w-[200px] sm:max-w-[280px]">
          <img
            src={theme === "dark" ? welcomeIllustrationDark : "/welcome-illustration.png"}
            alt="Government job discovery illustration"
            className="w-full h-auto object-contain"
            loading="lazy"
          />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="px-6 pb-6 space-y-3">
        {/* Sign up Button */}
        <Button
          onClick={() => navigate("/auth?mode=signup")}
          className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90"
        >
          Sign up
        </Button>

        {/* Continue with Google Button */}
        <Button
          onClick={handleGoogleSignIn}
          variant="outline"
          className="w-full h-12 text-base font-medium rounded-xl bg-card border-border hover:bg-muted"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
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
        <p className="text-center text-muted-foreground pt-2">
          Have an account?{" "}
          <button
            onClick={() => navigate("/auth?mode=login")}
            className="text-primary font-semibold hover:underline"
          >
            Log In
          </button>
        </p>
      </div>
    </div>
  );
};

export default Welcome;
