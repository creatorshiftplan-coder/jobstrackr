import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, PlusSquare } from "lucide-react";

interface IOSInstallGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A sleek, accessible modal interface guiding iOS Safari users on how to add the PWA to their home screen.
 */
export function IOSInstallGuide({ isOpen, onClose }: IOSInstallGuideProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[92%] sm:w-full rounded-2xl p-6 overflow-hidden border bg-background shadow-xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Share className="h-5 w-5 animate-pulse text-primary" />
            </div>
            <span className="font-semibold text-xs tracking-wider uppercase text-primary/80">
              Safari iOS Installation
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold font-display text-foreground">
            Install JobsTrackr
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Install JobsTrackr to get faster access to government job updates directly on your device's home screen.
          </DialogDescription>
        </DialogHeader>

        {/* Installation Steps */}
        <div className="space-y-4 my-4" role="list" aria-label="iOS PWA installation steps">
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-3.5 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors border border-border/30">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              1
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Tap the{" "}
                <span className="font-semibold inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded border text-xs shadow-sm">
                  Share <Share className="h-3 w-3 inline text-primary" />
                </span>{" "}
                button
              </p>
              <p className="text-xs text-muted-foreground">
                Look for the share icon in Safari's bottom toolbar (or top bar on iPad).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 p-3.5 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors border border-border/30">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              2
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Select{" "}
                <span className="font-semibold inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded border text-xs shadow-sm">
                  Add to Home Screen <PlusSquare className="h-3 w-3 inline text-primary" />
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Scroll down the share menu list to find and tap this option.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 p-3.5 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors border border-border/30">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              3
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Tap{" "}
                <span className="font-semibold inline-flex items-center gap-1 bg-primary/20 text-primary px-2.5 py-0.5 rounded border border-primary/30 text-xs font-bold">
                  Add
                </span>{" "}
                in the top-right
              </p>
              <p className="text-xs text-muted-foreground">
                Confirm the details and click the Add button in the browser to finalize.
              </p>
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={onClose}
            className="w-full btn-modern py-5 bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-2"
            aria-label="Close installation guide"
          >
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
