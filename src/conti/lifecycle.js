/**
 * 스키마 v0.3 — GSAP 를 GUI 로 (PRD D1 개정).
 *
 * elements[] = 덩어리(타겟). body(box|text|line|orb|band) + place + color.
 *              스스로는 움직이지 않는다 — DOM 노드에 해당.
 * tweens[]   = 거동. gsap.to() 호출 1개에 해당:
 *              { target, clock(scroll|time), state(pure|latch), window:[a,b],
 *                ease, props:{ x,y,opacity,scale,rotate,draw,stagger,loop } }
 *              한 엘리먼트에 트윈 N개가 자유롭게 붙는다.
 *
 * GSAP 대응: clock scroll = ScrollTrigger scrub / clock time = repeat:-1 루프
 *            state latch = toggleActions 'play none none none'
 *            props 페어 [from,to] = gsap.fromTo()
 */
import { buildPath, clamp, pagePos, smooth, win } from './path.js';

export const BODIES = ['box', 'text', 'line', 'orb', 'band'];
export const BODY_GLYPH = { box: '▢', text: 'T', line: '╱', orb: '◯', band: '▬' };
export const LOOPS = ['float', 'pulse', 'marquee', 'spin', 'gradient'];
export const PROP_DEFS = {
  x:       { pair: true, def: [0, 0.5], min: -4, max: 4, step: 0.05 },
  y:       { pair: true, def: [0, 0.5], min: -4, max: 4, step: 0.05 },
  opacity: { pair: true, def: [0, 1], min: 0, max: 1, step: 0.05 },
  scale:   { pair: true, def: [0.6, 1], min: 0, max: 4, step: 0.05 },
  rotate:  { pair: true, def: [0, 90], min: -720, max: 720, step: 5 },
  draw:    { pair: true, def: [0, 1], min: 0, max: 1, step: 0.05 },
  stagger: { pair: false, def: 0.03, min: 0, max: 0.2, step: 0.004 },
  loop:    { pair: false, def: 'float' },
};
export const EASES = { linear: (t) => t, smooth };
const lerp = (a, b, k) => a + (b - a) * k;

/** [a,b] 창의 순서·최소폭 보장 */
export function fixPair([a, b]) {
  if (b < a) [a, b] = [b, a];
  if (b - a < 0.01) b = Math.min(1, a + 0.01);
  return [a, b];
}

/** time 트윈의 존재 게이트 — 창 경계가 0/1이면 해당 페이드 생략 */
function gateK(w, p) {
  const fin = w[0] <= 0 ? 1 : win(p, w[0], w[0] + 0.02);
  const fout = w[1] >= 1 ? 1 : 1 - win(p, w[1] - 0.02, w[1]);
  return Math.min(fin, fout);
}

/**
 * 엘리먼트 합성 — 그 엘리먼트를 타겟으로 하는 모든 트윈을 적용한 결과.
 * x/y 는 가산, opacity/scale 은 승산, rotate 는 가산. (GSAP additive 감성)
 */
export function composeElement(tws, p, latches) {
  const out = {
    x: 0, y: 0, opacity: 1, scale: 1, rotate: 0,
    draw: null, loop: null,
    stagger: null, staggerRaw: 0, staggerLatched: false,
  };
  for (const tw of tws) {
    const P = tw.props || {};
    if (tw.clock === 'time') {
      out.opacity *= gateK(tw.window, p);
      if (P.loop) out.loop = P.loop;
      continue;
    }
    const raw = win(p, tw.window[0], tw.window[1]);
    const latched = tw.state === 'latch' && !!latches[tw.id];
    const k = latched ? 1 : (EASES[tw.ease] || smooth)(raw);
    if (P.x) out.x += lerp(P.x[0], P.x[1], k);
    if (P.y) out.y += lerp(P.y[0], P.y[1], k);
    if (P.opacity) out.opacity *= lerp(P.opacity[0], P.opacity[1], k);
    if (P.scale) out.scale *= lerp(P.scale[0], P.scale[1], k);
    if (P.rotate) out.rotate += lerp(P.rotate[0], P.rotate[1], k);
    if (P.draw) out.draw = lerp(P.draw[0], P.draw[1], k);
    if (P.stagger != null) {
      out.stagger = P.stagger;
      out.staggerRaw = latched ? 1 : raw;
      out.staggerLatched = latched;
    }
  }
  return out;
}

