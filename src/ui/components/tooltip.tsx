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
        "zc-portal zc-float z-50 rounded px-1.5 py-1 text-sm text-fg",
        className,
      )}
      {...props}
    />
  </T.Portal>
));
TooltipContent.displayName = "TooltipContent";
