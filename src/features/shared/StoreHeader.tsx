import type { ReactNode } from 'react';
import type { Store } from '@/domain/models';
import { formatAddressLines } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { ArrowLeftIcon } from '@/ui/icons';
import { IconButton } from '@/ui/primitives/Button';
import styles from './StoreHeader.module.css';
import { StoreLogo } from './StoreLogo';

export interface StoreHeaderProps {
  store: Store;
  onBack: () => void;
  /** Top-right slot (e.g. a status pill). */
  right?: ReactNode;
  /** Chips/status under the address. */
  children?: ReactNode;
}

/**
 * Shared full-bleed header for every store-related screen (store, captures, processing,
 * results, report, photo, review), in the style of the user's other field app.
 */
export function StoreHeader({ store, onBack, right, children }: StoreHeaderProps) {
  const [line1, line2] = formatAddressLines(store.address);
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <IconButton label={t.common.back} tone="outline-light" onClick={onBack}>
          <ArrowLeftIcon size={20} />
        </IconButton>
        {right && <div className={styles.right}>{right}</div>}
      </div>
      <div className={styles.identity}>
        <StoreLogo store={store} size="lg" />
        <div className={styles.text}>
          <h1 className={styles.name} data-testid="store-name">
            {store.name}
          </h1>
          <p className={styles.address}>{line1}</p>
          <p className={styles.address}>{line2}</p>
        </div>
      </div>
      {children && <div className={styles.extra}>{children}</div>}
    </header>
  );
}
