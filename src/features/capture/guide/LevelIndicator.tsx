import { t } from '@/i18n/strings';
import { isLevel } from './guide';
import styles from './LevelIndicator.module.css';
import type { TiltStatus } from './motion';

/** Horizon line that turns lime when the phone is level; asks for the sensor on iOS. */
export function LevelIndicator({
  status,
  roll,
  onEnable,
}: {
  status: TiltStatus;
  roll: number | null;
  onEnable: () => void;
}) {
  if (status === 'needs-permission') {
    return (
      <button type="button" className={styles.enable} onClick={onEnable}>
        {t.camera.guide.enableLevel}
      </button>
    );
  }
  if (status !== 'active' || roll === null) return null;
  const level = isLevel(roll);
  const shown = Math.max(-25, Math.min(25, roll));
  return (
    <div
      className={styles.level}
      data-testid="level-indicator"
      data-level={level}
      role="status"
      aria-label={level ? t.camera.guide.level : t.camera.guide.tilted(Math.round(Math.abs(roll)))}
    >
      <span className={styles.reference} aria-hidden="true" />
      <span
        className={styles.horizon}
        style={{ transform: `rotate(${-shown}deg)` }}
        aria-hidden="true"
      />
      {!level && <span className={styles.label}>{Math.round(Math.abs(roll))}°</span>}
    </div>
  );
}
