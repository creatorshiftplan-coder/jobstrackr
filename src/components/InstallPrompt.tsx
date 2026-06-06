import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { InstallBanner } from "@/components/InstallBanner";
import { IOSInstallGuide } from "@/components/IOSInstallGuide";

/**
 * Global coordinator component that renders the PWA installation UI.
 * Handles the logic of showing the banner, and route/interaction behaviors.
 */
export function InstallPrompt() {
  const { showPrompt, isIOS, install, dismiss } = usePWAInstall();
  const [isIOSGuideOpen, setIsIOSGuideOpen] = useState(false);

  // If the hook decides we shouldn't show the prompt, return null
  if (!showPrompt) return null;

  const handleInstallClick = () => {
    if (isIOS) {
      // Show the Safari iOS instructions modal
      setIsIOSGuideOpen(true);
      install(); // Trigger tracking callback for iOS install click
    } else {
      // Trigger native browser install prompt for Chromium browsers
      install();
    }
  };

  const handleCloseIOSGuide = () => {
    setIsIOSGuideOpen(false);
    // Once the user closes/completes the iOS guide, dismiss the banner
    dismiss();
  };

  return (
    <>
      {/* Floating Installation Banner */}
      <InstallBanner
        isVisible={showPrompt && !isIOSGuideOpen}
        onInstall={handleInstallClick}
        onDismiss={dismiss}
      />

      {/* iOS Installation Instruction Guide Dialog */}
      {isIOS && (
        <IOSInstallGuide
          isOpen={isIOSGuideOpen}
          onClose={handleCloseIOSGuide}
        />
      )}
    </>
  );
}
export default InstallPrompt;
