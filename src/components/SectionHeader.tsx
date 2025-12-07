import { Link } from "react-router-dom";

interface SectionHeaderProps {
  title: string;
  linkTo?: string;
  linkText?: string;
}

export function SectionHeader({ title, linkTo = "/search", linkText = "See all" }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 mb-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <Link 
        to={linkTo} 
        className="text-sm text-white/80 font-medium hover:text-white transition-colors"
      >
        {linkText}
      </Link>
    </div>
  );
}
