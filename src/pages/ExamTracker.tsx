import { BottomNav } from "@/components/BottomNav";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { TrackedJobCard } from "@/components/TrackedJobCard";
import { ExamCardErrorBoundary } from "@/components/ExamCardErrorBoundary";
import { ExamSearchSheet } from "@/components/ExamSearchSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GraduationCap, Bookmark, Plus, CalendarDays } from "lucide-react";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
import { useNavigate, Link } from "react-router-dom";
import { useAuthRequired } from "@/components/AuthRequiredDialog";

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
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-primary backdrop-blur-xl border-b border-primary-foreground/10">
          <div className="flex items-center justify-between gap-2 px-4 h-14">
            <Link to="/more" className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <MenuBarsIcon className="h-5 w-5 text-primary" />
              </div>
            </Link>
            <h1 className="font-display font-bold text-lg text-primary-foreground flex items-center gap-2 min-w-0">
              <CalendarDays className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">My Exams</span>
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                onClick={handleAddExamClick}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-full bg-primary hover:bg-primary/90 transition-all cursor-pointer backdrop-blur-sm shadow-sm"
              >
                <Plus className="h-4 w-4 text-primary-foreground" />
                <span className="text-primary-foreground text-xs sm:text-sm font-medium hidden xs:inline">Add Exam</span>
              </div>
              <Link to="/saved">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                  <Bookmark className="h-5 w-5 text-primary" />
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary backdrop-blur-xl border-b border-primary-foreground/10">
        <div className="flex items-center justify-between gap-2 px-4 h-14">
          <Link to="/more" className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <MenuBarsIcon className="h-5 w-5 text-primary" />
            </div>
          </Link>
          <h1 className="font-display font-bold text-lg text-primary-foreground flex items-center gap-2 min-w-0">
            <CalendarDays className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">My Exams</span>
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ExamSearchSheet
              trigger={
                <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-all cursor-pointer backdrop-blur-sm shadow-sm">
                  <Plus className="h-4 w-4 text-primary-foreground" />
                  <span className="text-primary-foreground text-xs sm:text-sm font-medium">Add Exam</span>
                </div>
              }
            />
            <Link to="/saved">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Bookmark className="h-5 w-5 text-primary" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Subheader */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-foreground text-lg font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Your Tracked Exams
        </h2>
      </div>

      {/* Disclaimer */}
      <div className="px-4 pb-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            ⚠️ We help you stay informed — but for the most accurate and final updates, always check the official website. JobsTrackr is not responsible for any update delays or changes.
          </p>
        </div>
      </div>

      {/* Content Area */}
      <main className="px-4">
        <div className="bg-card/60 backdrop-blur-sm rounded-3xl min-h-[60vh] pt-4 shadow-lg border border-border">
          {isLoading ? (
            <div className="space-y-4 px-2">
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
            <div className="space-y-3 px-2 pb-4">
              {userExams.map((attempt) => (
                <ExamCardErrorBoundary key={attempt.id}>
                  <TrackedJobCard attempt={attempt} />
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
