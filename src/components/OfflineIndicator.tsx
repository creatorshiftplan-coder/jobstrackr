import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      
      // Auto-hide the "Back online" alert after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex justify-center p-4">
      <AnimatePresence>
        {/* Offline Alert Status */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-amber-500 text-white rounded-xl shadow-lg border border-amber-400 max-w-md w-full sm:w-auto font-medium text-xs sm:text-sm backdrop-blur-sm bg-amber-500/95"
            role="alert"
            aria-live="assertive"
          >
            <WifiOff className="h-5 w-5 animate-bounce shrink-0" />
            <div className="flex-1">
              <span className="font-bold">You are offline.</span> Some features may be unavailable.
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="text-[10px] uppercase font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Reconnected Back Online Toast */}
        {isOnline && showBackOnline && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg border border-emerald-500 font-medium text-xs sm:text-sm backdrop-blur-sm bg-emerald-600/95"
            role="status"
          >
            <Wifi className="h-4 w-4 shrink-0" />
            <span>Connection restored. You are back online!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OfflineIndicator;
