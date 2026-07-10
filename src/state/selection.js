/**
 * 선택 스토어 — 크로스 패널 선택 상태.
 * 타임라인 바 클릭 / 맵 마커 / 인스펙터 행이 같은 선택을 공유한다.
 */
import { useSyncExternalStore } from 'react';

let selected = null;
const listeners = new Set();

export function select(id) {
  if (selected === id) return;
  selected = id;
  listeners.forEach((l) => l());
}
export function getSelected() {
  return selected;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useSelection() {
  return useSyncExternalStore(subscribe, getSelected, getSelected);
}
