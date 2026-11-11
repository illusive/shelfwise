import { Link, useLocation } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { t } from '@/i18n/strings';
import { ArchiveIcon, HomeIcon, StoreIcon } from '../icons';
import styles from './BottomNav.module.css';

type Item = {
  to: '/' | '/stores' | '/archive';
  label: () => string;
  Icon: typeof HomeIcon;
  centre?: boolean;
  isActive: (path: string) => boolean;
};

const ITEMS: Item[] = [
  { to: '/', label: () => t.nav.home, Icon: HomeIcon, isActive: (p) => p === '/' },
  {
    to: '/stores',
    label: () => t.nav.stores,
    Icon: StoreIcon,
    centre: true,
    isActive: (p) => p.startsWith('/stores'),
  },
  {
    to: '/archive',
    label: () => t.nav.archive,
    Icon: ArchiveIcon,
    isActive: (p) => p.startsWith('/archive'),
  },
];

/**
 * Floating, icon-only bottom bar in the style of the user's other field app: connected
 * "gooey" blobs (side pills + larger centre circle) with a white active indicator that
 * glides between items (disabled under reduced motion via MotionConfig).
 */
export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className={styles.nav} aria-label={t.nav.label}>
      <svg className={styles.defs} aria-hidden="true" focusable="false">
        <filter id="shelfwise-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10"
          />
        </filter>
      </svg>
      <div className={styles.bar}>
        <div className={styles.goo} aria-hidden="true">
          <span className={styles.neck} />
          {ITEMS.map((item) => (
            <span key={item.to} className={item.centre ? styles.blobCentre : styles.blob} />
          ))}
        </div>
        {ITEMS.map(({ to, label, Icon, centre, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={to}
              to={to}
              className={centre ? styles.itemCentre : styles.item}
              aria-label={label()}
              aria-current={active ? 'page' : undefined}
              data-active={active}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className={centre ? styles.indicatorCentre : styles.indicator}
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                />
              )}
              <Icon size={centre ? 24 : 22} className={styles.icon} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
