import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

const NAV_LOADING_DELAY = 300;   // min loading feel
const NAV_TIMEOUT_MS   = 8000;  // absolute max before showing timeout UI

export const useNavigationLoading = () => {
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const previousLocation = useRef(location);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (location === previousLocation.current) return;

    // A real navigation is happening — start loading
    setIsLoading(true);
    setTimedOut(false);

    // Cancel any in-flight timers from the previous navigation
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);

    previousLocation.current = location;

    // Normal case: resolve loading after a short delay
    timerRef.current = setTimeout(() => {
      setIsLoading(false);
      // Navigation completed in time — cancel the safety-net timer so it
      // never fires and incorrectly shows "taking longer than expected"
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
    }, NAV_LOADING_DELAY);

    // Safety net: if something goes wrong and loading never resolves,
    // force it off after 8 s and show the "taking longer" message
    maxTimerRef.current = setTimeout(() => {
      setIsLoading(false);
      setTimedOut(true);
    }, NAV_TIMEOUT_MS);

    return () => {
      if (timerRef.current)  clearTimeout(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, [location]);

  return { isLoading, timedOut, location };
};
