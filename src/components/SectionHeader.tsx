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
  const textColor = variant === "dark" ? "text-[#0A4174]" : "text-white";
  const linkColor = variant === "dark" ? "text-[#0A4174]/70 hover:text-[#0A4174]" : "text-white/80 hover:text-white";

  return (
    <div className="flex items-center justify-between px-5 mb-4">
      <h2 className={`text-base sm:text-lg font-bold ${textColor}`}>{title}</h2>
      <Link 
        to={linkTo} 
        className={`text-xs sm:text-sm font-medium transition-colors ${linkColor}`}
      >
        {linkText}
      </Link>
    </div>
  );
}
