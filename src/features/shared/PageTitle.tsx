import type { ReactNode } from 'react';
import styles from './PageTitle.module.css';

/** Page heading under the store header (e.g. "Hyldeanalyse"), with an optional aside. */
export function PageTitle({
  title,
  aside,
  sub,
}: {
  title: ReactNode;
  aside?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <h2 className={styles.title}>{title}</h2>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
