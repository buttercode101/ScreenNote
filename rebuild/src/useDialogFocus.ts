import { useEffect, useRef, type RefObject } from "react";
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function visibleDialogs(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
}
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, onClose?: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!node.hasAttribute("tabindex")) node.tabIndex = -1;
    const focusables = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && el.getAttribute("aria-hidden") !== "true");
    const focusFirst = () => (focusables()[0] ?? node).focus({ preventScroll: true });
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      const dialogs = visibleDialogs(), top = dialogs[dialogs.length - 1];
      if (event.key === "Escape") {
        if (top === node) { event.preventDefault(); closeRef.current?.(); }
        return;
      }
      if (event.key !== "Tab" || top && top !== node) return;
      const list = focusables();
      if (!list.length) { event.preventDefault(); node.focus({ preventScroll: true }); return; }
      const first = list[0], last = list[list.length - 1], current = document.activeElement;
      if (event.shiftKey && (current === first || !node.contains(current))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (current === last || !node.contains(current))) { event.preventDefault(); first.focus(); }
    };
    const focusin = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || node.contains(target)) return;
      const dialogs = visibleDialogs(), top = dialogs[dialogs.length - 1];
      if (top && top !== node && top.contains(target)) return;
      focusFirst();
    };
    node.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      node.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
