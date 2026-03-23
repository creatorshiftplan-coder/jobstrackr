import { Bookmark, Building2 } from "lucide-react";

interface RecommendedJobRowProps {
  title: string;
  org: string;
  tags: string[];
}

export function RecommendedJobRow({ title, org, tags }: RecommendedJobRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{org}</p>
        <div className="mt-2 flex gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <button className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Bookmark className="h-5 w-5" />
      </button>
    </div>
  );
}