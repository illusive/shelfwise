import { useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n/strings';
import { ImageIcon } from '@/ui/icons';
import { Button, type ButtonVariant } from '@/ui/primitives/Button';

export interface ImportPhotosProps {
  /** Resolves the visit to import into (may create the draft on demand). */
  resolveVisitId: () => Promise<string>;
  onImport: (visitId: string, files: File[]) => Promise<unknown>;
  variant?: ButtonVariant;
  label?: ReactNode;
  block?: boolean;
}

/** Photo-library fallback for browsers or devices where the in-app camera is unavailable. */
export function ImportPhotos({ resolveVisitId, onImport, variant = 'ghost', label, block }: ImportPhotosProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        block={block}
        icon={<ImageIcon size={18} />}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? t.captures.importing : (label ?? t.store.importPhotos)}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="import-input"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length === 0) return;
          setBusy(true);
          try {
            await onImport(await resolveVisitId(), files);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
