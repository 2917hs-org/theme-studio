import { useCallback, useEffect, useRef, useState } from 'react';
import { InfoIcon } from './icons';

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast" role="status">
      <InfoIcon size={14} className="toast-icon" />
      <span>{message}</span>
    </div>
  );
}

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
