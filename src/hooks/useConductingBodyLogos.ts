
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRef, useCallback, useMemo } from "react";
import {
    MANUAL_DEPARTMENT_ALIASES,
    ORGANIZATION_ALIAS_LOOKUP,
    normalizeOrganizationKey,
} from "@/constants/organizationMatching";

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
                        limit: 1000,
                        sortBy: { column: "name", order: "asc" },
                    });

                if (error) {
                    console.error("Error fetching logos:", error);
                    return [];
                }

                if (!files || files.length === 0) return [];

                // Map files to logo objects — filter out placeholder files and non-image entries
                const logos: ConductingBodyLogo[] = files
                    .filter(file => file.name !== ".emptyFolderPlaceholder" && /\.(png|jpg|jpeg|webp|svg)$/i.test(file.name))
                    .map((file) => {
                        const nameWithoutExt = file.name.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "");
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

    // Split into meaningful words (letters/numbers groups)
    const toWords = (s: string): string[] =>
        s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 0);

    const stopWords = new Set(["and", "of", "the", "for", "in", "to", "on", "with", "by"]);

    // Generate acronym from words, e.g. "staff selection commission" -> "ssc"
    const toAcronym = (words: string[]): string =>
        words
            .filter((w) => w.length > 0 && !stopWords.has(w))
            .map((w) => w[0])
            .join("");

    // Common suffixes in logo file names that should be stripped for matching
    const LOGO_SUFFIX_RE = /[-_ ]?(logo|icon|img|image|emblem|seal|badge|crest)s?$/i;

    const logoIndex = useMemo(() => {
        const map = new Map<string, ConductingBodyLogo>();
        for (const logo of logosQuery.data || []) {
            const nameKey = normalizeOrganizationKey(logo.name);
            const slugKey = normalizeOrganizationKey(logo.slug);
            const dashlessSlug = logo.slug.replace(/-/g, "");
            map.set(nameKey, logo);
            map.set(slugKey, logo);
            map.set(dashlessSlug, logo);

            // Also index by name/slug with common suffixes like "logo" stripped
            const cleanedName = logo.name.replace(LOGO_SUFFIX_RE, "").trim();
            const cleanedSlug = logo.slug.replace(LOGO_SUFFIX_RE, "").trim();
            if (cleanedName !== logo.name) {
                map.set(normalizeOrganizationKey(cleanedName), logo);
            }
            if (cleanedSlug !== logo.slug) {
                map.set(normalizeOrganizationKey(cleanedSlug), logo);
                map.set(cleanedSlug.replace(/-/g, ""), logo);
            }
        }
        return map;
    }, [logosQuery.data]);

    const resolveLogoFromCandidates = useCallback((candidateKeys: string[]): ConductingBodyLogo | null => {
        // Pass 1: exact match
        for (const candidateKey of candidateKeys) {
            const match = logoIndex.get(candidateKey);
            if (match) return match;
        }

        // Pass 2: prefix match — catches files like "fssai-logo.png" when candidate is "fssai"
        for (const candidateKey of candidateKeys) {
            if (candidateKey.length < 3) continue;
            for (const [indexKey, logo] of logoIndex) {
                if (indexKey.startsWith(candidateKey) || candidateKey.startsWith(indexKey)) {
                    return logo;
                }
            }
        }

        return null;
    }, [logoIndex]);

    // Cache map keyed by the raw conductingBody string → resolved URL (or null).
    // Cleared automatically whenever logosQuery.data changes.
    const cacheRef = useRef<Map<string, string | null>>(new Map());
    const lastDataRef = useRef(logosQuery.data);
    if (lastDataRef.current !== logosQuery.data) {
        cacheRef.current = new Map();
        lastDataRef.current = logosQuery.data;
    }

    /**
     * Ranked logo matching — picks the BEST match, not the first.
     * Results are cached per raw input string to avoid repeated O(n) scans.
     *
     * Priority order:
     *   110 = alias map hit
     *   100 = exact slug match ("upsc" === "upsc")
     *    80 = all logo words appear as whole words in the input
     *    70 = acronym → logo name
     *    65 = reverse acronym match
     *    60 = input starts with the logo name
     *    40 = logo name is a word-boundary substring (≥3 chars)
     */
    const getLogoByName = useCallback((conductingBody: string | null): string | null => {
        if (!conductingBody || !logosQuery.data || logosQuery.data.length === 0) return null;

        // Return cached result if available
        if (cacheRef.current.has(conductingBody)) {
            return cacheRef.current.get(conductingBody)!;
        }

        const inputNorm = normalizeOrganizationKey(conductingBody);

        const manualCandidates = MANUAL_DEPARTMENT_ALIASES[inputNorm];
        if (manualCandidates) {
            const manualLogo = resolveLogoFromCandidates(manualCandidates);
            if (manualLogo) {
                cacheRef.current.set(conductingBody, manualLogo.logo_url);
                return manualLogo.logo_url;
            }
        }

        const organizationCandidates = ORGANIZATION_ALIAS_LOOKUP.get(inputNorm);
        if (organizationCandidates) {
            const aliasLogo = resolveLogoFromCandidates(organizationCandidates);
            if (aliasLogo) {
                cacheRef.current.set(conductingBody, aliasLogo.logo_url);
                return aliasLogo.logo_url;
            }
        }

        const inputWords = toWords(conductingBody);
        const inputAcronym = toAcronym(inputWords);

        let bestLogo: ConductingBodyLogo | null = null;
        let bestScore = 0;

        for (const logo of logosQuery.data) {
            const logoNorm = normalizeOrganizationKey(logo.name);
            const logoSlug = logo.slug.replace(/-/g, "");
            const logoWords = toWords(logo.name);
            const logoAcronym = toAcronym(logoWords);
            let score = 0;

            // Exact slug/normalized match
            if (inputNorm === logoNorm || inputNorm === logoSlug) {
                score = 100;
            }
            // All logo words appear as whole words in the input
            else if (logoWords.length > 0 && logoWords.every(lw => inputWords.some(iw => iw === lw))) {
                score = 80;
            }
            // Acronym match for full-form department names
            else if (inputAcronym.length >= 2 && (inputAcronym === logoNorm || inputAcronym === logoSlug)) {
                score = 70;
            }
            // Reverse acronym match
            else if (logoAcronym.length >= 2 && (logoAcronym === inputNorm || logoAcronym === inputWords.join(""))) {
                score = 65;
            }
            // Input starts with logo name (normalized)
            else if (inputNorm.startsWith(logoNorm) && logoNorm.length >= 3) {
                score = 60;
            }
            // Word-boundary substring (≥3 chars) avoids "ssc" matching "ossc"
            else if (logoNorm.length >= 3 && inputWords.some(iw => iw === logoNorm)) {
                score = 40;
            }

            if (score > bestScore) {
                bestScore = score;
                bestLogo = logo;
            }
        }

        const result = bestLogo?.logo_url || null;
        cacheRef.current.set(conductingBody, result);
        return result;
    }, [logosQuery.data, resolveLogoFromCandidates]);

    /**
     * Given a list of department strings, returns those that have no matching logo.
     * Used by the Admin panel to surface departments that need a logo upload.
     */
    const getUnmatchedDepartments = useCallback((departments: string[]): string[] => {
        const seen = new Set<string>();
        const unmatched: string[] = [];
        for (const dept of departments) {
            if (!dept || seen.has(dept)) continue;
            seen.add(dept);
            if (!getLogoByName(dept)) {
                unmatched.push(dept);
            }
        }
        return unmatched.sort();
    }, [getLogoByName]);

    return {
        logos: logosQuery.data || [],
        isLoading: logosQuery.isLoading,
        error: logosQuery.error,
        uploadLogo,
        deleteLogo,
        getLogoByName,
        getUnmatchedDepartments,
        refetch: logosQuery.refetch,
    };
}
