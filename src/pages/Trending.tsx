import { useState } from "react";
import { useTrendingExams, CATEGORY_GRADIENTS } from "@/hooks/useTrendingExams";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { TrendingExamCard } from "@/components/TrendingExamCard";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Flame, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Banking", "SSC", "Railways", "Defence", "UPSC", "Teaching", "State"];

export default function Trending() {
    const [selectedCategory, setSelectedCategory] = useState("All");
    const { data: exams, isLoading, error, refetch, isRefetching } = useTrendingExams(selectedCategory);
    const { getLogoByName } = useConductingBodyLogos();

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 pb-24">
            {/* Hero Header */}
            <header className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-purple-600" />

                {/* Decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                </div>

                <div className="relative px-5 pt-12 pb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                            <Flame className="h-7 w-7 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white text-center tracking-tight">
                        Trending
                    </h1>
                    <p className="text-white/80 text-center mt-2 text-sm">
                        Recent updates
                    </p>

                    {/* Refresh indicator */}
                    <button
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white/80 hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
                    </button>
                </div>

                {/* Category Pills */}
                <div className="relative px-4 pb-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                        {CATEGORIES.map((category) => {
                            const isActive = selectedCategory === category;
                            const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS["default"];

                            return (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                                        isActive
                                            ? "bg-white text-primary shadow-lg scale-105"
                                            : "bg-white/20 text-white/90 hover:bg-white/30"
                                    )}
                                >
                                    {category !== "All" && <span>{gradient.icon}</span>}
                                    {category}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="px-4 py-6">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-destructive">Failed to load trending exams</p>
                    </div>
                ) : exams && exams.length > 0 ? (
                    <div className="space-y-4">
                        {exams.map((exam, index) => (
                            <TrendingExamCard
                                key={exam.id}
                                exam={{
                                    ...exam,
                                    logo_url: getLogoByName(exam.conducting_body) || exam.logo_url
                                }}
                                index={index}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                            <TrendingUp className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            No Trending Exams Yet
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            {selectedCategory === "All"
                                ? "Exams will appear here once users start tracking and refreshing status updates."
                                : `No exams in the ${selectedCategory} category have status updates yet.`
                            }
                        </p>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
