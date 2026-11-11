import type { CatalogueIndex } from '@/domain/catalogue';
import type { NormalisedPrice } from '@/domain/pricing';
import { formatDkk, formatPack } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { Badge } from '@/ui/primitives/Text';
import { priceLabelName, productPack } from './labels';
import styles from './results.module.css';

function depositText(p: NormalisedPrice): string | null {
  if (!p.deposit.shown) return p.basis === 'as-displayed' ? t.report.depositUnknown : null;
  if (p.deposit.amountOre === null) return null;
  return p.deposit.included ? t.report.depositIncluded(formatDkk(p.deposit.amountOre)) : t.report.deposit(formatDkk(p.deposit.amountOre));
}

export function PriceRow({ price, catalogue, detailed = false }: { price: NormalisedPrice; catalogue: CatalogueIndex; detailed?: boolean }) {
  const pack = price.pack ? formatPack(price.pack) : productPack(catalogue, price.productId);
  const deposit = depositText(price);
  return (
    <div className={styles.priceRow}>
      <div>
        <p className={styles.priceName}>{priceLabelName(catalogue, price)}</p>
        <p className={styles.priceSub}>
          {[pack, price.priceType !== 'regular' && price.status === 'resolved' ? t.report.priceType[price.priceType] : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {detailed && price.conditionText && <p className={styles.priceSub}>{price.conditionText}</p>}
        {detailed && price.rawText && <p className={styles.priceDetail} style={{ textAlign: 'left' }}>“{price.rawText}”</p>}
      </div>
      <div>
        {price.status === 'resolved' && price.displayedOre !== null ? (
          <>
            <p className={styles.priceValue}>{formatDkk(price.displayedOre)}</p>
            {deposit && <p className={styles.priceDetail}>{deposit}</p>}
            {price.multibuy && (
              <p className={styles.priceDetail}>
                {t.report.multibuy(price.multibuy.quantity, formatDkk(price.multibuy.totalOre), formatDkk(price.multibuy.perItemOre))}
              </p>
            )}
            {detailed && price.pricePerLitreOre !== null && (
              <p className={styles.priceDetail}>{t.report.perLitre(formatDkk(price.pricePerLitreOre))}</p>
            )}
          </>
        ) : (
          <Badge tone="warning">{price.unresolvedReason ? t.report.unresolvedReason[price.unresolvedReason] : t.report.unresolved}</Badge>
        )}
        {price.source === 'rep' && (
          <p className={styles.priceDetail}>
            <Badge tone="neutral">{t.report.repCorrected}</Badge>
          </p>
        )}
      </div>
    </div>
  );
}
