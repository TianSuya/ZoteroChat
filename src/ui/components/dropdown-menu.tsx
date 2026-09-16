import { DropdownMenu as D } from "radix-ui";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";

import { cn } from "../lib/cn";

export const DropdownMenu = D.Root;
export const DropdownMenuTrigger = D.Trigger;
export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof D.Separator>,
  ComponentPropsWithoutRef<typeof D.Separator>
>(({ className, ...props }, ref) => (
  <D.Separator
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof D.Content>,
  ComponentPropsWithoutRef<typeof D.Content>
>(({ className, align = "end", sideOffset = 4, ...props }, ref) => (
  <D.Portal>
    <D.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[160px] rounded-md border border-border bg-surface-raised p-1 shadow-lg outline-none",
        className,
      )}
      {...props}
    />
  </D.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof D.Item>,
  ComponentPropsWithoutRef<typeof D.Item>
>(({ className, ...props }, ref) => (
  <D.Item
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded px-2 py-1 text-base text-fg outline-none transition-colors data-[highlighted]:bg-surface-hover data-[disabled]:opacity-40",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";
