import { useState, useEffect, useCallback } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Interface representing the browser's custom beforeinstallprompt event.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Custom hook to manage Progressive Web App (PWA) installation.
 * Supports Chrome, Edge, desktop Chromium, and custom Safari iOS step-by-step instructions.
 */
export function usePWAInstall() {
  const { trackEvent } = useAnalytics();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  
  // Trigger criteria states
  const [timeSpentEnough, setTimeSpentEnough] = useState<boolean>(false);
  const [pageViewsEnough, setPageViewsEnough] = useState<boolean>(false);
  const [isDismissedSuppressed, setIsDismissedSuppressed] = useState<boolean>(false);

  // Storage keys
  const DISMISSAL_KEY = 'jobstrackr_pwa_dismissed_at';
  const VIEW_COUNT_KEY = 'jobstrackr_pwa_page_views';
  const DISMISSAL_DAYS = 7;

  /**
   * Check if the app is currently running in standalone (PWA) mode.
   */
  const getIsStandalone = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    return isStandalone || isIOSStandalone;
  }, []);

  /**
   * Check if the client is an iOS device (iPhone/iPad/iPod).
   */
  const getIsIOS = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    const isIPad = ua.match(/iPad/i) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && ua.match(/Macintosh/i));
    const isIPhone = ua.match(/iPhone/i) || ua.match(/iPod/i);
    return !!(isIPhone || isIPad);
  }, []);

  /**
   * Determine if the prompt was dismissed within the last 7 days.
   */
  const checkDismissalSuppression = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const dismissedAtStr = localStorage.getItem(DISMISSAL_KEY);
    if (!dismissedAtStr) return false;
    
    try {
      const dismissedAt = new Date(dismissedAtStr);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - dismissedAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= DISMISSAL_DAYS;
    } catch {
      return false;
    }
  }, []);

  // Sync initial state and register appinstalled listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsInstalled(getIsStandalone());
    setIsIOS(getIsIOS() && !getIsStandalone());
    setIsDismissedSuppressed(checkDismissalSuppression());

    // Fired by the browser when the app is successfully installed
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      setIsInstalled(true);
      trackEvent({
        event_type: 'feature_used',
        event_data: { feature_name: 'pwa_prompt', action: 'install_successful' }
      });
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [getIsStandalone, getIsIOS, checkDismissalSuppression, trackEvent]);

  // Capture beforeinstallprompt event for Chromium browsers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's automatic mini-infobar prompt
      e.preventDefault();
      // Store event for programmatic triggering
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Criteria 1: User spends 30 seconds on the website
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      setTimeSpentEnough(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, []);

  // Criteria 2: User visits 2 pages in their session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const incrementPageView = (): number => {
      let views = parseInt(sessionStorage.getItem(VIEW_COUNT_KEY) || '0', 10);
      views += 1;
      sessionStorage.setItem(VIEW_COUNT_KEY, String(views));
      return views;
    };

    const handlePathChange = () => {
      const currentViews = incrementPageView();
      if (currentViews >= 2) {
        setPageViewsEnough(true);
      }
    };

    // Trigger on initial page load
    handlePathChange();

    // Check pathname every second to track SPA transitions without router dependencies
    let lastPath = window.location.pathname;
    const interval = setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        handlePathChange();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Compute showPrompt based on combined criteria
  useEffect(() => {
    if (isInstalled || isDismissedSuppressed) {
      setShowPrompt(false);
      return;
    }

    const isConditionsMet = timeSpentEnough || pageViewsEnough;
    const supportsPrompt = isInstallable || isIOS;

    if (isConditionsMet && supportsPrompt) {
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
    }
  }, [isInstalled, isDismissedSuppressed, timeSpentEnough, pageViewsEnough, isInstallable, isIOS]);

  // Track when the prompt is actually shown to the user (once per show cycle)
  const [hasTrackedShow, setHasTrackedShow] = useState<boolean>(false);
  useEffect(() => {
    if (showPrompt && !hasTrackedShow) {
      setHasTrackedShow(true);
      trackEvent({
        event_type: 'feature_used',
        event_data: { 
          feature_name: 'pwa_prompt', 
          action: 'prompt_shown', 
          platform: isIOS ? 'ios' : 'chromium' 
        }
      });
    }
  }, [showPrompt, hasTrackedShow, isIOS, trackEvent]);

  /**
   * Hide the banner and store the dismissal date in localStorage to suppress it for 7 days.
   */
  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(DISMISSAL_KEY, new Date().toISOString());
    setIsDismissedSuppressed(true);
    setShowPrompt(false);

    trackEvent({
      event_type: 'button_click',
      event_data: { 
        button_name: 'pwa_dismiss_btn', 
        action: 'prompt_dismissed',
        platform: isIOS ? 'ios' : 'chromium' 
      }
    });
  }, [isIOS, trackEvent]);

  /**
   * Trigger the browser's native install prompt for Chromium browsers.
   */
  const install = useCallback(async () => {
    if (isIOS) {
      trackEvent({
        event_type: 'button_click',
        event_data: { button_name: 'pwa_install_btn', action: 'ios_install_clicked' }
      });
      return;
    }

    if (!deferredPrompt) {
      console.warn('[PWA] Stored installation prompt event is not available.');
      return;
    }

    trackEvent({
      event_type: 'button_click',
      event_data: { button_name: 'pwa_install_btn', action: 'install_clicked' }
    });

    try {
      // Trigger native prompt
      await deferredPrompt.prompt();
      
      // Wait for user's decision
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the installation');
        setIsInstalled(true);
        // Note: The 'appinstalled' listener will also track success, but we track here as well
      } else {
        console.log('[PWA] User dismissed the native install dialog');
        trackEvent({
          event_type: 'feature_used',
          event_data: { feature_name: 'pwa_prompt', action: 'native_dialog_dismissed' }
        });
      }
    } catch (err) {
      console.error('[PWA] Error launching native install prompt:', err);
    } finally {
      // Clean up stored prompt and hide banner
      setDeferredPrompt(null);
      setIsInstallable(false);
      setShowPrompt(false);
    }
  }, [deferredPrompt, isIOS, trackEvent]);

  return {
    isInstallable,
    isIOS,
    isInstalled,
    showPrompt,
    install,
    dismiss
  };
}
