import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRightIcon } from '../icons';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  /** Figma's primary action: label left, lime circle with arrow right. */
  withArrow?: boolean;
  block?: boolean;
  size?: 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  icon,
  withArrow = false,
  block = false,
  size = 'md',
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    block ? styles.block : '',
    withArrow ? styles.withArrow : '',
    className ?? '',
  ].join(' ');
  return (
    <button type={type} className={classes} {...props}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
      {withArrow && (
        <span className={styles.arrow} aria-hidden="true">
          <ArrowRightIcon size={16} />
        </span>
      )}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** `outline`/`outline-light`: circular border, used for close/back controls in modals and headers. */
  tone?: 'light' | 'dark' | 'plain' | 'outline' | 'outline-light';
}

export function IconButton({
  label,
  tone = 'plain',
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`${styles.iconButton} ${styles[`tone-${tone}`]} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
