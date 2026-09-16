import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

/*
 * Notion restraint: 3px radii, no shadows, no borders on anything but the
 * primary action, and hover expressed purely as a background shift.
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded font-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:brightness-110",
        ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
        subtle: "bg-surface-subtle text-fg hover:bg-surface-hover",
      },
      size: {
        sm: "h-6 px-1.5 text-sm",
        md: "h-7 px-2 text-base",
        icon: "h-6 w-6",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
