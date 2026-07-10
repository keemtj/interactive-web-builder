import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { clamp, decorateCells, pagePos } from '../conti/path.js';
import { dirName, nextSegId, remapConti, segColor } from '../conti/lifecycle.js';
import { setTarget, usePlayhead } from '../state/playhead.js';
import { beginEdit, previewConti, endEdit, commitConti } from '../state/history.js';
import { select, useSelection } from '../state/selection.js';

const U = 60;   // 셀 한 변 (svg 단위)
const PAD = 26;

/** 스크린 좌표 → svg viewBox 좌표 */
function svgPoint(svg, ev) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const sc = Math.min(r.width / vb.width, r.height / vb.height);
  return {
    mx: (ev.clientX - r.left - (r.width - vb.width * sc) / 2) / sc + vb.x,
    my: (ev.clientY - r.top - (r.height - vb.height * sc) / 2) / sc + vb.y,
  };
}

/** 정적 지형 + 엘리먼트 마커 — 마커 드래그 = place/to 자유 배치 (0.05 스냅) */
const MapStatic = memo(function MapStatic({ PATH, cells, pathD, conti }) {
  const dragRef = useRef(null); // { id, field: 'place' | 'to' }
  const selId = useSelection();

  const onPtDown = (ev, id, field) => {
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    dragRef.current = { id, field };
    select(id);
    beginEdit();
  };
  const onPtMove = (ev) => {
    ev.stopPropagation();
    const d = dragRef.current;
    if (!d || !(ev.buttons & 1)) return;
    const { mx, my } = svgPoint(ev.currentTarget.ownerSVGElement, ev);
    const pt = [Math.round((mx / U) * 20) / 20, Math.round((my / U) * 20) / 20];
    previewConti((c) => ({
      ...c,
      elements: c.elements.map((x) =>
        x.id === d.id ? { ...x, [d.field]: pt } : x
      ),
    }));
  };
  const onPtUp = () => {
    dragRef.current = null;
    endEdit();
  };

  return (
    <>
      {cells.map((c) => (
        <g key={`${c.x},${c.y}`}>
          <rect
            x={c.x * U + 2} y={c.y * U + 2}
            width={U - 4} height={U - 4} rx={3}
            fill="none" stroke="var(--map-line)"
          />
          <text
            x={c.x * U + 6} y={c.y * U + 10}
            fontSize="4.5" fill="var(--faint)" letterSpacing="0.08em"
          >
            SEC {c.letter}
          </text>
        </g>
      ))}
      <path d={pathD} fill="none" stroke="var(--map-path)" strokeDasharray="4 4" />
      {PATH.filter((s) => s.isPin).map((s, i) => (
        <g key={i}>
          {[9, 14, 19].map((r0) => (
            <circle
              key={r0}
              cx={(s.x0 + 0.5) * U} cy={(s.y0 + 0.5) * U} r={r0}
              fill="none" stroke="var(--pin)"
              strokeOpacity={0.5} strokeDasharray="3 3"
            />
          ))}
          <text
            x={(s.x0 + 0.5) * U} y={(s.y0 + 0.5) * U - 26}
            textAnchor="middle" fontSize="7" fill="var(--pin)"
          >
            PIN +{s.len}vh
          </text>
        </g>
      ))}
      {/* 엘리먼트 마커 — place (line 은 to 끝점까지) */}
      {conti.elements
        .filter((el) => Array.isArray(el.place))
        .map((el) => (
          <g key={el.id}>
            {el.to && (
              <line
                x1={el.place[0] * U} y1={el.place[1] * U}
                x2={el.to[0] * U} y2={el.to[1] * U}
                stroke={el.color} strokeOpacity={0.5} strokeDasharray="2 3"
              />
            )}
            <circle
              className="umap-marker"
              cx={el.place[0] * U} cy={el.place[1] * U}
              r={selId === el.id ? 5 : 4}
              fill={el.color}
              stroke={selId === el.id ? 'var(--amber)' : 'none'}
              strokeWidth={1.5}
              onPointerDown={(ev) => onPtDown(ev, el.id, 'place')}
              onPointerMove={onPtMove}
              onPointerUp={onPtUp}
            />
            {el.to && (
              <circle
                className="umap-marker"
                cx={el.to[0] * U} cy={el.to[1] * U}
                r={4}
                fill="var(--panel)" stroke={el.color} strokeWidth={1.5}
                onPointerDown={(ev) => onPtDown(ev, el.id, 'to')}
                onPointerMove={onPtMove}
                onPointerUp={onPtUp}
              />
            )}
          </g>
        ))}
    </>
  );
});

