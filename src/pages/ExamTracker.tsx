import { BottomNav } from "@/components/BottomNav";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { TrackedJobCard } from "@/components/TrackedJobCard";
import { ExamSearchSheet } from "@/components/ExamSearchSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GraduationCap, Bookmark, Plus, ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function ExamTracker() {
  const { user, loading: authLoading } = useAuth();
  const { userExams, isLoading } = useExams();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-700 pb-20">
        <header className="sticky top-0 z-40 bg-blue-600 px-4 py-4">
          <Skeleton className="h-6 w-32 bg-blue-500" />
        </header>
        <main className="px-4 py-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-lg bg-blue-500/30" />
          <Skeleton className="h-40 w-full rounded-lg bg-blue-500/30" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-700 pb-20">
        <header className="sticky top-0 z-40 bg-blue-600 px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate(-1)} 
              className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <h1 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              My Exams
            </h1>
            <div className="flex items-center gap-2">
              <ExamSearchSheet 
                trigger={
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 transition-all cursor-pointer backdrop-blur-sm border border-white/30 shadow-sm">
                    <Plus className="h-4 w-4 text-white" />
                    <span className="text-white text-sm font-medium">Add Exam</span>
                  </div>
                }
              />
              <Link to="/saved">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                  <Bookmark className="h-5 w-5 text-white" />
                </div>
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 py-8">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mx-auto">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">Track Your Exams</h2>
            <p className="text-white/80 text-sm">
              Sign in to track your exam preparations and get AI-powered status updates
            </p>
            <Button 
              onClick={() => navigate("/auth")}
              className="bg-white text-blue-600 hover:bg-white/90"
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
    <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-600 to-slate-100 pb-24">
      {/* Blue Header */}
      <header className="sticky top-0 z-40 bg-blue-600 px-4 py-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            My Exams
          </h1>
          <div className="flex items-center gap-2">
            <ExamSearchSheet 
              trigger={
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 transition-all cursor-pointer backdrop-blur-sm border border-white/30 shadow-sm">
                  <Plus className="h-4 w-4 text-white" />
                  <span className="text-white text-sm font-medium">Add Exam</span>
                </div>
              }
            />
            <Link to="/saved">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                <Bookmark className="h-5 w-5 text-white" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Subheader */}
      <div className="bg-blue-600 px-4 pb-6">
        <h2 className="text-white/90 text-sm font-medium">Your Tracked Exams</h2>
      </div>

      {/* Content Area */}
      <main className="px-4 -mt-2">
        <div className="bg-slate-100 rounded-t-3xl min-h-[60vh] pt-4">
          {isLoading ? (
            <div className="space-y-4 px-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : userExams.length === 0 ? (
            <div className="text-center py-12 space-y-4 px-4">
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                <GraduationCap className="h-10 w-10 text-blue-600" />
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
                <TrackedJobCard key={attempt.id} attempt={attempt} />
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