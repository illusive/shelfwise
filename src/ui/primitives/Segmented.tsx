import * as ToggleGroup from '@radix-ui/react-toggle-group';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Short status hint shown next to the label, e.g. "—" when unavailable. */
  hint?: string;
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      className={styles.root}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} className={styles.item}>
          {o.label}
          {o.hint && <span className={styles.hint}>{o.hint}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
