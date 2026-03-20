import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function useScrollRestoration() {
  const { pathname } = useLocation();

  useEffect(() => {
    const storageKey = `scroll_${pathname}`;
    const savedPosition = sessionStorage.getItem(storageKey);

    if (savedPosition !== null) {
      const y = Number(savedPosition);
      if (!Number.isNaN(y)) {
        window.scrollTo(0, y);
      }
    }

    return () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };
  }, [pathname]);
}