/** 트윈 표시 구간 (스크롤 공간) — 타임라인 블록의 편집 단위 */
export const tweenWindow = (tw) => tw.window;

/** 드래그 스냅 — 세그먼트 경계 + 타 트윈 창 경계 */
export function snapT(t, conti, PATH, excludeId, eps = 0.012) {
  let best = t, bd = eps;
  const cand = [];
  PATH.forEach((s) => cand.push(s.t0, s.t1));
  conti.tweens.forEach((tw) => {
    if (tw.id === excludeId) return;
    cand.push(tw.window[0], tw.window[1]);
  });
  cand.forEach((c) => {
    const d = Math.abs(c - t);
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}

/**
 * 세그먼트 편집(len·삽입·삭제·순서) 시 트윈 창을 세그먼트-로컬 보존 재매핑.
 * 사건은 비율이 아니라 장면에 붙는다. 엘리먼트 위치(place)는 불변.
 */
export function remapConti(orig, newSegments) {
  const { PATH: oldPATH } = buildPath(orig.segments);
  const { PATH: newPATH } = buildPath(newSegments);
  const last = oldPATH[oldPATH.length - 1];

  const locate = (t) => {
    for (const s of oldPATH) {
      if (t <= s.t1 || s === last) {
        if (t < s.t0) continue;
        return { id: s.id, k: (t - s.t0) / (s.t1 - s.t0 || 1) };
      }
    }
    return { id: last.id, k: 1 };
  };
  const mapT = (t) => {
    const loc = locate(t);
    const s = newPATH.find((x) => x.id === loc.id);
    return clamp(s ? s.t0 + loc.k * (s.t1 - s.t0) : t, 0, 1);
  };

  return {
    ...orig,
    segments: newSegments,
    tweens: orig.tweens.map((tw) => ({
      ...tw,
      window: fixPair(tw.window.map(mapT)),
    })),
  };
}

/** 창 위치의 카메라 지점 — 단일 트윈 엘리먼트의 위치 자동 추종용 */
export function pointAtWindow(PATH, a, b) {
  const pos = pagePos(PATH, (a + b) / 2);
  return [+(pos.x + 0.5).toFixed(2), +(pos.y + 0.45).toFixed(2)];
}

/* ---------- 팩토리 ---------- */

const PALETTE = ['#4a9be6', '#17b89e', '#e09a2f', '#f06088', '#9b7ff0'];

export function makeElement(body, conti, point) {
  const id = uid(conti.elements, 'el');
  return {
    id,
    label: id.toUpperCase(),
    body,
    place: body === 'band' ? [0.5, point[1]] : point,
    ...(body === 'line' ? { to: [point[0] + 0.7, point[1] - 0.1] } : null),
    ...(body === 'text' || body === 'band' ? { text: 'TEXT' } : null),
    color: PALETTE[conti.elements.length % PALETTE.length],
  };
}

export function makeTween(conti, targetId, p) {
  const a = clamp(p, 0, 0.85);
  return {
    id: uid(conti.tweens, 'tw'),
    target: targetId,
    clock: 'scroll',
    state: 'pure',
    ease: 'smooth',
    window: [a, clamp(a + 0.12, 0, 1)],
    props: { opacity: [0, 1] },
  };
}

function uid(list, prefix) {
  let n = 1;
  while (list.some((x) => x.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/* ---------- 세그먼트 파생 ---------- */
export function nextSegId(segments) {
  let n = 1;
  while (segments.some((s) => s.id === `s${n}`)) n++;
  return `s${n}`;
}
export function dirName(dx, dy) {
  if (dx === 0 && dy === 0) return 'PIN';
  if (dx === 0) return dy > 0 ? 'DOWN' : 'UP';
  if (dy === 0) return dx > 0 ? 'RIGHT' : 'LEFT';
  return 'DIAG';
}
export function segColor(dx, dy) {
  if (dx === 0 && dy === 0) return '#f06088';
  if (dx !== 0 && dy !== 0) return '#9b7ff0';
  return dx !== 0 ? '#17b89e' : '#4a9be6';
}

/* ---------- v0.2 → v0.3 마이그레이션 (구 mode 5종을 덩어리+트윈으로 분해) ---------- */
export function migrate02to03(c) {
  const elements = [];
  const tweens = [];
  const pt = (cell, dy = 0.45) => [cell[0] + 0.5, cell[1] + dy];
  let tn = 1;
  const twid = () => `tw${tn++}`;

  for (const e of c.elements || []) {
    const base = { id: e.id, label: e.lane || e.id.toUpperCase(), color: e.color };
    switch (e.mode) {
      case 'scrub': {
        const travel = e.from && e.to;
        elements.push({
          ...base, body: 'box',
          place: travel ? [...e.from] : pt(e.cell, 0.42),
        });
        if (travel)
          tweens.push({
            id: twid(), target: e.id, clock: 'scroll', state: 'pure', ease: e.ease,
            window: [e.in[0], e.out[1]],
            props: { x: [0, e.to[0] - e.from[0]], y: [0, e.to[1] - e.from[1]] },
          });
        tweens.push({
          id: twid(), target: e.id, clock: 'scroll', state: 'pure', ease: e.ease,
          window: [...e.in],
          props: travel
            ? { opacity: [0, 1] }
            : { opacity: [0, 1], x: [0.46, 0], rotate: [10, 0] },
        });
        tweens.push({
          id: twid(), target: e.id, clock: 'scroll', state: 'pure', ease: e.ease,
          window: [...e.out],
          props: travel
            ? { opacity: [1, 0] }
            : { opacity: [1, 0], x: [0, -0.52], rotate: [0, -12] },
        });
        break;
      }
      case 'once':
        elements.push({ ...base, body: 'text', place: pt(e.cell, 0.46), text: e.text });
        tweens.push({
          id: twid(), target: e.id, clock: 'scroll', state: 'latch', ease: e.ease,
          window: [...e.range],
          props: { opacity: [0, 1], stagger: e.stagger ?? 0.03 },
        });
        break;
      case 'draw': {
        const travel = e.from && e.to;
        elements.push({
          ...base, body: 'line',
          place: travel ? [...e.from] : [e.cell[0] + 0.15, e.cell[1] + 0.5],
          to: travel ? [...e.to] : [e.cell[0] + 0.85, e.cell[1] + 0.38],
        });
        tweens.push({
          id: twid(), target: e.id, clock: 'scroll', state: 'pure', ease: e.ease,
          window: [...e.range], props: { draw: [0, 1] },
        });
        break;
      }
      case 'sticky':
        elements.push({ ...base, body: 'box', place: 'frame' });
        tweens.push({
          id: twid(), target: e.id, clock: 'scroll', state: 'pure', ease: e.ease,
          window: [e.range[0], e.range[0] + (e.fade ?? 0.03)], props: { opacity: [0, 1] },
        });
        tweens.push({
          id: twid(), target: e.id, clock: 'scroll', state: 'pure', ease: e.ease,
          window: [e.range[1] - (e.fade ?? 0.03), e.range[1]], props: { opacity: [1, 0] },
        });
        break;
      case 'anim': {
        const band = e.variant === 'marquee' || e.variant === 'gradient';
        elements.push({
          ...base,
          body: band ? 'band' : 'orb',
          place: band ? [0.5, e.cell[1] + 0.75] : pt(e.cell, 0.32),
          ...(e.text ? { text: e.text } : null),
        });
        tweens.push({
          id: twid(), target: e.id, clock: 'time', state: 'pure', ease: e.ease,
          window: [...e.range], props: { loop: e.variant || 'float' },
        });
        break;
      }
    }
  }
  return {
    ...c,
    meta: { ...c.meta, schema: '0.3' },
    elements,
    tweens,
  };
}
