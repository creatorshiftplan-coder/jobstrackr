import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Settings, Bell, HelpCircle, LogOut, ChevronRight, Shield, Loader2, Bookmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { DocumentUploader } from "@/components/DocumentUploader";
import { OCRResultModal } from "@/components/OCRResultModal";

export default function More() {
  const { user, loading, signOut } = useAuth();
  const { profile, upsertProfile } = useProfile();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrData, setOcrData] = useState<Record<string, any>>({});

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleOCRComplete = (documentId: string, extractedData: any) => {
    setOcrData(extractedData);
    setOcrModalOpen(true);
  };

  const handleConfirmOCR = (selectedFields: Record<string, any>) => {
    upsertProfile.mutate(selectedFields);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl text-foreground">More</h1>
          <Link to="/saved">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <Bookmark className="h-5 w-5 text-foreground" />
            </div>
          </Link>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {!user ? (
          <Card className="border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="mx-auto h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                Welcome to Govt Job Finder
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Login to save jobs, track applications, and get personalized recommendations
              </p>
              <Link to="/auth">
                <Button className="w-full">Login / Sign Up</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-0 shadow-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">{userInitials}</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{userName}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </CardContent>
            </Card>

            <DocumentUploader onOCRComplete={handleOCRComplete} />
          </>
        )}

        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-0">
            {[
              { icon: Bell, label: "Notifications", path: "/notifications" },
              { icon: Settings, label: "Settings", path: "/settings" },
              { icon: HelpCircle, label: "Help & Support", path: "/help" },
              ...(user && isAdmin ? [{ icon: Shield, label: "Admin Panel", path: "/admin" }] : []),
            ].map(({ icon: Icon, label, path }) => (
              <Link
                key={path}
                to={path}
                className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{label}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {user && (
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        )}
      </main>

      <OCRResultModal
        isOpen={ocrModalOpen}
        onClose={() => setOcrModalOpen(false)}
        extractedData={ocrData}
        onConfirm={handleConfirmOCR}
      />

      <BottomNav />
    </div>
  );
}
