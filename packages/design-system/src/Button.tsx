import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
}

export function buttonClassName(options: ButtonStyleOptions = {}): string {
  const { variant = "secondary", size = "md", block, iconOnly } = options;
  return cn(
    "vt-button",
    variant !== "secondary" && `vt-button--${variant}`,
    size !== "md" && `vt-button--${size}`,
    block && "vt-button--block",
    iconOnly && "vt-button--icon",
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "secondary",
    size = "md",
    block,
    iconOnly,
    loading = false,
    leadingIcon,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClassName({ variant, size, block, iconOnly }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="vt-spinner" aria-hidden="true" /> : leadingIcon}
      {children}
    </button>
  );
});
