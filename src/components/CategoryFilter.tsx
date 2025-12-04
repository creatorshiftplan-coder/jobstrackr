import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const categories = [
  { id: "all", label: "All Jobs" },
  { id: "banking", label: "Banking" },
  { id: "railway", label: "Railway" },
  { id: "defence", label: "Defence" },
  { id: "ssc", label: "SSC" },
  { id: "upsc", label: "UPSC" },
  { id: "state", label: "State Govt" },
];

interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryFilter({ activeCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2">
        {categories.map((category) => (
          <Badge
            key={category.id}
            variant={activeCategory === category.id ? "default" : "secondary"}
            className={cn(
              "cursor-pointer whitespace-nowrap px-4 py-2 text-sm font-medium transition-all",
              activeCategory === category.id
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
            onClick={() => onCategoryChange(category.id)}
          >
            {category.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
