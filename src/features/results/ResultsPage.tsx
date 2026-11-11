import { Link, useNavigate } from '@tanstack/react-router';
import { useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import { formatRelativeDay, formatTime, plural } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { CheckIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import {
  Divider,
  EmptyState,
  Eyebrow,
  MockBadge,
  Notice,
  SectionHeader,
} from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import { sortPrices } from './labels';
import { PriceRow } from './PriceRow';
import { ShareHero } from './ShareHero';
import styles from './results.module.css';

export function ResultsPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const { catalogue } = useServices();
  const { data: detail, isPending } = useVisitDetail(visitId);

  if (isPending) return null;
  if (!detail?.metrics || !detail.visit.completedAt) {
    return (
      <Screen>
        <TopBar title={t.results.title} onBack={() => void navigate({ to: '/' })} />
        <EmptyState title={t.common.notFound} />
      </Screen>
    );
  }
  const { metrics, store, previous } = detail;
  const completedAt = detail.visit.completedAt;
  const tz = store.timeZone;
  const unresolved = metrics.unresolved.facings + metrics.unresolved.prices;
  const corrections = metrics.provenance.correctedFacings + metrics.provenance.correctedPrices;
  // The summary lists each product/pack/price once; the report keeps every label.
  const seen = new Set<string>();
  const prices = sortPrices(metrics.prices).filter((p) => {
    if (p.status !== 'resolved' || p.classification === 'unknown') return false;
    const key = `${p.productId ?? p.brandId}|${p.pack?.units}x${p.pack?.volumeMl}|${p.displayedOre}|${p.priceType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <Screen
      action={
        <Button
          block
          size="lg"
          withArrow
          onClick={() => void navigate({ to: '/visits/$visitId/report', params: { visitId } })}
        >
          {t.results.fullReport}
        </Button>
      }
    >
      <TopBar
        title={t.results.title}
        onBack={() => void navigate({ to: '/stores/$storeId', params: { storeId: store.id } })}
        right={
          <span className={shared.footnote}>
            <CheckIcon size={14} /> {t.results.saved}
          </span>
        }
        subtitle={`${store.name} · ${store.address.street}`}
      />
      <div className={shared.spread}>
        <Eyebrow>{t.results.summary}</Eyebrow>
        <MockBadge source={metrics.source} />
      </div>

      <ShareHero
        metrics={metrics}
        previous={previous?.metrics ?? null}
        clientName={catalogue.client.name}
      />

      <p className={shared.muted}>
        {t.results.locations(
          metrics.coverage.locations.shelf,
          metrics.coverage.locations.cooler,
          metrics.coverage.locations.display,
        )}{' '}
        · {t.results.coverage(metrics.coverage.imagesSubmitted, metrics.coverage.imagesUsable)}
      </p>

      {unresolved > 0 && (
        <Notice
          title={t.results.reviewNeeded(unresolved)}
          action={
            <Link
              to="/visits/$visitId/review"
              params={{ visitId }}
              className={styles.toggle}
              data-testid="review-link"
            >
              {t.results.review} →
            </Link>
          }
        >
          {t.results.reviewHint}
        </Notice>
      )}

      <Divider />
      <section className={shared.stackTight}>
        <SectionHeader title={t.results.pricing} />
        <div className={styles.priceHead}>
          <span>{t.results.productsIdentified(metrics.uniqueClientSkus)}</span>
          <span>{t.results.price}</span>
        </div>
        <ul className={shared.list}>
          {prices.slice(0, 5).map((p) => (
            <li key={p.labelId}>
              <PriceRow price={p} catalogue={catalogue} />
            </li>
          ))}
        </ul>
        {prices.length > 5 && (
          <Link to="/visits/$visitId/report" params={{ visitId }} className={styles.toggle}>
            {plural(prices.length - 5, 'more price', 'more prices')} →
          </Link>
        )}
      </section>

      {(metrics.promotions.length > 0 || metrics.displays.count > 0) && (
        <section className={shared.stackTight}>
          <SectionHeader title={t.results.promotions} aside={metrics.promotions.length} />
          <ul className={shared.list}>
            {metrics.promotions.map((p) => (
              <li key={p.promotionId} className={styles.priceRow}>
                <div>
                  <p className={styles.priceName}>{p.headline}</p>
                  {p.conditionText && <p className={styles.priceSub}>{p.conditionText}</p>}
                </div>
              </li>
            ))}
          </ul>
          {metrics.displays.count > 0 && (
            <p className={shared.muted}>
              {t.results.displays(metrics.displays.count, metrics.displays.withClientBrand)}.{' '}
              {t.results.displaysHint}
            </p>
          )}
        </section>
      )}

      <div className={shared.stackTight}>
        <p className={shared.footnote}>
          <CheckIcon size={14} />
          {t.results.savedTo(
            store.name,
            `${formatRelativeDay(completedAt, tz)}, ${formatTime(completedAt, tz)}`,
          )}
        </p>
        {corrections > 0 && <p className={shared.footnote}>{t.results.corrections(corrections)}</p>}
        <p className={shared.footnote}>{t.results.capturedAreaOnly}</p>
        <p className={shared.footnote}>{t.results.disclaimer}</p>
      </div>
    </Screen>
  );
}
