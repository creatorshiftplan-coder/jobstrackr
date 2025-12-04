import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function SearchHeader({ searchQuery, onSearchChange }: SearchHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold">GJ</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground">Govt Job Finder</h1>
            <p className="text-xs text-muted-foreground">Find your dream government job</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, departments..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-secondary border-0 focus-visible:ring-primary"
          />
        </div>
      </div>
    </header>
  );
}
