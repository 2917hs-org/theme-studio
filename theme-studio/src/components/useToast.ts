import { useCallback, useEffect, useRef, useState } from 'react';

// Split out from Toast.tsx so that file exports only the Toast component —
// a file mixing a component export with a hook export breaks Fast Refresh
// for the component (react/only-export-components).
const DEFAULT_TOAST_DURATION_MS = 3200;

/** Simple single-slot toast: showing a new message replaces whatever's up. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showToast = useCallback((msg: string, durationMs = DEFAULT_TOAST_DURATION_MS) => {
    setMessage(msg);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setMessage(null), durationMs);
  }, []);

  return { toastMessage: message, showToast };
}
