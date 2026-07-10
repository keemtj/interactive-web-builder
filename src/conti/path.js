/**
 * 읽기 경로의 코어 — 콘티 segments 로부터 모든 것이 파생된다.
 */

/** segments → 누적 폴리라인 (t0/t1: 스크롤 공간, x/y: 페이지 공간 화면단위)
    핀은 type 필드가 결정한다 — dx/dy 는 보존되지만 이동에 쓰이지 않는다 (스키마 v0.2) */
export function buildPath(segments) {
  const TOTAL = segments.reduce((a, s) => a + s.len, 0);
  let acc = 0, cx = 0, cy = 0;
  const PATH = segments.map((s) => {
    const isPin = s.type === 'pin';
    const seg = {
      ...s,
      t0: acc / TOTAL,
      t1: (acc + s.len) / TOTAL,
      x0: cx, y0: cy,
      x1: cx + (isPin ? 0 : s.dx), y1: cy + (isPin ? 0 : s.dy),
      isPin,
    };
    acc += s.len;
    if (!isPin) { cx += s.dx; cy += s.dy; }
    return seg;
  });
  return { PATH, TOTAL };
}

/** 스크롤 진행도 t → 페이지 2D 위치 {x, y, seg, local} */
export function pagePos(PATH, t) {
  const last = PATH[PATH.length - 1];
  for (const s of PATH) {
    if (t <= s.t1 || s === last) {
      if (t < s.t0) continue;
      const k = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
      return {
        x: s.x0 + (s.x1 - s.x0) * k,
        y: s.y0 + (s.y1 - s.y0) * k,
        seg: s, local: k,
      };
    }
  }
  return { x: last.x1, y: last.y1, seg: last, local: 1 };
}

/** 여정이 지나는 셀 목록 (중복 제거, 첫 등장 세그먼트의 라벨/색 채택) */
export function uniqueCells(PATH) {
  const seen = new Map();
  PATH.forEach((s) => {
    [[s.x0, s.y0], [s.x1, s.y1]].forEach(([x, y]) => {
      const key = `${x},${y}`;
      if (!seen.has(key)) seen.set(key, { x, y, label: s.label, color: s.color });
    });
  });
  return [...seen.values()];
}

/** 셀 표시용 메타 — 섹션 문자, 라벨(핀이면 체류량), 고스트 텍스트.
    고스트는 세그먼트 라벨의 이름부 — 랜딩 구성(HERO/FEATURES/CTA…)이 화면에 크게 보인다 */
export function decorateCells(PATH) {
  const cells = uniqueCells(PATH);
  const name = (label) => (label || '').replace(/^\d+\s*/, '');
  return cells.map((c, i) => {
    const pin = PATH.find((s) => s.isPin && s.x0 === c.x && s.y0 === c.y);
    const letter = String.fromCharCode(65 + i);
    return {
      ...c,
      letter,
      eb: `SECTION ${letter} — ${pin ? `${name(pin.label)} · PIN +${pin.len}vh` : c.label}`,
      ghost: name(pin ? pin.label : c.label),
    };
  });
}

/* ---------- 창 함수 유틸 ---------- */
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
export const smooth = (t) => t * t * (3 - 2 * t);
/** 전체 t 를 [a,b] 창의 0~1 로 */
export const win = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
/** a~b 에서 등장, c~d 에서 퇴장 */
export const inout = (t, a, b, c, d) =>
  Math.min(smooth(win(t, a, b)), 1 - smooth(win(t, c, d)));
