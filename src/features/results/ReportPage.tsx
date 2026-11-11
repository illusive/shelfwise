import { Link, useNavigate } from '@tanstack/react-router';
import { useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import type { SosScope } from '@/domain/sos';
import { formatPct, padSequence, formatAddress } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import { Badge, Divider, EmptyState, MockBadge, Mono, SectionHeader } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import { productName, productPack, sortPrices } from './labels';
import { PriceRow } from './PriceRow';
import styles from './results.module.css';
import report from './ReportPage.module.css';

export function ReportPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const { catalogue } = useServices();
  const { data: detail, isPending } = useVisitDetail(visitId);
  if (isPending) return null;
  if (!detail?.metrics || !detail.result) {
    return (
      <Screen>
        <EmptyState title={t.common.notFound} />
      </Screen>
    );
  }
  const { metrics, store, captures, result } = detail;
  const prices = sortPrices(metrics.prices);
  const groups = [
    { title: t.report.clientPrices, items: prices.filter((p) => p.classification === 'client') },
    {
      title: t.report.competitorPrices,
      items: prices.filter((p) => p.classification === 'competitor'),
    },
    {
      title: t.report.unmatchedPrices,
      items: prices.filter((p) => p.classification === 'unknown'),
    },
  ];
  const imageIssues = new Map(result.response.images.map((i) => [i.imageId, i]));

  return (
    <Screen>
      <TopBar
        title={t.report.title}
        subtitle={`${store.name} · ${formatAddress(store.address)}`}
        onBack={() => void navigate({ to: '/visits/$visitId/results', params: { visitId } })}
        right={<MockBadge source={metrics.source} />}
      />

      <section className={shared.stackTight}>
        <SectionHeader title={t.report.coverage} />
        <p className={shared.muted}>
          {t.results.coverage(metrics.coverage.imagesSubmitted, metrics.coverage.imagesUsable)} ·{' '}
          {t.results.locations(
            metrics.coverage.locations.shelf,
            metrics.coverage.locations.cooler,
            metrics.coverage.locations.display,
          )}
        </p>
        <p className={shared.muted}>
          {t.report.observations(metrics.coverage.observations, metrics.coverage.duplicatesMerged)}
        </p>
        <p className={shared.muted}>{t.results.capturedAreaOnly}</p>
        {metrics.warnings.length > 0 && (
          <ul className={report.warnings}>
            {metrics.warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{t.warnings[w.code] ?? w.message}</li>
            ))}
          </ul>
        )}
      </section>

      <Divider />
      <section className={shared.stackTight}>
        <SectionHeader title={t.results.sos} />
        <table className={report.table}>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">%</th>
              <th scope="col">{catalogue.client.name}</th>
              <th scope="col">{t.report.competitorPrices}</th>
              <th scope="col">{t.results.unknown}</th>
            </tr>
          </thead>
          <tbody>
            {(['shelf', 'cooler', 'overall'] as SosScope[]).map((scope) => {
              const { sos } = metrics.scopes[scope];
              return (
                <tr key={scope}>
                  <th scope="row">{t.results.scope[scope]}</th>
                  <td>
                    {sos.sharePct === null ? '—' : formatPct(sos.sharePct)}
                    {sos.status === 'qualified' && ' *'}
                  </td>
                  <td>{sos.counts.client}</td>
                  <td>{sos.counts.competitor}</td>
                  <td>{sos.counts.unknown}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(['shelf', 'cooler', 'overall'] as SosScope[])
          .filter((s) => metrics.scopes[s].sos.reasons.length > 0)
          .map((s) => (
            <p key={s} className={shared.muted}>
              {t.results.scope[s]}:{' '}
              {metrics.scopes[s].sos.reasons.map((r) => t.sosReasons[r]).join('; ')}
            </p>
          ))}
      </section>

      <Divider />
      <section className={shared.stackTight}>
        <SectionHeader
          title={t.report.clientProducts}
          aside={t.report.uniqueSkus(metrics.uniqueClientSkus)}
        />
        <ul className={shared.list}>
          {metrics.clientProducts.map((p) => (
            <li key={p.key} className={styles.priceRow}>
              <div>
                <p className={styles.priceName}>{productName(catalogue, p.productId, p.brandId)}</p>
                <p className={styles.priceSub}>
                  {productPack(catalogue, p.productId) ?? t.report.brandOnly}
                </p>
              </div>
              <div>
                <p className={styles.priceValue}>{p.facings.shelf + p.facings.cooler}</p>
                <p className={styles.priceDetail}>
                  {t.report.shelfCooler(p.facings.shelf, p.facings.cooler)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Divider />
      <section className={shared.stack}>
        <SectionHeader title={t.report.prices} aside={metrics.prices.length} />
        {metrics.prices.length === 0 && <p className={shared.muted}>{t.report.noPrices}</p>}
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <div key={g.title} className={shared.stackTight}>
              <Eyebrowish>{g.title}</Eyebrowish>
              <ul className={shared.list}>
                {g.items.map((p) => (
                  <li key={p.labelId}>
                    <PriceRow price={p} catalogue={catalogue} detailed />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>

      <Divider />
      <section className={shared.stackTight}>
        <SectionHeader title={t.results.promotions} aside={metrics.promotions.length} />
        {metrics.promotions.length === 0 && <p className={shared.muted}>{t.report.noPromotions}</p>}
        <ul className={shared.list}>
          {metrics.promotions.map((p) => (
            <li key={p.promotionId} className={styles.priceRow}>
              <div>
                <p className={styles.priceName}>{p.headline}</p>
                {p.conditionText && <p className={styles.priceSub}>{p.conditionText}</p>}
              </div>
              <Badge tone="accent">{t.report.mechanic[p.mechanic]}</Badge>
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

      <Divider />
      <section className={shared.stackTight}>
        <SectionHeader title={t.report.photos} aside={captures.length} />
        <ul className={report.photos}>
          {captures.map((c) => {
            const analysis = imageIssues.get(c.id);
            return (
              <li key={c.id}>
                <Link
                  to="/visits/$visitId/photos/$captureId"
                  params={{ visitId, captureId: c.id }}
                  className={report.photo}
                >
                  <BlobImage
                    blobId={c.thumbBlobId}
                    fallbackBlobId={c.blobId}
                    alt={t.store.capture(padSequence(c.sequence))}
                    className={report.photoImage}
                  />
                  <span className={report.photoLabel}>
                    {padSequence(c.sequence)} ·{' '}
                    {analysis?.locationType
                      ? t.locationTypes[analysis.locationType]
                      : t.photo.noLocation}
                  </span>
                  {analysis?.issues.length ? (
                    <span className={report.photoIssue}>
                      {analysis.issues.map((i) => t.imageIssues[i]).join(', ')}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Mono>
        {t.report.method(metrics.methodVersion, metrics.catalogueVersion)} ·{' '}
        {result.response.provider.name}
      </Mono>
    </Screen>
  );
}

function Eyebrowish({ children }: { children: string }) {
  return <Mono className={report.groupLabel}>{children.toUpperCase()}</Mono>;
}
