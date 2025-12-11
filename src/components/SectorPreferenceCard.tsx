import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, Check } from "lucide-react";
import { EXAM_SECTORS } from "@/constants/filters";
import { useProfile } from "@/hooks/useProfile";

interface SectorPreferenceCardProps {
    onComplete: () => void;
    onSkip: () => void;
}

export function SectorPreferenceCard({ onComplete, onSkip }: SectorPreferenceCardProps) {
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const { upsertProfile } = useProfile();

    const toggleSector = (sector: string) => {
        setSelectedSectors((prev) =>
            prev.includes(sector)
                ? prev.filter((s) => s !== sector)
                : [...prev, sector]
        );
    };

    const handleSave = async () => {
        if (selectedSectors.length === 0) return;

        setIsSaving(true);
        try {
            await upsertProfile.mutateAsync({
                preferred_sectors: selectedSectors,
            });
            onComplete();
        } catch (error) {
            console.error("Failed to save preferences:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 animate-slide-up">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-display">What are you preparing for?</CardTitle>
                            <p className="text-sm text-muted-foreground">Select sectors to get personalized job recommendations</p>
                        </div>
                    </div>
                    <button
                        onClick={onSkip}
                        className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
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

                <div className="flex gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={selectedSectors.length === 0 || isSaving}
                        className="flex-1"
                    >
                        {isSaving ? "Saving..." : `Save Preferences (${selectedSectors.length})`}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onSkip}
                        className="text-muted-foreground"
                    >
                        Skip for now
                    </Button>
                </div>

                {selectedSectors.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                        You can change these later from Settings
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
