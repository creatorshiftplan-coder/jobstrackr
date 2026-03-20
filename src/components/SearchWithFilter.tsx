import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SearchWithFilterProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterClick?: () => void;
  filterCount?: number;
}

export function SearchWithFilter({
  searchQuery,
  onSearchChange,
  onFilterClick,
  filterCount = 0,
}: SearchWithFilterProps) {
  return (
    <div className="px-5 pb-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
          <Input
            type="text"
            placeholder="Search a job or position"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 pr-10 h-12 rounded-2xl bg-transparent border-0 text-base text-white placeholder:text-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="default"
          size="icon"
          onClick={onFilterClick}
          className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 shrink-0 relative shadow-lg"
        >
          <SlidersHorizontal className="h-5 w-5 text-white" />
          {filterCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 justify-center text-xs bg-destructive">
              {filterCount}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}
