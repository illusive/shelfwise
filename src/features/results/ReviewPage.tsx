import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useCurrentRep, useInvalidate, useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import type { Correction, EffectiveFacing, FacingCorrectionValue, PriceCorrectionValue } from '@/domain/corrections';
import type { NormalisedPrice } from '@/domain/pricing';
import { formatPack, parseDkkInput } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { newId } from '@/services/ids';
import { CheckIcon, SearchIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import { EmptyState, Mono, Notice } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import { EvidenceCrop } from './EvidenceCrop';
import { productName } from './labels';
import styles from './ReviewPage.module.css';

type Item = { kind: 'facing'; facing: EffectiveFacing } | { kind: 'price'; price: NormalisedPrice };

export function ReviewPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const services = useServices();
  const invalidate = useInvalidate();
  const { data: rep } = useCurrentRep();
  const { data: detail, isPending } = useVisitDetail(visitId);
  const [skipped, setSkipped] = useState<string[]>([]);

  const items = useMemo<Item[]>(() => {
    if (!detail?.metrics) return [];
    return [
      ...detail.metrics.facings
        .filter((f) => f.needsReview && !f.excluded && f.locationType !== 'display')
        .map((facing) => ({ kind: 'facing' as const, facing })),
      ...detail.metrics.prices.filter((p) => p.needsReview).map((price) => ({ kind: 'price' as const, price })),
    ];
  }, [detail]);

  if (isPending) return null;
  if (!detail?.metrics || !detail.result || !rep) {
    return (
      <Screen>
        <EmptyState title={t.common.notFound} />
      </Screen>
    );
  }

  const keyOf = (item: Item) => (item.kind === 'facing' ? item.facing.key : item.price.labelId);
  const remaining = items.filter((i) => !skipped.includes(keyOf(i)));
  const current = remaining[0];
  const blobFor = (imageId: string) => detail.captures.find((c) => c.id === imageId)?.blobId;
  const back = () => void navigate({ to: '/visits/$visitId/results', params: { visitId } });

  const save = async (item: Item, value: FacingCorrectionValue | PriceCorrectionValue) => {
    const base = {
      id: newId('corr'),
      resultId: detail.result!.id,
      visitId,
      repId: rep.id,
      createdAt: new Date().toISOString(),
    };
    const correction: Correction =
      item.kind === 'facing'
        ? { ...base, targetKind: 'facing', targetId: item.facing.key, value: value as FacingCorrectionValue }
        : { ...base, targetKind: 'price-label', targetId: item.price.labelId, value: value as PriceCorrectionValue };
    await services.repos.corrections.add(correction);
    await invalidate();
  };

  return (
    <Screen
      action={
        <Button block size="lg" variant={current ? 'secondary' : 'primary'} withArrow={!current} onClick={back}>
          {t.review.backToResults}
        </Button>
      }
    >
      <TopBar title={t.review.title} subtitle={`${detail.store.name} · ${detail.store.address.street}`} onBack={back} />
      <p className={shared.muted}>{t.review.intro}</p>
      {current ? (
        <>
          <Mono>{t.review.progress(remaining.length)}</Mono>
          <AnimatePresence mode="wait">
            <motion.div
              key={keyOf(current)}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              className={shared.stack}
            >
              {current.kind === 'facing' ? (
                <FacingReview
                  facing={current.facing}
                  blobId={blobFor(current.facing.evidence[0].imageId)}
                  onSave={(v) => save(current, v)}
                />
              ) : (
                <PriceReview price={current.price} blobId={blobFor(current.price.imageId)} onSave={(v) => save(current, v)} />
              )}
              <Button variant="ghost" onClick={() => setSkipped((s) => [...s, keyOf(current)])}>
                {t.review.skip}
              </Button>
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        <Notice tone="info" title={t.review.done}>
          {t.review.doneHint}
        </Notice>
      )}
    </Screen>
  );
}

function FacingReview({
  facing,
  blobId,
  onSave,
}: {
  facing: EffectiveFacing;
  blobId: string | undefined;
  onSave: (value: FacingCorrectionValue) => Promise<void>;
}) {
  const { catalogue } = useServices();
  const [query, setQuery] = useState('');
  const suggestion = facing.match.productId ?? null;
  const q = query.trim().toLocaleLowerCase('da-DK');
  const results = q
    ? catalogue.products
        .filter((p) => `${p.name} ${catalogue.brandById.get(p.brandId)?.name ?? ''}`.toLocaleLowerCase('da-DK').includes(q))
        .slice(0, 6)
    : [];

  return (
    <div className={shared.stack} data-testid="review-facing">
      <h2 className={styles.question}>{t.review.product}</h2>
      {blobId && <EvidenceCrop blobId={blobId} region={facing.evidence[0].region} label={t.review.product} />}
      {suggestion && (
        <Button variant="primary" block icon={<CheckIcon size={18} />} onClick={() => void onSave({ kind: 'product', productId: suggestion })}>
          {t.review.aiSuggested(productName(catalogue, suggestion, null))}
        </Button>
      )}
      <label className={shared.searchField}>
        <SearchIcon size={18} />
        <span className="visually-hidden">{t.review.searchProducts}</span>
        <input type="search" value={query} placeholder={t.review.searchProducts} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {results.length > 0 && (
        <ul className={styles.options}>
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.option} onClick={() => void onSave({ kind: 'product', productId: p.id })}>
                <span>{p.name}</span>
                <Mono>{formatPack(p.pack)}</Mono>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.pair}>
        <Button variant="secondary" onClick={() => void onSave({ kind: 'unknown' })}>
          {t.review.cantTell}
        </Button>
        <Button variant="secondary" onClick={() => void onSave({ kind: 'not-beverage' })}>
          {t.review.notBeverage}
        </Button>
      </div>
    </div>
  );
}

function PriceReview({
  price,
  blobId,
  onSave,
}: {
  price: NormalisedPrice;
  blobId: string | undefined;
  onSave: (value: PriceCorrectionValue) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [priceType, setPriceType] = useState<'regular' | 'promotion' | 'member'>('regular');
  const ore = parseDkkInput(amount);
  return (
    <div className={shared.stack} data-testid="review-price">
      <h2 className={styles.question}>{t.review.price}</h2>
      {blobId && <EvidenceCrop blobId={blobId} region={price.region} label={t.review.price} />}
      {price.rawText && <Mono>“{price.rawText}”</Mono>}
      {price.unresolvedReason && <p className={shared.muted}>{t.report.unresolvedReason[price.unresolvedReason]}</p>}
      <div className={styles.pair}>
        <label className={styles.field}>
          <span className={shared.muted}>{t.review.priceLabel}</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </label>
        <label className={styles.field}>
          <span className={shared.muted}>{t.review.priceType}</span>
          <select value={priceType} onChange={(e) => setPriceType(e.target.value as typeof priceType)}>
            <option value="regular">{t.report.priceType.regular}</option>
            <option value="promotion">{t.report.priceType.promotion}</option>
            <option value="member">{t.report.priceType.member}</option>
          </select>
        </label>
      </div>
      <div className={styles.pair}>
        <Button disabled={ore === null} onClick={() => ore !== null && void onSave({ kind: 'price', amountOre: ore, priceType })}>
          {t.review.confirm}
        </Button>
        <Button variant="secondary" onClick={() => void onSave({ kind: 'unreadable' })}>
          {t.review.unreadable}
        </Button>
      </div>
    </div>
  );
}
