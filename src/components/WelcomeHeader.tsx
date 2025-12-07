import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";

export function WelcomeHeader() {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Guest";
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <header className="flex items-center justify-between px-5 pt-12 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome <span className="wave">👋</span> {displayName}
        </h1>
      </div>
      
      <div className="flex items-center gap-3">
        <Link to="/saved">
          <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
            <Bookmark className="h-5 w-5 text-white" />
          </div>
        </Link>
        
        <Link to="/profile">
          <Avatar className="h-12 w-12 border-2 border-white/30">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={displayName} />
            <AvatarFallback className="bg-white/20 text-white font-semibold backdrop-blur-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
