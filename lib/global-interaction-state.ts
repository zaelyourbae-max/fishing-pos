"use client";

import { useEffect } from "react";

const BODY_LOCK_COUNT_ATTR = "data-body-scroll-lock-count";
const BODY_LOCK_SNAPSHOT_ATTR = "data-body-scroll-lock-snapshot";
const BODY_LOCK_ACTIVE_ATTR = "data-body-scroll-lock-active";

const ACTIVE_OVERLAY_SELECTOR = [
  "[data-mobile-blocking-overlay]",
  "[data-mobile-search-dock]",
  '[data-slot="dialog-overlay"]',
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-overlay"]',
  '[data-slot="sheet-content"]',
].join(",");

function clearLockMetadata() {
  document.body.removeAttribute(BODY_LOCK_ACTIVE_ATTR);
  document.body.removeAttribute(BODY_LOCK_SNAPSHOT_ATTR);
  document.body.removeAttribute(BODY_LOCK_COUNT_ATTR);
}

function isVisibleOverlay(element: Element) {
  const style = window.getComputedStyle(element);

  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0 && style.pointerEvents !== "none";
}

function hasVisibleOverlay() {
  return Array.from(document.querySelectorAll(ACTIVE_OVERLAY_SELECTOR)).some(
    isVisibleOverlay,
  );
}

function clearStaleGlobalStyles() {
  const { body, documentElement } = document;
  const fallbackScrollY = Math.abs(Number.parseInt(body.style.top, 10));
  const shouldRestoreScroll =
    body.style.position === "fixed" && Number.isFinite(fallbackScrollY);

  if (body.style.position === "fixed") {
    body.style.position = "";
  }

  if (body.style.top) {
    body.style.top = "";
  }

  if (body.style.left === "0px" || body.style.left === "0") {
    body.style.left = "";
  }

  if (body.style.right === "0px" || body.style.right === "0") {
    body.style.right = "";
  }

  if (body.style.width === "100%") {
    body.style.width = "";
  }

  if (body.style.overflow === "hidden") {
    body.style.overflow = "";
  }

  if (body.style.overscrollBehavior === "none") {
    body.style.overscrollBehavior = "";
  }

  if (body.style.touchAction === "none") {
    body.style.touchAction = "";
  }

  if (body.style.pointerEvents === "none") {
    body.style.pointerEvents = "";
  }

  if (documentElement.style.overscrollBehavior === "none") {
    documentElement.style.overscrollBehavior = "";
  }

  clearLockMetadata();

  if (shouldRestoreScroll && fallbackScrollY > 0) {
    window.scrollTo(0, fallbackScrollY);
  }
}

export function cleanupStaleGlobalInteractionState() {
  if (typeof window === "undefined") {
    return;
  }

  if (!document.querySelector("[data-mobile-search-dock]")) {
    document.body.classList.remove("mobile-search-active");
  }

  if (hasVisibleOverlay()) {
    return;
  }

  clearStaleGlobalStyles();
}

export function useGlobalInteractionCleanup(active: boolean) {
  useEffect(() => {
    if (active) {
      return;
    }

    const timeout = window.setTimeout(cleanupStaleGlobalInteractionState, 220);

    return () => window.clearTimeout(timeout);
  }, [active]);

  useEffect(() => {
    return () => {
      window.setTimeout(cleanupStaleGlobalInteractionState, 220);
    };
  }, []);
}
