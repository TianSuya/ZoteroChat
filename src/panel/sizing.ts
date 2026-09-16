/** Never shrink below this, however crowded the item pane gets. */
const MIN_HEIGHT = 200;
/** Leave the pane a little breathing room at the bottom. */
const BOTTOM_GUTTER = 4;

/**
 * The item pane's scroll container. `itemDetails.js` calls it `_paneParent`
 * and attaches its scroll handling to it, so its client height is the visible
 * space a section has to work with.
 */
function findViewport(el: HTMLElement): HTMLElement | null {
  return el.closest("#zotero-view-item") as HTMLElement | null;
}

function findSection(el: HTMLElement): HTMLElement | null {
  return el.closest("item-pane-custom-section") as HTMLElement | null;
}

/**
 * Distance from `el` to the top of the pane's *visible* area.
 *
 * This is what decides how much room is left below us, and it changes as the
 * pane scrolls — clicking our sidenav icon makes Zotero scroll the section to
 * the top, at which point this is 0 and the panel should fill the pane.
 */
function visibleTop(el: HTMLElement, viewport: HTMLElement): number {
  return el.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
}

/**
 * Distance from the top of the pane's scrollable *content* to `el`.
 *
 * Scroll-invariant: adding `scrollTop` back cancels the scroll offset baked
 * into the client rects. Used only as a floor — see `fit`.
 */
function contentTop(el: HTMLElement, viewport: HTMLElement): number {
  return visibleTop(el, viewport) + viewport.scrollTop;
}

/**
 * Sizes the panel so its bottom edge meets the bottom of the item pane.
 *
 * Item pane sections are laid out from their content, so a percentage height
 * collapses to zero — the panel has to be given a pixel height. Which height
 * depends on where the section currently sits:
 *
 *  - At rest it is pushed down by the sections above, so it fills what is left.
 *  - Clicking our sidenav icon makes Zotero scroll it to the top of the pane,
 *    and then it should fill the whole pane.
 *
 * Both are "bottom edge meets the pane's bottom edge", which means measuring
 * the *visible* offset rather than the offset within the scrolled content.
 *
 * The floor is what keeps that stable. Shrinking the panel shrinks the pane's
 * content, which can make the browser clamp `scrollTop` down, which increases
 * our visible offset, which shrinks the panel again — a spiral straight to
 * `MIN_HEIGHT`. Since `scrollTop >= 0`, the visible offset is never larger
 * than the content offset, so the scroll-invariant "at rest" height is always
 * a valid lower bound, and it is exactly the right answer when unscrolled.
 */
export function fitToItemPane(wrapper: HTMLElement): { dispose: () => void } {
  const win = wrapper.ownerDocument?.defaultView;
  const viewport = findViewport(wrapper);
  const section = findSection(wrapper);

  if (!win || !viewport) {
    // Not in a pane we recognise; leave whatever height is already set.
    return { dispose: () => {} };
  }

  let applied = 0;

  const fit = () => {
    const target = section ?? wrapper;
    // `offsetHeight` is undefined on XUL elements, and the section is one —
    // reading it yields NaN, which then poisons every later comparison
    // (NaN !== NaN, so the "did anything change" guard never holds and the
    // observers refit forever). Measured rects work on both namespaces.
    const chrome = section
      ? Math.max(
          0,
          section.getBoundingClientRect().height -
            wrapper.getBoundingClientRect().height,
        )
      : 0;
    const room = (offset: number) =>
      viewport.clientHeight - Math.max(0, offset) - chrome - BOTTOM_GUTTER;

    const atRest = room(contentTop(target, viewport));
    const available = Math.max(room(visibleTop(target, viewport)), atRest);
    if (!Number.isFinite(available)) return;

    const next = Math.max(MIN_HEIGHT, Math.round(available));
    if (next === applied) return;
    applied = next;
    wrapper.style.height = `${next}px`;
  };

  fit();
  // The first pass runs before the frame has been laid out, so `chrome` reads
  // as 0. One more pass after layout settles it.
  win.requestAnimationFrame(fit);

  // Viewport size changes with the window and the item pane splitter.
  const resizeObserver = new (win as any).ResizeObserver(fit);
  resizeObserver.observe(viewport);
  if (section) resizeObserver.observe(section);

  // Scrolling changes how much of the pane is below us — most visibly when
  // Zotero scrolls this section to the top in response to its sidenav button.
  let scrollPending = false;
  const onScroll = () => {
    if (scrollPending) return;
    scrollPending = true;
    win.requestAnimationFrame(() => {
      scrollPending = false;
      fit();
    });
  };
  viewport.addEventListener("scroll", onScroll, { passive: true });

  // Sibling sections collapsing or expanding moves us up and down, and that
  // shows up as attribute changes rather than a resize of anything we observe.
  let pending = false;
  const mutationObserver = new (win as any).MutationObserver(() => {
    if (pending) return;
    pending = true;
    win.requestAnimationFrame(() => {
      pending = false;
      fit();
    });
  });
  mutationObserver.observe(viewport, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open", "hidden", "style"],
  });

  return {
    dispose: () => {
      viewport.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    },
  };
}
