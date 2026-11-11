import { Link } from '@tanstack/react-router';
import { t } from '@/i18n/strings';
import { ArchiveIcon, HomeIcon, StoreIcon } from '../icons';
import styles from './BottomNav.module.css';

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <Link to="/" className={styles.item} activeOptions={{ exact: true }}>
        <HomeIcon />
        <span>{t.nav.home}</span>
      </Link>
      <Link to="/stores" className={styles.item}>
        <StoreIcon />
        <span>{t.nav.stores}</span>
      </Link>
      <Link to="/archive" className={styles.item}>
        <ArchiveIcon />
        <span>{t.nav.archive}</span>
      </Link>
    </nav>
  );
}
