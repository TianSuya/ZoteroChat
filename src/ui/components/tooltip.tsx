import { Tooltip as T } from "radix-ui";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";

import { cn } from "../lib/cn";

export const TooltipProvider = T.Provider;
export const Tooltip = T.Root;
export const TooltipTrigger = T.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof T.Content>,
  ComponentPropsWithoutRef<typeof T.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <T.Portal>
    <T.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded border border-border bg-surface-raised px-1.5 py-1 text-sm text-fg-muted shadow-md",
        className,
      )}
      {...props}
    />
  </T.Portal>
));
TooltipContent.displayName = "TooltipContent";
