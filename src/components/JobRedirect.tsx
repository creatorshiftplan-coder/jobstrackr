import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Redirects old /job/:id (UUID) URLs to /jobs/:slug for SEO.
 * Fetches the job's slug from Supabase and performs a client-side redirect.
 */
export default function JobRedirect() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (!id) {
            navigate("/", { replace: true });
            return;
        }

        const fetchAndRedirect = async () => {
            const { data: job } = await supabase
                .from("jobs")
                .select("slug")
                .eq("id", id)
                .single();

            if (job?.slug) {
                navigate(`/jobs/${job.slug}`, { replace: true });
            } else {
                // Fallback: try the new route with the UUID
                navigate(`/jobs/${id}`, { replace: true });
            }
        };

        fetchAndRedirect();
    }, [id, navigate]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}
