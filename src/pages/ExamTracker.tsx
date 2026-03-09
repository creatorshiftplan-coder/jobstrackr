import { BottomNav } from "@/components/BottomNav";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { TrackedJobCard } from "@/components/TrackedJobCard";
import { ExamCardErrorBoundary } from "@/components/ExamCardErrorBoundary";
import { ExamSearchSheet } from "@/components/ExamSearchSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GraduationCap, Bookmark, Plus } from "lucide-react";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
import { useNavigate, Link } from "react-router-dom";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import logoColor from "@/assets/logo-color.png";
import logoWhite from "@/assets/logo-white.png";

export default function ExamTracker() {
  const { user, loading: authLoading } = useAuth();
  const { userExams, isLoading } = useExams();
  const navigate = useNavigate();
  const { showAuthRequired } = useAuthRequired();

  const handleAddExamClick = () => {
    if (!user) {
      showAuthRequired("Login to track exams and get AI-powered updates");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card">
          <div className="px-4 h-14 flex items-center">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="px-4 py-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(204_100%_99%),_hsl(205_85%_96%)_55%,_hsl(206_70%_94%)_100%)] dark:bg-[radial-gradient(circle_at_top,_hsl(224_55%_18%),_hsl(222_50%_14%)_55%,_hsl(220_45%_10%)_100%)] pb-20">
        <header className="sticky top-0 z-40 bg-primary dark:bg-card dark:border-b dark:border-border backdrop-blur-xl border-b border-primary-foreground/10">
          <div className="flex items-center justify-between gap-2 px-4 h-14">
            <Link to="/more" className="flex-shrink-0">
              <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
                <MenuBarsIcon className="h-5 w-5 text-primary-foreground dark:text-primary" />
              </div>
            </Link>
            <h1 className="font-display font-bold text-lg text-primary-foreground dark:text-foreground flex items-center gap-2 min-w-0">
              <img src={logoWhite} alt="JobsTrackr" className="h-7 w-7 object-contain dark:hidden" />
              <img src={logoColor} alt="JobsTrackr" className="h-7 w-7 object-contain hidden dark:block" />
              <span className="truncate">My Exams</span>
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                onClick={handleAddExamClick}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-full bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4 text-primary-foreground" />
                <span className="text-primary-foreground text-xs sm:text-sm font-medium hidden xs:inline">Add Exam</span>
              </div>
              <Link to="/saved">
                <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
                  <Bookmark className="h-5 w-5 text-primary-foreground dark:text-primary" />
                </div>
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 py-8">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Track Your Exams</h2>
            <p className="text-muted-foreground text-sm">
              Sign in to track your exam preparations and get AI-powered status updates
            </p>
            <Button
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(204_100%_99%),_hsl(205_85%_96%)_55%,_hsl(206_70%_94%)_100%)] dark:bg-[radial-gradient(circle_at_top,_hsl(224_55%_18%),_hsl(222_50%_14%)_55%,_hsl(220_45%_10%)_100%)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary dark:bg-card dark:border-b dark:border-border backdrop-blur-xl border-b border-primary-foreground/10">
        <div className="flex items-center justify-between gap-2 px-4 h-14">
          <Link to="/more" className="flex-shrink-0">
            <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
              <MenuBarsIcon className="h-5 w-5 text-primary-foreground dark:text-primary" />
            </div>
          </Link>
          <h1 className="font-display font-bold text-lg text-primary-foreground dark:text-foreground flex items-center gap-2 min-w-0">
            <img src={logoWhite} alt="JobsTrackr" className="h-7 w-7 object-contain dark:hidden" />
            <img src={logoColor} alt="JobsTrackr" className="h-7 w-7 object-contain hidden dark:block" />
            <span className="truncate">My Exams</span>
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ExamSearchSheet
              trigger={
                <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-full bg-sky-100/80 hover:bg-sky-100 dark:bg-secondary dark:hover:bg-secondary/80 transition-all cursor-pointer shadow-sm">
                  <Plus className="h-4 w-4 text-primary dark:text-foreground" />
                  <span className="text-primary dark:text-foreground text-xs sm:text-sm font-medium">Add Exam</span>
                </div>
              }
            />
            <Link to="/saved">
              <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
                <Bookmark className="h-5 w-5 text-primary-foreground dark:text-primary" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Subheader */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-foreground text-lg font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Your Tracked Exams
        </h2>
      </div>

      {/* Disclaimer */}
      <div className="px-4 pb-4">
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-xl p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            ⚠️ We help you stay informed — but for the most accurate and final updates, always check the official website. JobsTrackr is not responsible for any update delays or changes.
          </p>
        </div>
      </div>

      {/* Content Area */}
      <main className="px-4">
        <div className="min-h-[60vh]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : userExams.length === 0 ? (
            <div className="text-center py-12 space-y-4 px-4">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto">
                <GraduationCap className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No Exams Tracked</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Add exams you're preparing for and get AI-powered updates on admit cards, results, and more
              </p>
              <ExamSearchSheet />
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {userExams.map((attempt, index) => (
                <ExamCardErrorBoundary key={attempt.id}>
                  <TrackedJobCard attempt={attempt} cardIndex={index} />
                </ExamCardErrorBoundary>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button - Bottom Left */}
      {user && userExams.length > 0 && <ExamSearchSheet />}

      <BottomNav />
    </div>
  );
}
