/** SVG "goo" filter (blur + alpha threshold) merging nearby shapes into connected blobs. */
export const GOO_FILTER_ID = 'shelfwise-goo';

export function GooFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id={GOO_FILTER_ID}>
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feColorMatrix
          in="blur"
          mode="matrix"
          values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10"
        />
      </filter>
    </svg>
  );
}
