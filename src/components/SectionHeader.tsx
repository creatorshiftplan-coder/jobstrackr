import { Link } from "react-router-dom";

interface SectionHeaderProps {
  title: string;
  linkTo?: string;
  linkText?: string;
  variant?: "light" | "dark";
}

export function SectionHeader({ 
  title, 
  linkTo = "/search", 
  linkText = "See all",
  variant = "light"
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 mb-4 md:px-0">
      <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2>
      <Link 
        to={linkTo} 
        className="text-xs sm:text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
      >
        {linkText}
      </Link>
    </div>
  );
}
