import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

// Key to track if we've already tried auto-reloading
const CHUNK_RELOAD_KEY = "jobstrackr_chunk_reload_attempted";

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false,
  };

  // Check if the error is a chunk loading failure
  private static isChunkLoadError(error: Error): boolean {
    const message = error.message?.toLowerCase() || "";
    const name = error.name?.toLowerCase() || "";

    return (
      message.includes("failed to fetch dynamically imported module") ||
      message.includes("loading chunk") ||
      message.includes("loading css chunk") ||
      name.includes("chunkloaderror") ||
      message.includes("dynamically imported module") ||
      // Network errors during lazy loading
      (message.includes("failed to fetch") && message.includes("assets/"))
    );
  }

  public static getDerivedStateFromError(error: Error): State {
    const isChunkError = ErrorBoundary.isChunkLoadError(error);
    return { hasError: true, error, isChunkError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);

    // Auto-reload for chunk errors (only once to prevent infinite loops)
    if (ErrorBoundary.isChunkLoadError(error)) {
      const hasAttemptedReload = sessionStorage.getItem(CHUNK_RELOAD_KEY);

      if (!hasAttemptedReload) {
        console.log("Chunk load error detected, attempting auto-reload...");
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
        // Clear any cached data and force reload
        window.location.reload();
        return;
      } else {
        // Already tried reloading, clear the flag for next session
        console.log("Auto-reload already attempted, showing error UI");
      }
    }
  }

  private handleRetry = () => {
    // Clear the reload flag so we can try auto-reload again
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    this.setState({ hasError: false, error: null, isChunkError: false });
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    // Clear everything and do a hard reload
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);

    // Clear caches if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }

    // Force hard reload bypassing cache
    window.location.href = window.location.origin + window.location.pathname + "?v=" + Date.now();
  };

  public render() {
    if (this.state.hasError) {
      // Special UI for chunk loading errors
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground mb-2">App Updated!</h1>
              <p className="text-muted-foreground mb-6">
                A new version of JobsTrackr is available. Please reload to get the latest features and fixes.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={this.handleClearCacheAndReload} className="gap-2 w-full">
                  <RefreshCw className="h-4 w-4" />
                  Reload App
                </Button>
                <Button variant="outline" onClick={() => window.location.href = "/"} className="gap-2 w-full">
                  Go to Home
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // Generic error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              We're sorry, but something unexpected happened. Please try again.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg mb-6 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/"} className="gap-2">
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
