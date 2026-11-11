import { formatWeekdayShort } from '@/i18n/format';
import { t } from '@/i18n/strings';
import styles from './DayStrip.module.css';

export interface DayStripProps {
  days: string[];
  today: string;
  selected: string;
  /** Days that have planned visits (shown with a dot). */
  planned: ReadonlySet<string>;
  onSelect: (day: string) => void;
}

/** Monday–Sunday strip; the selected day is a filled circle, today is ringed. */
export function DayStrip({ days, today, selected, planned, onSelect }: DayStripProps) {
  return (
    <div className={styles.strip} role="radiogroup" aria-label={t.home.week}>
      {days.map((day) => (
        <button
          key={day}
          type="button"
          role="radio"
          aria-checked={day === selected}
          className={styles.day}
          data-selected={day === selected}
          data-today={day === today}
          onClick={() => onSelect(day)}
        >
          <span className={styles.weekday}>{formatWeekdayShort(day)}</span>
          <span className={styles.date}>{Number(day.slice(8))}</span>
          <span className={styles.dot} data-visible={planned.has(day)} />
        </button>
      ))}
    </div>
  );
}
