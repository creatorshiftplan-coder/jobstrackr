interface SectionHeaderProps {
  title: string;
  showSeeAll?: boolean;
}

export function SectionHeader({ title, showSeeAll = true }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {showSeeAll && (
        <button className="text-sm font-semibold text-primary transition-colors hover:text-primary/80">
          See all →
        </button>
      )}
    </div>
  );
}