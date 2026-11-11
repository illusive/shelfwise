import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useServices } from '@/app/services-context';

/** Object URL for a stored blob, revoked when no longer used. */
export function useBlobUrl(blobId: string | null | undefined): string | null {
  const { blobs } = useServices();
  const { data: blob } = useQuery({
    queryKey: ['blob', blobId],
    queryFn: async () => (blobId ? ((await blobs.get(blobId)) ?? null) : null),
    enabled: Boolean(blobId),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
