import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '../icons';
import { t } from '@/i18n/strings';
import { BottomNav } from './BottomNav';
import { IconButton } from './Button';
import styles from './Screen.module.css';

export interface ScreenProps {
  children: ReactNode;
  /** Full-bleed header above the padded content (e.g. the store header). */
  header?: ReactNode;
  /** Fixed action area above the home indicator (Figma "Analyze action"). */
  action?: ReactNode;
  nav?: boolean;
  tone?: 'paper' | 'dark';
  className?: string;
}

/** Page shell: scrollable content with a short, interruptible entry transition. */
export function Screen({
  children,
  header,
  action,
  nav = false,
  tone = 'paper',
  className,
}: ScreenProps) {
  return (
    <div
      className={`${styles.screen} ${styles[tone]}`}
      data-has-action={Boolean(action)}
      data-has-nav={nav}

      data-has-header={Boolean(header)}
    >
      {header}
      <motion.main
        className={`${styles.content} ${className ?? ''}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </motion.main>
      {action && <div className={styles.action}>{action}</div>}
      {nav && <BottomNav />}
    </div>
  );
}

export interface TopBarProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: ReactNode;
}

export function TopBar({ title, onBack, right, subtitle }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.topRow}>
        {onBack && (
          <IconButton label={t.common.back} onClick={onBack} className={styles.back}>
            <ArrowLeftIcon />
          </IconButton>
        )}
        <h1 className={styles.topTitle}>{title}</h1>
        {right && <div className={styles.topRight}>{right}</div>}
      </div>
      {subtitle && <p className={styles.topSubtitle}>{subtitle}</p>}
    </header>
  );
}

export function Wordmark() {
  return <p className={styles.wordmark}>{t.app.name}</p>;
}
