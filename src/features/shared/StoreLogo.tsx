import type { Store } from '@/domain/models';
import styles from './StoreLogo.module.css';

/** Bundled chain logos (demo data only — see docs/logo-sources.md). */
const LOGOS: Record<string, string> = {
  Netto: 'netto.svg',
  Føtex: 'fotex.svg',
  Bilka: 'bilka.svg',
  'Rema 1000': 'rema-1000.svg',
  'Coop 365': 'coop-365.png',
  Kvickly: 'kvickly.png',
  SuperBrugsen: 'superbrugsen.png',
  Meny: 'meny.svg',
  Spar: 'spar.svg',
  Lidl: 'lidl.svg',
};

export function StoreLogo({
  store,
  size = 'md',
}: {
  store: Pick<Store, 'chain'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const file = LOGOS[store.chain];
  return (
    <span className={`${styles.logo} ${styles[size]}`} aria-hidden="true">
      {file ? (
        <img src={`${import.meta.env.BASE_URL}logos/${file}`} alt="" draggable={false} />
      ) : (
        <span className={styles.initials}>{store.chain.slice(0, 2)}</span>
      )}
    </span>
  );
}
