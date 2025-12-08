import Lottie from "lottie-react";
import logoAnimation from "@/assets/logo-animation.json";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[hsl(204,100%,97%)] via-[hsl(204,80%,92%)] to-[hsl(204,60%,96%)]">
      <div className="w-48 h-48 sm:w-56 sm:h-56">
        <Lottie
          animationData={logoAnimation}
          loop={false}
          onComplete={onComplete}
        />
      </div>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-primary tracking-widest mt-4">
        JOBSTRACKR
      </h1>
    </div>
  );
};

export default SplashScreen;
