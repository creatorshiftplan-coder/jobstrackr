import { Suspense, lazy, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, shouldDehydrateQuery, PERSIST_BUSTER } from "@/lib/queryPersister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { AuthRequiredProvider } from "@/components/AuthRequiredDialog";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { TopBar } from "@/components/TopBar";
import { Loader2 } from "lucide-react";

import { SplashScreen, shouldShowSplash } from "@/components/SplashScreen";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Eager load critical routes
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";

// Lazy load secondary routes
const Index = lazy(() => import("./pages/Index"));
const JobDetails = lazy(() => import("./pages/JobDetails"));
const JobRedirect = lazy(() => import("./components/JobRedirect"));
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
const UserManual = lazy(() => import("./pages/UserManual"));
const FAQ = lazy(() => import("./pages/FAQ"));
const TelegramAlerts = lazy(() => import("./pages/TelegramAlerts"));
const EditSectorPreferences = lazy(() => import("./pages/EditSectorPreferences"));
const Trending = lazy(() => import("./pages/Trending"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SyllabusCheck = lazy(() => import("./pages/SyllabusCheck"));
const SyllabusResult = lazy(() => import("./pages/SyllabusResult"));
const UpdateDetails = lazy(() => import("./pages/UpdateDetails"));
const ExamUpdateDetail = lazy(() => import("./pages/ExamUpdateDetail"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const ShelfDetails = lazy(() => import("./pages/ShelfDetails"));

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
      gcTime: 1000 * 60 * 60 * 24, // 24h — persister needs gcTime >= maxAge to keep entries hydrated
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [showSplash, setShowSplash] = useState(() => shouldShowSplash());

  useEffect(() => {
    document.body.classList.add("spa-mounted");
  }, []);

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24h
          buster: PERSIST_BUSTER,
          dehydrateOptions: {
            shouldDehydrateQuery: (q) => shouldDehydrateQuery(q.queryKey),
          },
        }}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
          <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollRestoration />
              <AnalyticsProvider>
                <AuthRequiredProvider>
                  <OfflineIndicator />
                  <InstallPrompt />
                  <SidebarProvider defaultOpen={true}>
                    <div className="flex min-h-screen w-full">
                      <DesktopSidebar />
                      <div className="flex flex-1 flex-col min-w-0">
                        <TopBar />
                        <main id="main-scroll" className="flex-1 overflow-y-auto">
                          <Suspense fallback={<PageLoader />}>
                            <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/jobs/:slug" element={<JobDetails />} />
                      <Route path="/job/:id" element={<JobRedirect />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/saved" element={<Saved />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/edit-profile" element={<EditProfile />} />
                      <Route path="/edit-education" element={<EditEducation />} />
                      <Route path="/formmate" element={<FormMate />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/user-manual" element={<UserManual />} />
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/settings/notifications" element={<TelegramAlerts />} />
                      <Route path="/more" element={<More />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/tracker" element={<ExamTracker />} />
                      <Route path="/trending" element={<Trending />} />
                      <Route path="/updates/:slug" element={<UpdateDetails />} />
                      <Route path="/exam-update/:id" element={<ExamUpdateDetail />} />
                      <Route path="/syllabus" element={<SyllabusCheck />} />
                      <Route path="/syllabus/result" element={<SyllabusResult />} />
                      <Route path="/edit-sector-preferences" element={<EditSectorPreferences />} />
                      <Route path="/for-you" element={<Recommendations />} />
                      <Route path="/for-you/shelf/:shelfKey" element={<ShelfDetails />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/refund-policy" element={<RefundPolicy />} />
                      <Route path="/terms-of-service" element={<TermsOfService />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                          </Suspense>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </AuthRequiredProvider>
              </AnalyticsProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
