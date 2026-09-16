import { Command as CommandPrimitive } from "cmdk";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";

import { cn } from "../lib/cn";

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex w-full flex-col overflow-hidden rounded-md bg-surface-raised",
      className,
    )}
    {...props}
  />
));
Command.displayName = "Command";

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    ref={ref}
    className={cn(
      "h-7 w-full bg-transparent px-2 text-base text-fg outline-none placeholder:text-fg-faint",
      className,
    )}
    {...props}
  />
));
CommandInput.displayName = "CommandInput";

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("zc-scroll max-h-[240px] overflow-y-auto p-1", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn("px-2 py-3 text-center text-sm text-fg-faint", className)}
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded px-2 py-1 text-base text-fg outline-none transition-colors data-[selected=true]:bg-surface-hover data-[disabled=true]:opacity-40",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";
