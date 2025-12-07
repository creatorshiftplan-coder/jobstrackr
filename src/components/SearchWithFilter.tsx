import { Search, SlidersHorizontal } from "lucide-react";
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
        <div className="relative flex-1 bg-[#A7EBF2]/40 backdrop-blur-md border border-white/60 rounded-2xl shadow-lg shadow-[#A7EBF2]/20">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0A4174]/60" />
          <Input
            type="text"
            placeholder="Search a job or position"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 pr-4 h-14 rounded-2xl bg-transparent border-0 text-base placeholder:text-[#0A4174]/50 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <Button
          variant="default"
          size="icon"
          onClick={onFilterClick}
          className="h-14 w-14 rounded-2xl bg-[#0A4174] hover:bg-[#0A4174]/90 shrink-0 relative shadow-lg shadow-[#0A4174]/30"
        >
          <SlidersHorizontal className="h-5 w-5" />
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
