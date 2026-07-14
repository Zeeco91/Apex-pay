import type { AnchorHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary:
    "bg-accent text-accent-foreground hover:bg-accent-hover",
  outline:
    "border border-border text-foreground hover:bg-surface",
};

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
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
