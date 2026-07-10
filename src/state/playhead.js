/**
 * 플레이헤드 스토어 — "GSAP은 값을 만들고, 씬은 값을 소비한다"의 React 판.
 * 단일 RAF 루프가 targetP → p 관성 lerp 를 수행하고 구독자에게 알린다.
 */
import { useSyncExternalStore } from 'react';

const store = { targetP: 0, p: 0 };
const listeners = new Set();
let raf = null;

const LERP = 0.12;

function loop() {
  const prev = store.p;
  store.p += (store.targetP - store.p) * LERP;
  if (Math.abs(store.targetP - store.p) < 0.00004) store.p = store.targetP;
  if (store.p !== prev) listeners.forEach((l) => l());
  raf = requestAnimationFrame(loop);
}

export function startPlayhead() {
  if (raf == null) raf = requestAnimationFrame(loop);
}

export function setTarget(t) {
  store.targetP = Math.min(Math.max(t, 0), 1);
}

export function nudgeTarget(d) {
  setTarget(store.targetP + d);
}

export function getP() {
  return store.p;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 프레임마다 갱신되는 p 를 구독하는 훅 */
export function usePlayhead() {
  return useSyncExternalStore(subscribe, getP, getP);
}
