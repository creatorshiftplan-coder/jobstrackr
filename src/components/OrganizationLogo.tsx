import { useState, useEffect, useMemo, memo } from "react";
import { Building2 } from "lucide-react";

/**
 * Appends Supabase Storage image transformation parameters to a public logo URL.
 * Falls back to the original URL if it doesn't look like a Supabase storage URL.
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */
function withCdnResize(url: string, width: number, height: number): string {
    try {
        const u = new URL(url);
        // Only apply transforms to Supabase storage URLs
        if (u.pathname.includes("/storage/v1/object/public/")) {
            // Supabase render endpoint: /storage/v1/render/image/public/...
            u.pathname = u.pathname.replace(
                "/storage/v1/object/public/",
                "/storage/v1/render/image/public/"
            );
            u.searchParams.set("width", String(width));
            u.searchParams.set("height", String(height));
            u.searchParams.set("resize", "contain");
            return u.toString();
        }
    } catch {
        // Invalid URL — return as-is
    }
    return url;
}

interface OrganizationLogoProps {
  logoUrl: string | null | undefined;
  name: string;
  containerClassName: string;
  imageClassName: string;
  iconClassName: string;
  /** Desired render width in CSS px (used for CDN resizing; defaults to 40) */
  renderWidth?: number;
  /** Desired render height in CSS px (used for CDN resizing; defaults to 40) */
  renderHeight?: number;
}

export const OrganizationLogo = memo(function OrganizationLogo({
  logoUrl,
  name,
  containerClassName,
  imageClassName,
  iconClassName,
  renderWidth = 40,
  renderHeight = 40,
}: OrganizationLogoProps) {
  const [isLogoFailed, setIsLogoFailed] = useState(false);

  // Reset failure state when the URL changes (e.g. after async logo fetch completes)
  useEffect(() => {
    setIsLogoFailed(false);
  }, [logoUrl]);

  // Request a 2× image for retina displays, resize via Supabase CDN
  const optimizedUrl = useMemo(
    () => logoUrl ? withCdnResize(logoUrl, renderWidth * 2, renderHeight * 2) : null,
    [logoUrl, renderWidth, renderHeight]
  );

  return (
    <div className={containerClassName}>
      {optimizedUrl && !isLogoFailed ? (
        <img
          src={optimizedUrl}
          alt={`${name} logo`}
          className={imageClassName}
          loading="lazy"
          onError={() => setIsLogoFailed(true)}
        />
      ) : (
        <Building2 className={iconClassName} />
      )}
    </div>
  );
});
