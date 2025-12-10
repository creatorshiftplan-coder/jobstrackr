import { useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAnalytics } from "@/hooks/useAnalytics";

interface AnalyticsProviderProps {
    children: ReactNode;
}

// Map of paths to human-readable page names
const PAGE_NAMES: Record<string, string> = {
    "/": "Home",
    "/search": "Explore Jobs",
    "/tracker": "My Exams",
    "/profile": "Profile",
    "/more": "More",
    "/saved": "Saved Jobs",
    "/auth": "Login",
    "/welcome": "Welcome",
    "/admin": "Admin Panel",
    "/edit-profile": "Edit Profile",
    "/edit-education": "Edit Education",
    "/formmate": "Form Mate",
    "/documents": "Documents",
    "/help": "Help",
    "/reset-password": "Reset Password",
};

function getPageName(pathname: string): string {
    // Check direct match
    if (PAGE_NAMES[pathname]) {
        return PAGE_NAMES[pathname];
    }

    // Check for dynamic routes like /job/:id
    if (pathname.startsWith("/job/")) {
        return "Job Details";
    }

    return "Unknown Page";
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
    const location = useLocation();
    const { trackPageView } = useAnalytics();

    // Track page views on route change
    useEffect(() => {
        const pageName = getPageName(location.pathname);
        trackPageView(pageName);
    }, [location.pathname, trackPageView]);

    return <>{children}</>;
}
