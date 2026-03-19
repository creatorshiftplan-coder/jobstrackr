import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, Bookmark, RefreshCw, Home, CalendarDays, User, Settings, HelpCircle, Flame, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSmartBack } from "@/hooks/useSmartBack";
import logoColor from "@/assets/logo-color.png";
import logoWhite from "@/assets/logo-white.png";

// Navigation items for the menu
const NAV_ITEMS = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Explore", path: "/search" },
    { icon: Flame, label: "Trending", path: "/trending" },
    { icon: CalendarDays, label: "My Exams", path: "/tracker" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: Settings, label: "Settings", path: "/more" },
    { icon: HelpCircle, label: "Help", path: "/help" },
];

interface AppHeaderProps {
    title: string;
    variant?: "primary" | "card" | "transparent";
    showMenu?: boolean;
    showBack?: boolean;
    showSearch?: boolean;
    showRefresh?: boolean;
    showLogo?: boolean;
    showTitleLogo?: boolean;
    rightActions?: ReactNode;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function AppHeader({
    title,
    variant = "primary",
    showMenu = true,
    showBack = false,
    showSearch = false,
    showRefresh = false,
    showLogo = false,
    showTitleLogo = false,
    rightActions,
    onRefresh,
    isRefreshing = false,
}: AppHeaderProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const handleBack = useSmartBack("/");

    // Style variants
    const bgClass = {
        primary: "bg-primary dark:bg-card dark:border-b dark:border-border",
        card: "bg-card/95 backdrop-blur-md border-b border-border",
        transparent: "bg-transparent",
    }[variant];

    const textClass = {
        primary: "text-white dark:text-foreground",
        card: "text-foreground",
        transparent: "text-foreground",
    }[variant];

    const iconClass = {
        primary: "text-white hover:bg-white/10 dark:text-muted-foreground dark:hover:bg-secondary",
        card: "text-muted-foreground hover:bg-secondary",
        transparent: "text-muted-foreground hover:bg-secondary",
    }[variant];

    return (
        <header className={cn("sticky top-0 z-50 shrink-0", bgClass)}>
            {/* Uniform height container: h-14 */}
            <div className="flex items-center justify-between px-4 h-14">
                {/* Left Section */}
                <div className="flex items-center gap-2 min-w-[44px]">
                    {showBack && (
                        <button
                            onClick={handleBack}
                            className={cn("p-2 -ml-2 rounded-lg transition-colors", iconClass)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    )}
                    {showMenu && !showBack && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <button className={cn("p-2 -ml-2 rounded-lg transition-colors", iconClass)}>
                                    <Menu className="h-6 w-6" />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72">
                                <SheetHeader className="pb-6">
                                    <div className="flex items-center gap-3">
                                        <img src={logoColor} alt="JobsTrackr" className="h-10 w-10" />
                                        <SheetTitle className="text-xl font-bold">JobsTrackr</SheetTitle>
                                    </div>
                                </SheetHeader>
                                <nav className="space-y-1">
                                    {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
                                        const isActive = location.pathname === path;
                                        return (
                                            <Link
                                                key={path}
                                                to={path}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                                                    isActive
                                                        ? "bg-primary/10 text-primary font-medium"
                                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                                )}
                                            >
                                                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                                                <span>{label}</span>
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </SheetContent>
                        </Sheet>
                    )}
                </div>

                {/* Center - Title OR Search Bar */}
                {showSearch ? (
                    <div
                        onClick={() => navigate("/search")}
                        className="flex-1 mx-3 flex items-center gap-2 bg-white/10 dark:bg-secondary backdrop-blur-sm rounded-xl h-10 px-3 cursor-pointer"
                    >
                        <Search className="h-4 w-4 text-white/70 dark:text-muted-foreground" />
                        <span className="text-white/70 dark:text-muted-foreground text-sm">Search a job...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {showTitleLogo && (
                            <>
                                <img src={logoWhite} alt="JobsTrackr" className="h-7 w-7 object-contain dark:hidden" />
                                <img src={logoColor} alt="JobsTrackr" className="h-7 w-7 object-contain hidden dark:block" />
                            </>
                        )}
                        <h1 className={cn("text-lg font-bold", textClass)}>{title}</h1>
                    </div>
                )}

                {/* Right Section */}
                <div className="flex items-center gap-1 min-w-[44px] justify-end">
                    {showRefresh && onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className={cn("p-2 rounded-lg transition-colors", iconClass)}
                        >
                            <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
                        </button>
                    )}
                    {showLogo && (
                        <img
                            src={variant === "primary" ? logoWhite : logoColor}
                            alt="JobsTrackr"
                            className="h-8 w-8 object-contain"
                        />
                    )}
                    {rightActions}
                </div>
            </div>
        </header>
    );
}

export default AppHeader;
