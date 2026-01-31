import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { AuthRequiredProvider } from "@/components/AuthRequiredDialog";
import { Loader2 } from "lucide-react";

// Eager load critical routes
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";

// Lazy load secondary routes
const Index = lazy(() => import("./pages/Index"));
const JobDetails = lazy(() => import("./pages/JobDetails"));
const Search = lazy(() => import("./pages/Search"));
const Saved = lazy(() => import("./pages/Saved"));
const Profile = lazy(() => import("./pages/Profile"));
const More = lazy(() => import("./pages/More"));
const Admin = lazy(() => import("./pages/Admin"));
const ExamTracker = lazy(() => import("./pages/ExamTracker"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const EditEducation = lazy(() => import("./pages/EditEducation"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const FormMate = lazy(() => import("./pages/FormMate"));
const Documents = lazy(() => import("./pages/Documents"));
const Help = lazy(() => import("./pages/Help"));
const EditSectorPreferences = lazy(() => import("./pages/EditSectorPreferences"));
const Trending = lazy(() => import("./pages/Trending"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Page loader component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AnalyticsProvider>
                <AuthRequiredProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/job/:id" element={<JobDetails />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/saved" element={<Saved />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/edit-profile" element={<EditProfile />} />
                      <Route path="/edit-education" element={<EditEducation />} />
                      <Route path="/formmate" element={<FormMate />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/more" element={<More />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/tracker" element={<ExamTracker />} />
                      <Route path="/trending" element={<Trending />} />
                      <Route path="/edit-sector-preferences" element={<EditSectorPreferences />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/refund-policy" element={<RefundPolicy />} />
                      <Route path="/terms-of-service" element={<TermsOfService />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </AuthRequiredProvider>
              </AnalyticsProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