/** 삽입 핸들 — 드래그 중 고스트만, 드롭 = 단일 커밋 (PRD D4-8) */
function InsertHandle({ insertAt, cx, cy, variant }) {
  const st = useRef(null);
  const ghostRef = useRef(null);
  const [ghost, setGhost] = useState(null);

  const onDown = (ev) => {
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    st.current = { ox: cx, oy: cy };
  };
  const onMove = (ev) => {
    ev.stopPropagation();
    const d = st.current;
    if (!d || !(ev.buttons & 1)) return;
    const { mx, my } = svgPoint(ev.currentTarget.ownerSVGElement, ev);
    const vx = mx - d.ox, vy = my - d.oy;
    const dist = Math.hypot(vx, vy);
    if (dist < U * 0.35) {
      ghostRef.current = null;
      setGhost(null);
      return;
    }
    const oct = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const [dx, dy] = dirs[((oct % 8) + 8) % 8];
    const len = clamp(Math.round(((dist / U) * 100) / 25) * 25, 50, 400);
    ghostRef.current = { dx, dy, len };
    setGhost(ghostRef.current);
  };
  const onUp = () => {
    const g = ghostRef.current;
    st.current = null;
    ghostRef.current = null;
    setGhost(null);
    if (!g) return;
    commitConti((c) => {
      const seg = {
        id: nextSegId(c.segments),
        type: 'move',
        len: g.len, dx: g.dx, dy: g.dy,
        label: `${String(insertAt + 1).padStart(2, '0')} ${dirName(g.dx, g.dy)}`,
        color: segColor(g.dx, g.dy),
      };
      return remapConti(c, [
        ...c.segments.slice(0, insertAt),
        seg,
        ...c.segments.slice(insertAt),
      ]);
    });
  };

  const handle =
    variant === 'end' ? (
      <g className="umap-end" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <circle className="umap-enddot" cx={cx} cy={cy} r={7} />
        <text x={cx} y={cy + 2.8} textAnchor="middle" fontSize="8">+</text>
      </g>
    ) : (
      <circle
        className="umap-node"
        cx={cx} cy={cy} r={3.5}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <title>드래그 = 이 지점에 세그먼트 삽입</title>
      </circle>
    );

  return (
    <>
      {handle}
      {ghost && (
        <g className="umap-ghost" pointerEvents="none">
          <line x1={cx} y1={cy} x2={cx + ghost.dx * U} y2={cy + ghost.dy * U} />
          <circle cx={cx + ghost.dx * U} cy={cy + ghost.dy * U} r={5} />
          <text x={cx + (ghost.dx * U) / 2 + 9} y={cy + (ghost.dy * U) / 2 - 7}>
            +{ghost.len}vh
          </text>
        </g>
      )}
    </>
  );
}

