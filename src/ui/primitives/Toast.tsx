import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

export interface ToastOptions {
  tone?: 'default' | 'danger';
  /** e.g. Undo. Toasts with an action stay up longer. */
  action?: { label: string; onClick: () => void };
  /** Called when the toast goes away without its action being used. */
  onExpire?: () => void;
}

interface ToastMessage extends ToastOptions {
  id: number;
  text: string;
}

type ShowToast = (text: string, toneOrOptions?: ToastOptions['tone'] | ToastOptions) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const TOAST_MS = 2200;
export const ACTION_TOAST_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef<ToastMessage | null>(null);

  const dismiss = useCallback((expired: boolean) => {
    clearTimeout(timer.current);
    const current = active.current;
    active.current = null;
    setMessage(null);
    if (expired) current?.onExpire?.();
  }, []);

  const show = useCallback<ShowToast>(
    (text, toneOrOptions) => {
      const options =
        typeof toneOrOptions === 'string' ? { tone: toneOrOptions } : (toneOrOptions ?? {});
      // A new toast replaces the current one; the replaced toast counts as expired.
      if (active.current) dismiss(true);
      const next = { id: Date.now(), text, ...options };
      active.current = next;
      setMessage(next);
      timer.current = setTimeout(() => dismiss(true), options.action ? ACTION_TOAST_MS : TOAST_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.region} aria-live="polite" role="status">
        <AnimatePresence>
          {message && (
            <motion.div
              key={message.id}
              className={`${styles.toast} ${styles[message.tone ?? 'default']}`}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.16 }}
            >
              <span>{message.text}</span>
              {message.action && (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    message.action!.onClick();
                    dismiss(false);
                  }}
                >
                  {message.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
