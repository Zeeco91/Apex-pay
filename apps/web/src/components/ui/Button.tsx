import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "outline";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary:
    "bg-accent text-accent-foreground hover:bg-accent-hover",
  outline:
    "border border-border text-foreground hover:bg-surface",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  isLoading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_CLASSES} disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Spinner /> : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
