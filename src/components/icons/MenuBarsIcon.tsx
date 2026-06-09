import { cn } from "@/lib/utils";

interface MenuBarsIconProps {
    className?: string;
}

export function MenuBarsIcon({ className }: MenuBarsIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className={cn("h-5 w-5", className)}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 5.5h16.5M3.75 12h16.5m-16.5 6.5H12"
            />
        </svg>
    );
}
