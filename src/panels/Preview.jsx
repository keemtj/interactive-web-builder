import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { decorateCells, pagePos, smooth, win } from '../conti/path.js';
import { BODY_GLYPH, composeElement } from '../conti/lifecycle.js';
import { usePlayhead } from '../state/playhead.js';
import { setLatch, useLatches } from '../state/latches.js';
import Panel from '../ui/Panel.jsx';
import SegmentedControl from '../ui/SegmentedControl.jsx';

/** 디바이스 프리셋 — 프레임은 실제 CSS px 로 잡히고 스테이지에 맞춰 축소된다 */
const DEVICES = [
  { id: 'desktop', label: 'DESKTOP', w: 1440, h: 900 },
  { id: 'laptop',  label: 'LAPTOP',  w: 1280, h: 800 },
  { id: 'tablet',  label: 'TABLET',  w: 768,  h: 1024 },
  { id: 'mobile',  label: 'MOBILE',  w: 390,  h: 844 },
];

/** 셀 크롬(배경·섹션 라벨·고스트) — p 와 무관한 정적 레이어 */
const CellLayer = memo(function CellLayer({ cells, W, H }) {
  return cells.map((c) => (
    <div
      key={`${c.x},${c.y}`}
      className="pv-cell"
      style={{ width: W, height: H, left: c.x * W, top: c.y * H }}
    >
      <span className="eb">{c.eb}</span>
      {c.ghost && <span className="ghost">{c.ghost}</span>}
    </div>
  ));
});

/**
 * 덩어리 렌더 — body 프리미티브에 합성된 트윈(composeElement)을 적용.
 * 엘리먼트는 스스로 움직이지 않는다. 모든 생명은 트윈에서 온다.
 */
function ElementNode({ el, tws, p, W, H }) {
  const latches = useLatches();
  const c = composeElement(tws, p, latches);

  /* frame 배치 — 프레임에 고정 (스크롤에 따라 x 로 밀릴 수도 있다: 트윈 조합) */
  if (el.place === 'frame') {
    return (
      <div
        className="pv-frameel"
        style={{
          opacity: c.opacity, color: el.color, borderColor: el.color,
          transform: `translateX(${c.x * W}px)`,
        }}
      >
        ⊙ {el.label}
      </div>
    );
  }

  if (el.body === 'line') {
    const x1 = (el.place[0] + c.x) * W, y1 = (el.place[1] + c.y) * H;
    const x2 = (el.to[0] + c.x) * W, y2 = (el.to[1] + c.y) * H;
    const minX = Math.min(x1, x2) - 20, minY = Math.min(y1, y2) - 20;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const k = c.draw ?? 1;
    return (
      <svg
        className="pv-lineel"
        style={{
          left: minX, top: minY,
          width: Math.abs(x2 - x1) + 40, height: Math.abs(y2 - y1) + 40,
          opacity: c.opacity,
        }}
      >
        <line
          x1={x1 - minX} y1={y1 - minY} x2={x2 - minX} y2={y2 - minY}
          stroke={el.color} strokeWidth={2} strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={len * (1 - k)}
        />
      </svg>
    );
  }

  if (el.body === 'band') {
    return (
      <div
        className={`pv-bandel${c.loop ? ` loop-${c.loop}` : ''}`}
        style={{ top: (el.place[1] + c.y) * H - 24, opacity: c.opacity, color: el.color }}
      >
        {c.loop === 'gradient' ? (
          <span className="pv-gradfill" />
        ) : (
          <span className="pv-mq">
            <span>{(el.text || 'MARQUEE — ').repeat(6)}</span>
          </span>
        )}
      </div>
    );
  }

  const style = {
    left: (el.place[0] + c.x) * W,
    top: (el.place[1] + c.y) * H,
    opacity: c.opacity,
    transform: `translate(-50%, -50%) scale(${c.scale}) rotate(${c.rotate}deg)`,
    color: el.color,
  };

  if (el.body === 'text') {
    const letters = [...(el.text || 'TEXT')];
    return (
      <div className="pv-textel" style={style}>
        {c.stagger != null
          ? letters.map((ch, li) => {
              const a = li * c.stagger;
              const kk = smooth(win(c.staggerRaw, a, a + 0.5));
              const v = c.staggerLatched ? 1 : kk;
              return (
                <span
                  key={li}
                  style={{
                    opacity: v,
                    transform: `translate(${(1 - v) * 22}cqw, ${(1 - v) * 10}cqh)`,
                  }}
                >
                  {ch}
                </span>
              );
            })
          : el.text || 'TEXT'}
      </div>
    );
  }

  if (el.body === 'orb') {
    return (
      <div className={`pv-orbel${c.loop ? ` loop-${c.loop}` : ''}`} style={style}>
        {c.loop === 'pulse' && <span className="pv-ring" />}
        <span className="pv-orbcore" />
      </div>
    );
  }

  /* box */
  return (
    <div
      className={`pv-boxel${c.loop === 'spin' ? ' loop-spin' : ''}`}
      style={style}
    >
      {el.label || el.id}
    </div>
  );
}

