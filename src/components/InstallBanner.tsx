import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallBannerProps {
  isVisible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

/**
 * Premium glassmorphic PWA installation prompt floating at the bottom.
 * Designed to float above the standard bottom navigation on mobile devices.
 */
export function InstallBanner({ isVisible, onInstall, onDismiss }: InstallBannerProps) {
  const [imageError, setImageError] = useState(false);

  // Keyboard navigation: dismiss banner on pressing the Escape key
  useEffect(() => {
    if (!isVisible) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, onDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="fixed z-40 bottom-[84px] left-4 right-4 md:bottom-6 md:right-6 md:left-auto w-auto md:max-w-md p-4 rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-xl flex flex-col sm:flex-row items-center gap-4 text-left"
          role="region"
          aria-label="App installation banner"
        >
          {/* Logo & Description */}
          <div className="flex items-start gap-3 w-full">
            {imageError ? (
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shrink-0 shadow-md border border-primary/10 text-white">
                <Shield className="h-6 w-6 text-white" />
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="JobsTrackr App Logo"
                className="h-12 w-12 rounded-xl object-cover shrink-0 shadow-md border border-primary/10 invert dark:invert-0"
                onError={() => setImageError(true)}
              />
            )}

            <div className="space-y-0.5 flex-1">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-1.5">
                JobsTrackr
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                  PWA
                </span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Install JobsTrackr to get faster access to government job updates.
              </p>
            </div>
          </div>

          {/* Interaction Buttons */}
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-9 px-3 rounded-lg text-muted-foreground hover:text-foreground text-xs font-semibold btn-modern"
              aria-label="Dismiss installation prompt"
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={onInstall}
              className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-semibold shadow-md btn-modern flex items-center gap-1.5"
              aria-label="Install JobsTrackr Web App"
            >
              <Download className="h-3.5 w-3.5" />
              Install
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
