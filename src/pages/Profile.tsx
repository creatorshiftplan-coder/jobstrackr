import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Settings, Bell, HelpCircle, LogOut, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Profile() {
  // TODO: Implement with authentication
  const isLoggedIn = false;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="font-display font-bold text-xl text-foreground">Profile</h1>
      </header>

      <main className="px-4 py-4 space-y-4">
        {!isLoggedIn ? (
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
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-foreground">JD</span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">John Doe</h3>
                <p className="text-sm text-muted-foreground">john@example.com</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-0">
            {[
              { icon: Bell, label: "Notifications", path: "/notifications" },
              { icon: Settings, label: "Settings", path: "/settings" },
              { icon: HelpCircle, label: "Help & Support", path: "/help" },
            ].map(({ icon: Icon, label, path }, index) => (
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

        {isLoggedIn && (
          <Button variant="outline" className="w-full text-destructive hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
