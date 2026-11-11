import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import type { Region } from '@/contracts/analysis';
import { formatDkk, padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { ArrowLeftIcon, ArrowRightIcon } from '@/ui/icons';
import { useBlobUrl } from '@/ui/primitives/useBlobUrl';
import { Screen } from '@/ui/primitives/Screen';
import { Badge, EmptyState, Mono } from '@/ui/primitives/Text';
import { PageTitle } from '../shared/PageTitle';
import shared from '../shared/shared.module.css';
import { StoreHeader } from '../shared/StoreHeader';
import { priceLabelName, productName } from './labels';
import styles from './PhotoPage.module.css';

interface Box {
  id: string;
  kind: 'client' | 'competitor' | 'unknown' | 'price';
  region: Region;
  title: string;
  detail: string;
}

export function PhotoPage({ visitId, captureId }: { visitId: string; captureId: string }) {
  const navigate = useNavigate();
  const { catalogue } = useServices();
  const { data: detail, isPending } = useVisitDetail(visitId);
  const capture = detail?.captures.find((c) => c.id === captureId);
  const url = useBlobUrl(capture?.blobId);
  const [selected, setSelected] = useState<string | null>(null);

  if (isPending) return null;
  if (!detail?.metrics || !detail.result || !capture) {
    return (
      <Screen>
        <EmptyState title={t.common.notFound} />
      </Screen>
    );
  }

  const { metrics, result, captures } = detail;
  const index = captures.findIndex((c) => c.id === captureId);
  const analysis = result.response.images.find((i) => i.imageId === captureId);
  const location = result.response.locations.find((l) => l.locationId === analysis?.locationId);
  const priceByLabel = new Map(metrics.prices.map((p) => [p.physicalLabelId ?? p.labelId, p]));

  const boxes: Box[] = [];
  for (const f of metrics.facings) {
    for (const e of f.evidence) {
      if (e.imageId !== captureId || !e.region) continue;
      boxes.push({
        id: e.observationId,
        kind: f.excluded ? 'unknown' : f.classification,
        region: e.region,
        title:
          f.classification === 'unknown'
            ? t.results.unknown
            : productName(catalogue, f.productId, f.brandId),
        detail: [
          t.locationTypes[f.locationType],
          f.source === 'rep' ? t.report.repCorrected : t.photo.match[f.match.status],
          f.evidence.length > 1 ? t.photo.viewsMerged(f.evidence.length) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }
  for (const label of result.response.priceLabels) {
    if (label.imageId !== captureId || !label.region) continue;
    const normalised = priceByLabel.get(label.physicalLabelId ?? label.labelId);
    boxes.push({
      id: label.labelId,
      kind: 'price',
      region: label.region,
      title: normalised
        ? priceLabelName(catalogue, normalised)
        : (label.rawText ?? t.report.unresolved),
      detail:
        normalised?.status === 'resolved' && normalised.displayedOre !== null
          ? formatDkk(normalised.displayedOre)
          : label.unresolvedReason
            ? t.report.unresolvedReason[label.unresolvedReason]
            : t.report.unresolved,
    });
  }
  const active = boxes.find((b) => b.id === selected);
  const go = (offset: number) => {
    const next = captures[index + offset];
    if (next) {
      setSelected(null);
      void navigate({
        to: '/visits/$visitId/photos/$captureId',
        params: { visitId, captureId: next.id },
        replace: true,
      });
    }
  };

  return (
    <Screen
      header={
        <StoreHeader
          store={detail.store}
          onBack={() => void navigate({ to: '/visits/$visitId/report', params: { visitId } })}
        />
      }
    >
      <PageTitle
        title={t.photo.title(padSequence(capture.sequence))}
        aside={t.photo.of(index + 1, captures.length)}
      />
      <div className={shared.spread}>
        <Badge tone="dark">
          {location
            ? `${t.locationTypes[location.type]} ${
                result.response.locations
                  .filter((l) => l.type === location.type)
                  .indexOf(location) + 1
              }`
            : t.photo.noLocation}
        </Badge>
        {analysis?.issues.map((i) => (
          <Badge key={i} tone="warning">
            {t.imageIssues[i]}
          </Badge>
        ))}
      </div>
      <div
        className={styles.viewer}
        style={{ aspectRatio: `${capture.width} / ${capture.height}` }}
      >
        {url && (
          <img
            src={url}
            alt={t.photo.title(padSequence(capture.sequence))}
            className={styles.image}
          />
        )}
        <svg
          className={styles.overlay}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          role="group"
          aria-label={t.photo.evidence}
        >
          {boxes.map((b) => (
            <rect
              key={b.id}
              x={b.region.x}
              y={b.region.y}
              width={b.region.width}
              height={b.region.height}
              className={styles.box}
              data-kind={b.kind}
              data-selected={b.id === selected}
              vectorEffect="non-scaling-stroke"
              role="button"
              tabIndex={0}
              aria-label={`${b.title}, ${b.detail}`}
              onClick={() => setSelected(b.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelected(b.id);
              }}
            />
          ))}
        </svg>
      </div>
      <ul className={styles.legend}>
        <li data-kind="client">{t.photo.legendClient}</li>
        <li data-kind="competitor">{t.photo.legendCompetitor}</li>
        <li data-kind="unknown">{t.photo.legendUnknown}</li>
        <li data-kind="price">{t.photo.legendPrice}</li>
      </ul>
      <div className={styles.info} aria-live="polite">
        {active ? (
          <>
            <p className={styles.infoTitle}>{active.title}</p>
            <Mono>{active.detail}</Mono>
          </>
        ) : (
          <p className={shared.muted}>{t.photo.regions(boxes.length)}</p>
        )}
      </div>
      <div className={shared.spread}>
        <button
          type="button"
          className={styles.pager}
          onClick={() => go(-1)}
          disabled={index <= 0}
          aria-label={t.photo.previous}
        >
          <ArrowLeftIcon />
        </button>
        <Link to="/visits/$visitId/results" params={{ visitId }} className={shared.muted}>
          {t.results.title}
        </Link>
        <button
          type="button"
          className={styles.pager}
          onClick={() => go(1)}
          disabled={index >= captures.length - 1}
          aria-label={t.photo.next}
        >
          <ArrowRightIcon />
        </button>
      </div>
    </Screen>
  );
}
