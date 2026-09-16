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
 * Distance from the top of the pane's scrollable content to `el`.
 *
 * Deliberately scroll-invariant: adding `scrollTop` back cancels out the
 * scroll offset baked into the client rects, so scrolling the pane does not
 * change the result and cannot make the panel resize under the user.
 */
function offsetWithinContent(el: HTMLElement, viewport: HTMLElement): number {
  return (
    el.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top +
    viewport.scrollTop
  );
}

/**
 * Sizes the panel to fill the rest of the item pane.
 *
 * Item pane sections are laid out from their content, so a percentage height
 * collapses to zero — the panel has to be given a pixel height. Sizing it to
 * the *whole* viewport is wrong too: the sections above ours push it down, so
 * it would overflow and take the composer off-screen. What "as tall as the
 * sidebar" actually means is: end where the pane ends.
 *
 * When the sections above leave less than `MIN_HEIGHT`, the panel stops
 * shrinking and the pane scrolls instead.
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
    const top = offsetWithinContent(section ?? wrapper, viewport);
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
    const available = viewport.clientHeight - top - chrome - BOTTOM_GUTTER;
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
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    },
  };
}
