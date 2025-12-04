import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function WelcomeHeader() {
  const { user } = useAuth();
  
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Guest";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="flex items-center justify-between px-5 pt-12 pb-4">
      <div>
        <p className="text-sm text-muted-foreground">Welcome Back!</p>
        <h1 className="text-2xl font-bold text-foreground">
          {displayName} <span className="wave">👋</span>
        </h1>
      </div>
      <Avatar className="h-12 w-12 border-2 border-primary/20">
        <AvatarImage src={user?.user_metadata?.avatar_url} alt={displayName} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
