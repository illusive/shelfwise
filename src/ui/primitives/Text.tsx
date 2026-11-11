import type { ReactNode } from 'react';
import { t } from '@/i18n/strings';
import { AlertIcon, InfoIcon } from '../icons';
import { Button } from './Button';
import styles from './Text.module.css';

export function Eyebrow({
  children,
  steps,
}: {
  children: ReactNode;
  steps?: { current: number; total: number };
}) {
  return (
    <div className={styles.eyebrowRow}>
      <span className={styles.eyebrow}>{children}</span>
      {steps && (
        <span className={styles.steps} aria-label={t.common.step(steps.current, steps.total)}>
          {Array.from({ length: steps.total }, (_, i) => (
            <span key={i} className={styles.step} data-active={i < steps.current} />
          ))}
        </span>
      )}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`${styles.mono} ${className ?? ''}`}>{children}</span>;
}

export type BadgeTone = 'accent' | 'neutral' | 'warning' | 'danger' | 'mock' | 'dark';

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.badge} ${styles[`badge-${tone}`]}`}>
      {icon}
      {children}
    </span>
  );
}

export interface NoticeAction {
  label: string;
  onClick: () => void;
  testId?: string;
}

/**
 * Inline message card: tinted icon badge, title + supporting text, optional compact button.
 * Tone shows in the icon badge and edge, not by tinting the whole card.
 */
export function Notice({
  tone = 'warning',
  title,
  children,
  action,
}: {
  tone?: 'warning' | 'info' | 'danger';
  title: ReactNode;
  children?: ReactNode;
  action?: NoticeAction;
}) {
  return (
    <div
      className={`${styles.notice} ${styles[`notice-${tone}`]}`}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <span className={styles.noticeIcon} aria-hidden="true">
        {tone === 'info' ? <InfoIcon size={18} /> : <AlertIcon size={18} />}
      </span>
      <div className={styles.noticeBody}>
        <p className={styles.noticeTitle}>{title}</p>
        {children && <div className={styles.noticeText}>{children}</div>}
      </div>
      {action && (
        <Button
          size="sm"
          variant="secondary"
          className={styles.noticeAction}
          data-testid={action.testId}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function SectionHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {aside && <span className={styles.sectionAside}>{aside}</span>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      {icon && <span className={styles.emptyIcon}>{icon}</span>}
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyText}>{children}</div>}
    </div>
  );
}

export function Divider() {
  return <hr className={styles.divider} />;
}
