import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { buildPath, clamp } from '../conti/path.js';
import {
  BODY_GLYPH, fixPair, pointAtWindow, remapConti, snapT,
} from '../conti/lifecycle.js';
import { setTarget, usePlayhead } from '../state/playhead.js';
import { useLatches } from '../state/latches.js';
import { beginEdit, previewConti, endEdit } from '../state/history.js';
import { select, useSelection } from '../state/selection.js';
import Panel from '../ui/Panel.jsx';

/** 플레이헤드 라인 — p 를 구독하는 유일한 동적 요소 */
function Playhead() {
  const p = usePlayhead();
  return <div className="tl-playhead" style={{ top: `${p * 100}%` }} />;
}

const lanesRect = (ev) =>
  ev.currentTarget.closest('.tl-lanes').getBoundingClientRect();

/** 핀 HOLD 블록 — 몸통 드래그 = 위치(순서) 이동, 하단 핸들 = 체류(len) 편집 */
function CamHold({ s, conti }) {
  const st = useRef(null);

  const onLenDown = (ev) => {
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    let accBefore = 0;
    for (const g of conti.segments) {
      if (g.id === s.id) break;
      accBefore += g.len;
    }
    const others = conti.segments.reduce(
      (a, g) => (g.id === s.id ? a : a + g.len), 0
    );
    st.current = { kind: 'len', rect: lanesRect(ev), accBefore, others, orig: conti };
    beginEdit();
  };
  const onOrderDown = (ev) => {
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    st.current = { kind: 'order', rect: lanesRect(ev), orig: conti };
    beginEdit();
  };
  const onMove = (ev) => {
    ev.stopPropagation();
    const d = st.current;
    if (!d || !(ev.buttons & 1)) return;
    const f = clamp((ev.clientY - d.rect.top) / d.rect.height, 0.02, 0.97);
    if (d.kind === 'len') {
      let len = (f * d.others - d.accBefore) / (1 - f);
      len = clamp(Math.round(len / 10) * 10, 50, 600);
      const segs = d.orig.segments.map((g) =>
        g.id === s.id ? { ...g, len } : g
      );
      previewConti(() => remapConti(d.orig, segs));
    } else {
      const pin = d.orig.segments.find((g) => g.id === s.id);
      const others = d.orig.segments.filter((g) => g.id !== s.id);
      let best = null;
      for (let i = 0; i <= others.length; i++) {
        const segs = [...others.slice(0, i), pin, ...others.slice(i)];
        const ps = buildPath(segs).PATH.find((x) => x.id === s.id);
        const dist = Math.abs((ps.t0 + ps.t1) / 2 - f);
        if (!best || dist < best.dist) best = { dist, segs };
      }
      previewConti(() => remapConti(d.orig, best.segs));
    }
  };
  const onUp = () => {
    st.current = null;
    endEdit();
  };

  return (
    <div
      className="tl-camhold"
      title="몸통 드래그 = 위치 이동"
      onPointerDown={onOrderDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <i>HOLD +{s.len}vh</i>
      <div
        className="tl-holdhandle"
        title="드래그 = 체류 편집"
        onPointerDown={onLenDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
    </div>
  );
}

/** 트윈 블록 — 몸통 드래그 = 창 이동, 상/하단 핸들 = 리사이즈 (스냅 포함).
    단일 트윈 엘리먼트는 창을 옮기면 위치가 카메라를 따라온다 */
function TweenBar({ tw, el, PATH, conti, isSel }) {
  const [a, b] = tw.window;
  const st = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onDown = (ev, kind) => {
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const rect = lanesRect(ev);
    st.current = { kind, rect, t0: (ev.clientY - rect.top) / rect.height, a, b };
    select(el.id);
    setDragging(true);
    beginEdit();
  };
  const onMove = (ev) => {
    ev.stopPropagation();
    const d = st.current;
    if (!d || !(ev.buttons & 1)) return;
    const t = (ev.clientY - d.rect.top) / d.rect.height;
    let na = d.a, nb = d.b;
    if (d.kind === 'move') {
      let dt = t - d.t0;
      const sa = snapT(d.a + dt, conti, PATH, tw.id);
      const sb = snapT(d.b + dt, conti, PATH, tw.id);
      dt =
        Math.abs(sa - (d.a + dt)) <= Math.abs(sb - (d.b + dt))
          ? sa - d.a
          : sb - d.b;
      dt = clamp(dt, -d.a, 1 - d.b);
      na = d.a + dt;
      nb = d.b + dt;
    } else if (d.kind === 'top') {
      na = clamp(snapT(t, conti, PATH, tw.id), 0, d.b - 0.02);
    } else {
      nb = clamp(snapT(t, conti, PATH, tw.id), d.a + 0.02, 1);
    }
    d.la = na; d.lb = nb;
    previewConti((c) => {
      const scrollTws = c.tweens.filter(
        (x) => x.target === el.id && x.clock === 'scroll'
      );
      const follow =
        scrollTws.length === 1 && Array.isArray(el.place)
          ? pointAtWindow(PATH, na, nb)
          : null;
      return {
        ...c,
        tweens: c.tweens.map((x) =>
          x.id === tw.id ? { ...x, window: fixPair([na, nb]) } : x
        ),
        elements: follow
          ? c.elements.map((x) => {
              if (x.id !== el.id) return x;
              const dxy = [follow[0] - x.place[0], follow[1] - x.place[1]];
              return {
                ...x,
                place: follow,
                ...(x.to ? { to: [x.to[0] + dxy[0], x.to[1] + dxy[1]] } : null),
              };
            })
          : c.elements,
      };
    });
  };
  const onUp = () => {
    const d = st.current;
    st.current = null;
    setDragging(false);
    endEdit();
    /* 놓는 순간 창 중앙으로 스크럽 — 결과를 프리뷰로 확인 */
    if (d?.la != null) setTarget(clamp((d.la + d.lb) / 2, 0, 1));
  };

  return (
    <div
      className={`tl-rangebar${isSel ? ' sel' : ''}${dragging ? ' dragging' : ''}`}
      style={{
        top: `${a * 100}%`,
        height: `${(b - a) * 100}%`,
        color: el.color,
        background: `${el.color}26`,
        border: `1px ${tw.clock === 'time' ? 'dashed' : 'solid'} ${el.color}`,
      }}
      onPointerDown={(ev) => onDown(ev, 'move')}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      {tw.clock === 'time' && <span className="tl-inf">∞</span>}
      <div className="tl-hedge top" onPointerDown={(ev) => onDown(ev, 'top')} />
      <div className="tl-hedge bot" onPointerDown={(ev) => onDown(ev, 'bot')} />
    </div>
  );
}

/** 레인 콘텐츠 — 레인 = 엘리먼트, 블록 = 그 엘리먼트의 트윈들 */
const Lanes = memo(function Lanes({ PATH, conti, onFocusSeg }) {
  const latches = useLatches();
  const selId = useSelection();

  return (
    <>
      {PATH.filter((s) => s.isPin).map((s) => (
        <div
          key={`band${s.id}`}
          className="tl-secband"
          style={{ top: `${s.t0 * 100}%`, height: `${(s.t1 - s.t0) * 100}%` }}
        />
      ))}

      {PATH.map((s, i) => (
        <div key={`b${i}`} className="tl-secline" style={{ top: `${s.t0 * 100}%` }}>
          <span>{s.label}</span>
        </div>
      ))}

      {/* CAM lane */}
      <div className="tl-lane">
        {PATH.map((s) => (
          <div
            key={s.id}
            className="tl-seghit"
            style={{ top: `${s.t0 * 100}%`, height: `${(s.t1 - s.t0) * 100}%` }}
            onDoubleClick={() => onFocusSeg(s.t0, s.t1)}
            title="더블클릭 = 이 구간 포커스"
          >
            {s.isPin ? (
              <CamHold s={s} conti={conti} />
            ) : (
              <div className="tl-camseg" />
            )}
          </div>
        ))}
      </div>

      {/* element lanes — 트윈 N개가 한 레인에 산다 */}
      {conti.elements.map((el) => {
        const tws = conti.tweens.filter((tw) => tw.target === el.id);
        return (
          <div className="tl-lane" key={el.id}>
            {tws.map((tw) => (
              <TweenBar
                key={tw.id}
                tw={tw} el={el}
                PATH={PATH} conti={conti}
                isSel={selId === el.id}
              />
            ))}
            {/* stagger 사선 팬 */}
            {tws
              .filter((tw) => tw.props?.stagger != null && el.text)
              .map((tw) =>
                [...el.text].map((_, li) => {
                  const [a, b] = tw.window;
                  const t = a + li * tw.props.stagger * (b - a);
                  const left = 28 + (li * 44) / Math.max(1, el.text.length - 1);
                  return (
                    <div
                      key={`${tw.id}f${li}`}
                      className="tl-kf"
                      style={{ top: `${t * 100}%`, left: `${left}%`, background: el.color }}
                    />
                  );
                })
              )}
            {/* latch 도트 */}
            {tws
              .filter((tw) => tw.state === 'latch')
              .map((tw) => (
                <div
                  key={`${tw.id}l`}
                  className={`tl-latch${latches[tw.id] ? ' on' : ''}`}
                  style={{ top: `${tw.window[1] * 100}%` }}
                />
              ))}
          </div>
        );
      })}
    </>
  );
});

export default function Timeline({ PATH, TOTAL, conti }) {
  const ref = useRef(null);
  const scrollRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  const scrub = (ev) => {
    const r = ref.current.getBoundingClientRect();
    setTarget((ev.clientY - r.top) / r.height);
  };
  const onPointerDown = (ev) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    scrub(ev);
  };
  const onPointerMove = (ev) => {
    if (ev.buttons & 1) scrub(ev);
  };

  /* ⌥+휠 = 포인터 지점 고정 줌 (PRD D9) */
  useEffect(() => {
    const sc = scrollRef.current;
    const onWheel = (e) => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = ref.current.getBoundingClientRect();
      const tAt = (e.clientY - rect.top) / rect.height;
      setZoom((z) => {
        const nz = clamp(z * (e.deltaY < 0 ? 1.25 : 0.8), 1, 8);
        requestAnimationFrame(() => {
          sc.scrollTop =
            tAt * nz * sc.clientHeight -
            (e.clientY - sc.getBoundingClientRect().top);
        });
        return nz;
      });
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  const focusSeg = useCallback((t0, t1) => {
    const span = Math.max(t1 - t0, 0.005);
    const nz = clamp(0.9 / span, 1, 8);
    setZoom(nz);
    requestAnimationFrame(() => {
      const sc = scrollRef.current;
      sc.scrollTop = (t0 - span * 0.06) * nz * sc.clientHeight;
    });
  }, []);

  return (
    <Panel
      title="TIMELINE"
      tooltip="블록 드래그 = 편집 · 빈 곳 드래그 = 스크럽 · ⌥휠 = 줌 · 세그먼트 더블클릭 = 포커스"
      className="timeline-col"
      resizable={{ initial: 220, min: 160, max: 420 }}
      toolbar={
        <span className="tl-zoomctl">
          <button onClick={() => setZoom((z) => clamp(z / 1.5, 1, 8))}>−</button>
          <span className="pv-dim">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => clamp(z * 1.5, 1, 8))}>+</button>
          <button onClick={() => setZoom(1)}>FIT</button>
        </span>
      }
    >
      {/* 레인 헤더 — 레인 = 엘리먼트 */}
      <div className="tl-lanehead">
        <span className="tag">CAM</span>
        {conti.elements.map((el) => (
          <span key={el.id} className="tag">
            {el.label || el.id}
            <br />
            {BODY_GLYPH[el.body]}
          </span>
        ))}
      </div>

      <div className={`tl-scroll${zoom === 1 ? ' fit' : ''}`} ref={scrollRef}>
        <div
          className="tl-lanes"
          ref={ref}
          style={{ height: `${zoom * 100}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <Playhead />
          <Lanes PATH={PATH} conti={conti} onFocusSeg={focusSeg} />
        </div>
      </div>
    </Panel>
  );
}
