/**
 * 콘티 스토어 — 쓰기 경로의 본체.
 * undo 단위는 "제스처": 드래그는 begin → preview* → end 가 한 스텝,
 * 버튼/입력은 commit 이 한 스텝. localStorage 자동저장(디바운스) 포함.
 */
import { useSyncExternalStore } from 'react';
import { defaultConti } from '../conti/defaultConti.js';
import { migrate02to03 } from '../conti/lifecycle.js';

const LS_KEY = 'previz.conti.v0.3';
const LEGACY_KEYS = ['previz.conti.v0.2', 'previz.conti.v0.1'];

/** v0.1 → v0.2 (핀 = type 필드) */
function migrate01to02(parsed) {
  return {
    ...parsed,
    meta: { ...parsed.meta, schema: '0.2' },
    segments: parsed.segments.map((s) => {
      const wasPin = s.dx === 0 && s.dy === 0;
      return {
        ...s,
        type: wasPin ? 'pin' : 'move',
        dx: wasPin ? 0 : s.dx,
        dy: wasPin ? 1 : s.dy,
      };
    }),
  };
}

function migrate(parsed) {
  if (!parsed?.meta?.schema) return null;
  let c = parsed;
  if (c.meta.schema === '0.1') c = migrate01to02(c);
  if (c.meta.schema === '0.2') c = migrate02to03(c);
  return c.meta.schema === '0.3' ? c : null;
}

function load() {
  try {
    for (const key of [LS_KEY, ...LEGACY_KEYS]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const migrated = migrate(JSON.parse(raw));
      if (migrated) return migrated;
    }
  } catch {}
  return migrate02to03(defaultConti);
}

let current = load();
let past = [];
let future = [];
let editSnapshot = null;
const listeners = new Set();
let saveTimer = null;

function notify() {
  listeners.forEach((l) => l());
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(current));
    } catch {}
  }, 300);
}

export function getConti() {
  return current;
}

/** 원샷 편집 (버튼·수치 입력). next: 값 또는 updater */
export function commitConti(next) {
  const v = typeof next === 'function' ? next(current) : next;
  if (v === current) return;
  past.push(current);
  future = [];
  current = v;
  notify();
  save();
}

/* ---- 제스처 편집: begin → preview* → end | cancel ---- */
export function beginEdit() {
  editSnapshot = current;
}
export function previewConti(next) {
  current = typeof next === 'function' ? next(current) : next;
  notify();
}
export function endEdit() {
  if (editSnapshot && editSnapshot !== current) {
    past.push(editSnapshot);
    future = [];
    save();
  }
  editSnapshot = null;
}
export function cancelEdit() {
  if (editSnapshot && editSnapshot !== current) {
    current = editSnapshot;
    notify();
  }
  editSnapshot = null;
}

/* ---- 히스토리 ---- */
export function undo() {
  if (!past.length) return;
  future.push(current);
  current = past.pop();
  notify();
  save();
}
export function redo() {
  if (!future.length) return;
  past.push(current);
  current = future.pop();
  notify();
  save();
}
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

export function resetConti() {
  commitConti(defaultConti);
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useConti() {
  return useSyncExternalStore(subscribe, getConti, getConti);
}
