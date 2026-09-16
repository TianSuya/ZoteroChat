import { useEffect } from "react";

import { report } from "../utils/report";

import { Button } from "../ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/components/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/components/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/components/tooltip";

type ProbeResult = {
  layer: string;
  portaled: boolean;
  positioned: boolean;
  width: number;
  height: number;
  styled: boolean;
  /** Anchored means floating-ui replaced its initial off-screen transform. */
  anchored: boolean;
  transform: string;
};

/**
 * M1 gate: Radix floating layers inside a shadow root.
 *
 * This is the riskiest assumption in the UI plan. Radix reads
 * `document.activeElement` and appends focus guards to `document.body`, and in
 * the Zotero sandbox neither behaves the way a browser page does.
 *
 * Every layer renders open from the first commit — no state, no timers. That
 * isolates "does Radix work here" from "does a state toggle land in time",
 * which are very different questions and only the first one gates the design.
 */
export function RadixProbe({
  onDone,
}: {
  onDone?: (results: ProbeResult[]) => void;
}) {
  useEffect(() => {
    let cancelled = false;

    const measure = (layer: string, selector: string): ProbeResult => {
      const el = document.querySelector<HTMLElement>(selector);
      const rect = el?.getBoundingClientRect();
      const computed = el ? getComputedStyle(el) : undefined;
      // Radix parks content at translate(0, -200%) until floating-ui measures
      // the anchor. If that transform survives, positioning never ran.
      const wrapper = el?.closest(
        "[data-radix-popper-content-wrapper]",
      ) as HTMLElement | null;
      const transform = wrapper?.style?.transform ?? "";

      return {
        layer,
        portaled: Boolean(el),
        positioned: Boolean(rect && rect.width > 0 && rect.height > 0),
        width: Math.round(rect?.width ?? 0),
        height: Math.round(rect?.height ?? 0),
        styled: computed ? computed.borderTopWidth !== "0px" : false,
        anchored: Boolean(transform) && !transform.includes("-200%"),
        transform,
      };
    };

    (async () => {
      // Everything is open from the first commit, so this only waits for the
      // positioning engine to place them.
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (cancelled) return;

      const results = [
        measure("tooltip", "[data-probe='tooltip']"),
        measure("dropdown-menu", "[data-probe='menu']"),
        measure("popover", "[data-probe='popover']"),
        measure("command", "[cmdk-root]"),
      ];

      report("RADIX PROBE", JSON.stringify(results, null, 1));
      report(
        "PROBE DIAG",
        JSON.stringify(
          {
            inBody: document.body.querySelectorAll(
              "[data-radix-popper-content-wrapper]",
            ).length,
            focusTag:
              (document.activeElement as HTMLElement | null)?.tagName ?? null,
          },
          null,
          1,
        ),
      );
      onDone?.(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center gap-1 p-2">
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button size="sm">Tooltip</Button>
          </TooltipTrigger>
          <TooltipContent data-probe="tooltip">
            Tooltip in shadow root
          </TooltipContent>
        </Tooltip>

        {/* `modal={false}` everywhere: no focus trap, which is the part Radix
            gets wrong inside a shadow tree. */}
        <DropdownMenu open modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent data-probe="menu">
            <DropdownMenuItem>First item</DropdownMenuItem>
            <DropdownMenuItem>Second item</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Third item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open modal={false}>
          <PopoverTrigger asChild>
            <Button size="sm">Popover</Button>
          </PopoverTrigger>
          <PopoverContent
            data-probe="popover"
            className="w-52 p-2 text-sm text-fg-muted"
          >
            Popover body
          </PopoverContent>
        </Popover>

        <Popover open modal={false}>
          <PopoverTrigger asChild>
            <Button size="sm">Slash</Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-0">
            <Command>
              <CommandInput placeholder="Filter commands…" />
              <CommandList>
                <CommandEmpty>No match</CommandEmpty>
                <CommandItem value="explain">Explain selection</CommandItem>
                <CommandItem value="summarize">
                  Summarize this section
                </CommandItem>
                <CommandItem value="note">Save as note</CommandItem>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
