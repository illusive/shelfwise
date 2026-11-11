import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'default' | 'danger';
}

const ToastContext = createContext<(text: string, tone?: ToastMessage['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, tone: ToastMessage['tone'] = 'default') => {
    clearTimeout(timer.current);
    setMessage({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setMessage(null), 2200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.region} aria-live="polite" role="status">
        <AnimatePresence>
          {message && (
            <motion.div
              key={message.id}
              className={`${styles.toast} ${styles[message.tone]}`}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.16 }}
            >
              {message.text}
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
