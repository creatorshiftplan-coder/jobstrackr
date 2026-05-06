import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { EXAM_SECTORS } from "@/constants/filters";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function EditSectorPreferences() {
    const navigate = useNavigate();
    const handleBack = useSmartBack("/");
    const { user, loading: authLoading } = useAuth();
    const { profile, isLoading: profileLoading, upsertProfile } = useProfile();
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/auth");
        }
    }, [authLoading, user, navigate]);

    // Initialize selected sectors from profile
    useEffect(() => {
        if (profile?.preferred_sectors) {
            setSelectedSectors(profile.preferred_sectors);
        }
    }, [profile]);

    const toggleSector = (sector: string) => {
        setSelectedSectors((prev) =>
            prev.includes(sector)
                ? prev.filter((s) => s !== sector)
                : [...prev, sector]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await upsertProfile.mutateAsync({
                preferred_sectors: selectedSectors,
            });
            handleBack();
        } catch (error) {
            console.error("Failed to save preferences:", error);
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || profileLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-10">
            <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 md:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <h1 className="font-display font-bold text-xl text-foreground">Sector Preferences</h1>
                </div>
            </header>

            <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.46)_48%,hsl(var(--primary)/0.1)_100%)]">
                <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
                    <div className="flex items-end justify-between gap-8">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                Recommendation Tuning
                            </div>
                            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Sector Preferences</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                                Fine-tune which government job sectors should be prioritized across your recommendations and discovery experience.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur-sm min-w-[240px]">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Selected Sectors</p>
                            <p className="mt-2 text-3xl font-bold text-foreground">{selectedSectors.length}</p>
                            <p className="mt-1 text-sm text-muted-foreground">preferences currently active</p>
                        </div>
                    </div>
                </div>
            </section>

            <main className="px-4 py-6 space-y-6 md:mx-auto md:max-w-6xl md:px-6 lg:px-8">
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-display">Your Preferred Sectors</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Select the sectors you're interested in
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {EXAM_SECTORS.map((sector) => (
                                <Badge
                                    key={sector}
                                    variant={selectedSectors.includes(sector) ? "default" : "outline"}
                                    className={`cursor-pointer transition-all px-3 py-1.5 text-sm ${selectedSectors.includes(sector)
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "hover:bg-secondary"
                                        }`}
                                    onClick={() => toggleSector(sector)}
                                >
                                    {selectedSectors.includes(sector) && (
                                        <Check className="h-3 w-3 mr-1" />
                                    )}
                                    {sector}
                                </Badge>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {selectedSectors.length === 0
                                ? "No sectors selected. You'll see jobs from all sectors."
                                : `${selectedSectors.length} sector(s) selected. Recommended jobs will be from these sectors.`}
                        </p>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Preferences"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </main>

            <BottomNav />
        </div>
    );
}