/** 여정 중간 노드들 — 세그먼트 경계마다 삽입 포인트 */
function NodeHandles({ PATH }) {
  const last = PATH[PATH.length - 1];
  const seen = new Set([`${last.x1},${last.y1}`]);
  const nodes = [];
  PATH.forEach((s, i) => {
    const key = `${s.x0},${s.y0}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({ insertAt: i, x: s.x0, y: s.y0 });
  });
  return nodes.map((n) => (
    <InsertHandle
      key={n.insertAt}
      insertAt={n.insertAt}
      cx={(n.x + 0.5) * U}
      cy={(n.y + 0.5) * U}
      variant="node"
    />
  ));
}

/** 뷰포트 박스 — p 를 구독하는 유일한 동적 요소 */
function ViewportBox({ PATH }) {
  const p = usePlayhead();
  const pos = pagePos(PATH, p);
  return (
    <rect
      x={pos.x * U + 2} y={pos.y * U + 2}
      width={U - 4} height={U - 4} rx={3}
      fill="rgba(255,180,84,.08)"
      stroke={pos.seg.isPin ? 'var(--pin)' : 'var(--amber)'}
      strokeWidth={1.5}
      pointerEvents="none"
    />
  );
}

export default function UnfoldedMap({ PATH, conti }) {
  const svgRef = useRef(null);

  const { viewBox: targetVB, cells } = useMemo(() => {
    const xs = PATH.flatMap((s) => [s.x0, s.x1]);
    const ys = PATH.flatMap((s) => [s.y0, s.y1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 1;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 1;
    return {
      viewBox: `${minX * U - PAD} ${minY * U - PAD} ${
        (maxX - minX) * U + PAD * 2
      } ${(maxY - minY) * U + PAD * 2}`,
      cells: decorateCells(PATH),
    };
  }, [PATH]);

  /* 여정이 바뀌면 지도는 새 경계로 부드럽게 리핏 */
  const [vb, setVb] = useState(targetVB);
  const vbRef = useRef(targetVB);
  useEffect(() => {
    if (vbRef.current === targetVB) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      vbRef.current = targetVB;
      setVb(targetVB);
      return;
    }
    const from = vbRef.current.split(' ').map(Number);
    const to = targetVB.split(' ').map(Number);
    const t0 = performance.now();
    const D = 280;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    let raf;
    const step = (now) => {
      const k = Math.min((now - t0) / D, 1);
      const e = easeOut(k);
      const cur = from.map((f, i) => f + (to[i] - f) * e).join(' ');
      vbRef.current = cur;
      setVb(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetVB]);

  const pathD = useMemo(
    () =>
      PATH.map(
        (s, i) =>
          (i === 0 ? `M ${(s.x0 + 0.5) * U} ${(s.y0 + 0.5) * U} ` : '') +
          `L ${(s.x1 + 0.5) * U} ${(s.y1 + 0.5) * U}`
      ).join(' '),
    [PATH]
  );

  const scrub = (ev) => {
    const svg = svgRef.current;
    const { mx, my } = svgPoint(svg, ev);
    let best = { d: Infinity, t: 0 };
    PATH.forEach((s) => {
      const ax = (s.x0 + 0.5) * U, ay = (s.y0 + 0.5) * U;
      const bx = (s.x1 + 0.5) * U, by = (s.y1 + 0.5) * U;
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      let k = L2 === 0 ? 0 : ((mx - ax) * (bx - ax) + (my - ay) * (by - ay)) / L2;
      k = Math.min(Math.max(k, 0), 1);
      const d = (mx - (ax + (bx - ax) * k)) ** 2 + (my - (ay + (by - ay) * k)) ** 2;
      if (d < best.d) best = { d, t: s.t0 + (s.t1 - s.t0) * k };
    });
    setTarget(best.t);
  };
  const onPointerDown = (ev) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    scrub(ev);
  };
  const onPointerMove = (ev) => {
    if (ev.buttons & 1) scrub(ev);
  };

  return (
    <div className="umap" onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
      <svg ref={svgRef} viewBox={vb} preserveAspectRatio="xMidYMid meet">
        <MapStatic PATH={PATH} cells={cells} pathD={pathD} conti={conti} />
        <NodeHandles PATH={PATH} />
        <InsertHandle
          insertAt={conti.segments.length}
          cx={(PATH[PATH.length - 1].x1 + 0.5) * U}
          cy={(PATH[PATH.length - 1].y1 + 0.5) * U}
          variant="end"
        />
        <ViewportBox PATH={PATH} />
      </svg>
    </div>
  );
}
