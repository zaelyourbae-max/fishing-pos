"use client";

import { useEffect } from "react";

type ScrollLockSnapshot = {
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyTouchAction: string;
  htmlOverscrollBehavior: string;
  scrollY: number;
};

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

function readLockCount() {
  const count = Number.parseInt(
    document.body.getAttribute(BODY_LOCK_COUNT_ATTR) ?? "0",
    10,
  );

  return Number.isFinite(count) && count > 0 ? count : 0;
}

function writeLockCount(count: number) {
  if (count > 0) {
    document.body.setAttribute(BODY_LOCK_COUNT_ATTR, String(count));
    return;
  }

  document.body.removeAttribute(BODY_LOCK_COUNT_ATTR);
}

function readSnapshot(): ScrollLockSnapshot | null {
  const rawSnapshot = document.body.getAttribute(BODY_LOCK_SNAPSHOT_ATTR);

  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as ScrollLockSnapshot;
  } catch {
    return null;
  }
}

function clearLockMetadata() {
  document.body.removeAttribute(BODY_LOCK_ACTIVE_ATTR);
  document.body.removeAttribute(BODY_LOCK_SNAPSHOT_ATTR);
  document.body.removeAttribute(BODY_LOCK_COUNT_ATTR);
}

function restoreSnapshot(snapshot: ScrollLockSnapshot | null) {
  const { body, documentElement } = document;
  const fallbackScrollY = Math.abs(Number.parseInt(body.style.top, 10));
  const scrollY =
    snapshot?.scrollY ?? (Number.isFinite(fallbackScrollY) ? fallbackScrollY : 0);

  body.style.position = snapshot?.bodyPosition ?? "";
  body.style.top = snapshot?.bodyTop ?? "";
  body.style.left = snapshot?.bodyLeft ?? "";
  body.style.right = snapshot?.bodyRight ?? "";
  body.style.width = snapshot?.bodyWidth ?? "";
  body.style.overflow = snapshot?.bodyOverflow ?? "";
  body.style.overscrollBehavior = snapshot?.bodyOverscrollBehavior ?? "";
  body.style.touchAction = snapshot?.bodyTouchAction ?? "";
  documentElement.style.overscrollBehavior =
    snapshot?.htmlOverscrollBehavior ?? "";

  clearLockMetadata();

  if (scrollY > 0) {
    window.scrollTo(0, scrollY);
  }
}

function applyBodyScrollLock() {
  const { body, documentElement } = document;
  const snapshot: ScrollLockSnapshot = {
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    bodyTouchAction: body.style.touchAction,
    htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
    scrollY: window.scrollY,
  };

  body.setAttribute(BODY_LOCK_SNAPSHOT_ATTR, JSON.stringify(snapshot));
  body.setAttribute(BODY_LOCK_ACTIVE_ATTR, "true");
  body.style.position = "fixed";
  body.style.top = `-${snapshot.scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.touchAction = "none";
  documentElement.style.overscrollBehavior = "none";
}

export function cleanupStaleGlobalInteractionState() {
  if (typeof window === "undefined") {
    return;
  }

  const hasActiveOverlay = Boolean(
    document.querySelector(ACTIVE_OVERLAY_SELECTOR),
  );

  if (!document.querySelector("[data-mobile-search-dock]")) {
    document.body.classList.remove("mobile-search-active");
  }

  if (hasActiveOverlay) {
    return;
  }

  if (readLockCount() === 0 && document.body.hasAttribute(BODY_LOCK_ACTIVE_ATTR)) {
    restoreSnapshot(readSnapshot());
  }

  if (document.body.style.pointerEvents === "none") {
    document.body.style.pointerEvents = "";
  }
}

export function lockBodyScroll() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const nextCount = readLockCount() + 1;

  if (nextCount === 1) {
    applyBodyScrollLock();
  }

  writeLockCount(nextCount);

  return () => {
    const nextUnlockCount = Math.max(readLockCount() - 1, 0);

    writeLockCount(nextUnlockCount);

    if (nextUnlockCount === 0) {
      restoreSnapshot(readSnapshot());
      window.setTimeout(cleanupStaleGlobalInteractionState, 220);
    }
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      window.setTimeout(cleanupStaleGlobalInteractionState, 220);
      return;
    }

    return lockBodyScroll();
  }, [active]);
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
