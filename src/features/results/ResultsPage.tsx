import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import { t } from '@/i18n/strings';
import { CheckIcon, ChevronRightIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import { Divider, EmptyState, Notice, SectionHeader } from '@/ui/primitives/Text';
import { PageTitle } from '../shared/PageTitle';
import shared from '../shared/shared.module.css';
import { StoreHeader } from '../shared/StoreHeader';
import { Sheet } from '@/ui/primitives/Sheet';
import { sortPrices } from './labels';
import { PriceRow } from './PriceRow';
import { ShareHero } from './ShareHero';
import styles from './results.module.css';

export function ResultsPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const { catalogue } = useServices();
  const { data: detail, isPending } = useVisitDetail(visitId);
  const [gateOpen, setGateOpen] = useState(false);

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

  const openReport = () => {
    if (unresolved > 0) setGateOpen(true);
    else void navigate({ to: '/visits/$visitId/report', params: { visitId } });
  };
  const reviewNotice =
    unresolved > 0 ? (
      <Notice
        title={t.results.reviewNeeded(unresolved)}
        action={
          <Link
            to="/visits/$visitId/review"
            params={{ visitId }}
            className={styles.reviewLink}
            data-testid="review-link"
          >
            {t.results.review} →
          </Link>
        }
      >
        {t.results.reviewHint}
      </Notice>
    ) : null;

  return (
    <Screen
      header={
        <StoreHeader
          store={store}
          onBack={() => void navigate({ to: '/stores/$storeId', params: { storeId: store.id } })}
        />
      }
      action={
        <Button block size="lg" withArrow onClick={openReport}>
          {t.results.fullReport}
        </Button>
      }
    >
      <PageTitle
        title={t.results.title}
        aside={
          <>
            <CheckIcon size={14} /> {t.results.saved}
          </>
        }
      />
      {reviewNotice}

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
          <Link to="/visits/$visitId/report" params={{ visitId }} className={styles.moreLink}>
            <span>{t.results.morePrices(prices.length - 5)}</span>
            <ChevronRightIcon size={18} />
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
        {corrections > 0 && <p className={shared.footnote}>{t.results.corrections(corrections)}</p>}
        <p className={shared.footnote}>{t.results.capturedAreaOnly}</p>
        <p className={shared.footnote}>{t.results.disclaimer}</p>
      </div>
      <Sheet
        open={gateOpen}
        onOpenChange={setGateOpen}
        title={t.results.reportGateTitle(unresolved)}
        description={t.results.reportGateBody}
      >
        <div className={shared.stack}>
          <Button
            block
            size="lg"
            onClick={() => void navigate({ to: '/visits/$visitId/review', params: { visitId } })}
          >
            {t.results.review}
          </Button>
          <Button
            block
            size="lg"
            variant="secondary"
            onClick={() => void navigate({ to: '/visits/$visitId/report', params: { visitId } })}
          >
            {t.results.reportGateSkip}
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
