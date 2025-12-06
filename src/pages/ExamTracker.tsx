import { BottomNav } from "@/components/BottomNav";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { ExamCard } from "@/components/ExamCard";
import { AddExamModal } from "@/components/AddExamModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Bookmark } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function ExamTracker() {
  const { user, loading: authLoading } = useAuth();
  const { userExams, isLoading } = useExams();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
          <Skeleton className="h-6 w-32" />
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
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display font-bold text-xl text-foreground flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Exam Tracker
            </h1>
            <Link to="/saved">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Bookmark className="h-5 w-5 text-foreground" />
              </div>
            </Link>
          </div>
        </header>
        <main className="px-4 py-8">
          <div className="text-center space-y-4">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Track Your Exams</h2>
            <p className="text-muted-foreground text-sm">
              Sign in to track your exam preparations and get AI-powered status updates
            </p>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Exam Tracker
          </h1>
          <div className="flex items-center gap-2">
            <Link to="/saved">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Bookmark className="h-5 w-5 text-foreground" />
              </div>
            </Link>
            <AddExamModal
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              }
            />
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : userExams.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">No Exams Added</h2>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Add exams you're preparing for and get AI-powered updates on admit cards, results, and more
            </p>
            <AddExamModal />
          </div>
        ) : (
          <div className="space-y-4">
            {userExams.map((attempt) => (
              <ExamCard key={attempt.id} attempt={attempt} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
