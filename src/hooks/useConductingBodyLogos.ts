import { useState, useEffect } from "react";
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
                            slug: nameWithoutExt.toLowerCase().replace(/\s+/g, "-"),
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

    // Get logo URL by name (for use in TrendingExamCard)
    const getLogoByName = (conductingBody: string | null): string | null => {
        if (!conductingBody || !logosQuery.data) return null;

        const normalizedName = conductingBody.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        const logo = logosQuery.data.find((l) => {
            const logoSlug = l.slug.toLowerCase();
            return logoSlug === normalizedName ||
                conductingBody.toLowerCase().includes(l.name.toLowerCase()) ||
                l.name.toLowerCase().includes(conductingBody.toLowerCase().split(" ")[0]);
        });

        return logo?.logo_url || null;
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
