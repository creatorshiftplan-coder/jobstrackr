
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ConductingBodyLogo {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    category: string | null;
    created_at: string;
}

export function useConductingBodyLogos() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fetch all logos
    const logosQuery = useQuery({
        queryKey: ["conducting_body_logos"],
        queryFn: async (): Promise<ConductingBodyLogo[]> => {
            // Since we might not have the table yet, we'll use Supabase Storage listing
            // and store metadata in a JSON file or use the file names as keys
            try {
                const { data: files, error } = await supabase
                    .storage
                    .from("logos")
                    .list("conducting-bodies", {
                        limit: 100,
                        sortBy: { column: "name", order: "asc" },
                    });

                if (error) {
                    console.error("Error fetching logos:", error);
                    return [];
                }

                if (!files || files.length === 0) return [];

                // Map files to logo objects
                const logos: ConductingBodyLogo[] = files
                    .filter(file => file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg'))
                    .map((file) => {
                        const nameWithoutExt = file.name.replace(/\.(png|jpg|jpeg)$/i, "");
                        const { data: urlData } = supabase.storage
                            .from("logos")
                            .getPublicUrl(`conducting-bodies/${file.name}`);

                        return {
                            id: file.id || file.name,
                            name: nameWithoutExt.replace(/-/g, " ").replace(/_/g, " "),
                            // Normalize slug same way as upload: lowercase, spaces→dashes, strip non-alphanumeric
                            slug: nameWithoutExt.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                            logo_url: urlData.publicUrl,
                            category: null,
                            created_at: file.created_at || new Date().toISOString(),
                        };
                    });

                return logos;
            } catch (error) {
                console.error("Error in logos query:", error);
                return [];
            }
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
    });

    // Upload a new logo
    const uploadLogo = useMutation({
        mutationFn: async ({ name, file }: { name: string; file: File }) => {
            // Create slug from name
            const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            const extension = file.name.split(".").pop()?.toLowerCase() || "png";
            const fileName = `${slug}.${extension}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase
                .storage
                .from("logos")
                .upload(`conducting-bodies/${fileName}`, file, {
                    cacheControl: "3600",
                    upsert: true,
                });

            if (error) throw error;

            return { name, slug, path: data.path };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conducting_body_logos"] });
            toast({
                title: "Logo uploaded",
                description: "The logo has been uploaded successfully.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Upload failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Delete a logo
    const deleteLogo = useMutation({
        mutationFn: async (fileName: string) => {
            const { error } = await supabase
                .storage
                .from("logos")
                .remove([`conducting-bodies/${fileName}`]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conducting_body_logos"] });
            toast({
                title: "Logo deleted",
                description: "The logo has been removed.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Normalize a string for matching: lowercase, strip all non-alphanumeric
    const normalize = (s: string): string =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Split into meaningful words (letters/numbers groups)
    const toWords = (s: string): string[] =>
        s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 0);

    /**
     * Ranked logo matching — picks the BEST match, not the first.
     * Scoring:
     *   100 = exact slug match ("upsc" === "upsc")
     *    80 = all logo words appear as whole words in the input
     *    60 = input starts with the logo name
     *    40 = logo name is a substring AND logo name is ≥3 chars (prevents "ssc" matching "ossc")
     *     0 = no match
     */
    const getLogoByName = (conductingBody: string | null): string | null => {
        if (!conductingBody || !logosQuery.data || logosQuery.data.length === 0) return null;

        const inputNorm = normalize(conductingBody);
        const inputWords = toWords(conductingBody);

        let bestLogo: ConductingBodyLogo | null = null;
        let bestScore = 0;

        for (const logo of logosQuery.data) {
            const logoNorm = normalize(logo.name);
            const logoSlug = logo.slug.replace(/-/g, ""); // "indian-railway" → "indianrailway"
            const logoWords = toWords(logo.name);
            let score = 0;

            // Exact slug/normalized match
            if (inputNorm === logoNorm || inputNorm === logoSlug) {
                score = 100;
            }
            // All logo words appear as whole words in the input
            // e.g. logo "Indian Railway" matches "Indian Railway Recruitment" but NOT "Indian Army"
            else if (logoWords.length > 0 && logoWords.every(lw => inputWords.some(iw => iw === lw))) {
                score = 80;
            }
            // Input starts with logo name (normalized)
            else if (inputNorm.startsWith(logoNorm) && logoNorm.length >= 3) {
                score = 60;
            }
            // Logo is a word-boundary substring match (only for names ≥ 3 chars to avoid false positives)
            // e.g. "SSC" matches "SSC CGL" but NOT "OSSC"
            else if (logoNorm.length >= 3 && inputWords.some(iw => iw === logoNorm)) {
                score = 40;
            }

            if (score > bestScore) {
                bestScore = score;
                bestLogo = logo;
            }
        }

        return bestLogo?.logo_url || null;
    };

    return {
        logos: logosQuery.data || [],
        isLoading: logosQuery.isLoading,
        error: logosQuery.error,
        uploadLogo,
        deleteLogo,
        getLogoByName,
        refetch: logosQuery.refetch,
    };
}
