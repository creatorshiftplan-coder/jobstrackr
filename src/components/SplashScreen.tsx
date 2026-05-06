import { useEffect, useRef, useState } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import splashAnimation from "@/assets/splash.json";
import logoColor from "@/assets/logo-color.png";

const SPLASH_KEY = "jobstrackr_splash_shown";

// Duration of the Lottie animation at 60fps: 150 frames = 2500ms
const ANIM_DURATION_MS = 2500;
// Fade-out transition duration
const FADE_MS = 400;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade-out just before animation ends
    const fadeTimer = setTimeout(() => setFading(true), ANIM_DURATION_MS - FADE_MS);
    // Notify parent after fade is complete
    const doneTimer = setTimeout(() => onDone(), ANIM_DURATION_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-background"
      style={{
        transition: `opacity ${FADE_MS}ms ease-out`,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Subtle radial glow behind animation */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(10, 65, 116, 0.07) 0%, transparent 80%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 select-none">
        {/* Lottie animation */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52">
          <Lottie
            lottieRef={lottieRef}
            animationData={splashAnimation}
            loop={false}
            autoplay
            style={{ width: "100%", height: "100%" }}
          />
          {/* Logo centred on top of animation */}
          <img
            src={logoColor}
            alt="JobsTrackr"
            className="absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-md"
            style={{ zIndex: 1 }}
          />
        </div>

        {/* App name */}
        <div className="text-center">
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-widest text-[#0A4174] dark:text-primary uppercase"
            style={{ letterSpacing: "0.18em" }}
          >
            JobsTrackr
          </h1>
          <p className="mt-1 text-xs text-slate-400 font-medium tracking-wider">
            Smart App for Smart Aspirants
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns true only once per browser session.
 * Subsequent page navigations/refreshes within the same session won't show the splash.
 */
export function shouldShowSplash(): boolean {
  if (sessionStorage.getItem(SPLASH_KEY)) return false;
  sessionStorage.setItem(SPLASH_KEY, "1");
  return true;
}
