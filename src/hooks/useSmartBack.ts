import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useSmartBack(fallbackPath: string = "/") {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key !== "default" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath, { replace: true });
  }, [fallbackPath, location.key, navigate]);
}

