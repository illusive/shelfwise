import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, type RefObject } from 'react';
import { coverTransform, isInView, type Track } from './tracking';
import styles from './DetectionOverlay.module.css';

/** Soft lime corner brackets around detected drinks, mapped through object-fit: cover. */
export function DetectionOverlay({
  tracks,
  videoRef,
  onVisibleCount,
}: {
  tracks: Track[];
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Drinks actually inside the visible preview (excludes the cover-cropped edges). */
  onVisibleCount: (count: number) => void;
}) {
  const reduced = useReducedMotion();
  const [view, setView] = useState({ width: 0, height: 0 });
  const video = videoRef.current;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const measure = () => setView({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [videoRef]);

  const frame = video?.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : null;
  const shown = frame && view.width ? tracks.filter((t) => isInView(t.box, frame, view)) : [];
  const visible = shown.length;
  useEffect(() => onVisibleCount(visible), [visible, onVisibleCount]);

  if (!frame || !view.width) return null;

  return (
    <div className={styles.overlay} aria-hidden="true" data-testid="detection-overlay">
      <AnimatePresence>
        {shown.map((track) => {
          const r = coverTransform(track.box, frame, view);
          return (
            <motion.span
              key={track.id}
              className={styles.box}
              data-testid="detection-box"
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{
                opacity: track.misses > 0 ? 0.45 : 1,
                scale: 1,
                x: r.left,
                y: r.top,
                width: r.width,
                height: r.height,
              }}
              exit={
                reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.9 }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: 'tween', ease: 'easeOut', duration: 0.14, opacity: { duration: 0.2 } }
              }
            >
              <i data-c="tl" />
              <i data-c="tr" />
              <i data-c="bl" />
              <i data-c="br" />
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
