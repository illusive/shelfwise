import type { CSSProperties } from 'react';
import type { Store } from '@/domain/models';
import styles from './StoreLogo.module.css';
import { CHAIN_LOGOS } from './storeLogos';

/** Round chain logo filling the whole bubble in the brand colour (demo data only). */
export function StoreLogo({
  store,
  size = 'md',
}: {
  store: Pick<Store, 'chain'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const logo = CHAIN_LOGOS[store.chain];
  const style = logo
    ? ({ background: logo.background, '--logo-scale': logo.scale ?? 1 } as CSSProperties)
    : undefined;
  return (
    <span className={`${styles.logo} ${styles[size]}`} style={style} aria-hidden="true">
      {logo ? (
        <img
          src={`${import.meta.env.BASE_URL}logos/${logo.file}`}
          alt=""
          draggable={false}
          className={styles[logo.fit]}
        />
      ) : (
        <span className={styles.initials}>{store.chain.slice(0, 2)}</span>
      )}
    </span>
  );
}
