import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { InstallBanner } from "@/components/InstallBanner";
import { InstallModal } from "@/components/InstallModal";
import { IOSInstallGuide } from "@/components/IOSInstallGuide";

/**
 * Global coordinator component that renders the PWA installation UI.
 * Handles the logic of showing the banner, custom install modal, and iOS guides.
 */
export function InstallPrompt() {
  const { showPrompt, isIOS, install, dismiss } = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isIOSGuideOpen, setIsIOSGuideOpen] = useState(false);

  // If the hook decides we shouldn't show the prompt, return null
  if (!showPrompt) return null;

  // Banner "Install" click: opens the detailed feature showcase modal
  const handleBannerInstallClick = () => {
    setIsInstallModalOpen(true);
  };

  // Detailed Modal "Install Now" click: starts final installation
  const handleFinalInstallClick = () => {
    setIsInstallModalOpen(false);
    if (isIOS) {
      // Show the Safari iOS instructions guide modal
      setIsIOSGuideOpen(true);
      install(); // Trigger tracking callback for iOS install click
    } else {
      // Trigger native browser install prompt for Chromium browsers
      install();
    }
  };

  // Detailed Modal "Maybe Later" close: dismisses the prompt
  const handleModalClose = () => {
    setIsInstallModalOpen(false);
    dismiss(); // Save dismissal state to suppress repeatedly annoying the user
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
        isVisible={showPrompt && !isInstallModalOpen && !isIOSGuideOpen}
        onInstall={handleBannerInstallClick}
        onDismiss={dismiss}
      />

      {/* Custom App Installation Features Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={handleModalClose}
        onInstall={handleFinalInstallClick}
        isIOS={isIOS}
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
