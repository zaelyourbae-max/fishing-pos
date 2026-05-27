"use client";

import { useEffect } from "react";

type BodyScrollSnapshot = {
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

const activeLocks = new Set<symbol>();
let snapshot: BodyScrollSnapshot | null = null;

function applyBodyScrollLock() {
  const { body, documentElement } = document;
  const scrollY = window.scrollY;

  snapshot = {
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    bodyTouchAction: body.style.touchAction,
    htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
    scrollY,
  };

  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.touchAction = "none";
  documentElement.style.overscrollBehavior = "none";
}

function restoreBodyScrollLock() {
  if (!snapshot) {
    return;
  }

  const { body, documentElement } = document;
  const scrollY = snapshot.scrollY;

  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.left = snapshot.bodyLeft;
  body.style.right = snapshot.bodyRight;
  body.style.width = snapshot.bodyWidth;
  body.style.overflow = snapshot.bodyOverflow;
  body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
  body.style.touchAction = snapshot.bodyTouchAction;
  documentElement.style.overscrollBehavior = snapshot.htmlOverscrollBehavior;

  snapshot = null;
  window.scrollTo(0, scrollY);
}

export function lockBodyScroll() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const lock = Symbol("body-scroll-lock");

  activeLocks.add(lock);

  if (activeLocks.size === 1) {
    applyBodyScrollLock();
  }

  return () => {
    activeLocks.delete(lock);

    if (activeLocks.size === 0) {
      restoreBodyScrollLock();
    }
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    return lockBodyScroll();
  }, [active]);
}
