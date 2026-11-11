import * as RadixSwitch from '@radix-ui/react-switch';
import { useId } from 'react';
import styles from './Switch.module.css';

/** On/off setting row: label and helper text with a switch (Radix, keyboard and SR ready). */
export function Switch({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  testId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
      <RadixSwitch.Root
        id={id}
        className={styles.root}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        data-testid={testId}
      >
        <RadixSwitch.Thumb className={styles.thumb} />
      </RadixSwitch.Root>
    </div>
  );
}
