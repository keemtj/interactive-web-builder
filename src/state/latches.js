/**
 * 래치 스토어 — once 모드 전용.
 * once 는 라이프사이클 중 유일하게 상태(경로 의존성)를 가진다.
 * 나머지 모드는 전부 progress 의 순수 함수다.
 */
import { useSyncExternalStore } from 'react';

let latches = {};
const listeners = new Set();

export function setLatch(id, v = true) {
  if (latches[id] === v) return;
  latches = { ...latches, [id]: v };
  listeners.forEach((l) => l());
}

export function resetLatches() {
  if (Object.keys(latches).length === 0) return;
  latches = {};
  listeners.forEach((l) => l());
}

function getSnapshot() {
  return latches;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLatches() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