export default function Preview({ PATH, TOTAL, conti }) {
  const p = usePlayhead();
  const stageRef = useRef(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [devId, setDevId] = useState('desktop');
  const [liveOpen, setLiveOpen] = useState(true);
  const latches = useLatches();

  useLayoutEffect(() => {
    const el = stageRef.current;
    const ro = new ResizeObserver(() =>
      setStage({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* latch 트윈이 완주하면 래치 — once 만 상태를 가진다는 원칙의 v0.3 판 */
  useEffect(() => {
    for (const tw of conti.tweens) {
      if (tw.state === 'latch' && win(p, tw.window[0], tw.window[1]) >= 1)
        setLatch(tw.id);
    }
  }, [conti.tweens, p]);

  const dev = DEVICES.find((d) => d.id === devId);
  const W = dev.w, H = dev.h;
  const M = 28;
  const scale = stage.w
    ? Math.max(0.05, Math.min((stage.w - M) / W, (stage.h - M) / H, 1))
    : 0.2;

  const cells = useMemo(() => decorateCells(PATH), [PATH]);
  const byTarget = useMemo(() => {
    const m = {};
    conti.tweens.forEach((tw) => {
      (m[tw.target] ??= []).push(tw);
    });
    return m;
  }, [conti.tweens]);

  const pos = pagePos(PATH, p);
  const isPin = pos.seg.isPin;

  return (
    <Panel
      title="PREVIEW"
      tooltip="휠 = 스크럽 · 방향키 ±0.002"
      className="preview-col"
      toolbar={
        <span className="pv-devices">
          <SegmentedControl
            options={DEVICES.map((d) => ({ value: d.id, label: d.label }))}
            value={devId}
            onChange={setDevId}
          />
          <span className="pv-dim">
            {W}×{H} · {Math.round(scale * 100)}%
          </span>
        </span>
      }
    >
      <div className="pv-stage" ref={stageRef}>
        <div className="pv-frame-fit" style={{ width: W * scale, height: H * scale }}>
          <div
            className="preview-frame"
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          >
            <div
              className="pv-world"
              style={{ transform: `translate(${-pos.x * W}px, ${-pos.y * H}px)` }}
            >
              <CellLayer cells={cells} W={W} H={H} />
              {conti.elements
                .filter((el) => el.place !== 'frame')
                .map((el) => (
                  <ElementNode
                    key={el.id}
                    el={el}
                    tws={byTarget[el.id] || []}
                    p={p} W={W} H={H}
                  />
                ))}
            </div>

            {/* frame 배치 엘리먼트 — 페이지가 아닌 프레임에 산다 */}
            {conti.elements
              .filter((el) => el.place === 'frame')
              .map((el) => (
                <ElementNode
                  key={el.id}
                  el={el}
                  tws={byTarget[el.id] || []}
                  p={p} W={W} H={H}
                />
              ))}
          </div>
        </div>

        <div
          className={`pv-live${liveOpen ? '' : ' min'}`}
          title="클릭 = 접기/펼치기"
          onClick={() => setLiveOpen((v) => !v)}
        >
          {!liveOpen ? (
            'ⓘ'
          ) : isPin ? (
            <>
              <span className="p">PIN</span> local{' '}
              <span className="p">{pos.local.toFixed(2)}</span> — 스크롤이
              트윈에게만 흐르는 중
            </>
          ) : (
            <>
              page {'{'}x:<span className="v">{pos.x.toFixed(2)}</span>, y:
              <span className="v">{pos.y.toFixed(2)}</span>
              {'}'} · seg <span className="v">{pos.seg.label}</span>
            </>
          )}
          {liveOpen && (
            <>
              <br />
              {conti.elements.map((el, i) => {
                const c = composeElement(byTarget[el.id] || [], p, latches);
                return (
                  <span key={el.id}>
                    {i > 0 && ' · '}
                    {el.label || el.id} {BODY_GLYPH[el.body]}{' '}
                    <span className="v">{c.opacity.toFixed(2)}</span>
                  </span>
                );
              })}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
