import { useState } from 'react';
import { clamp, pagePos } from '../conti/path.js';
import {
  BODIES, BODY_GLYPH, LOOPS, PROP_DEFS, dirName, fixPair,
  makeElement, makeTween, remapConti,
} from '../conti/lifecycle.js';
import { commitConti } from '../state/history.js';
import { getP } from '../state/playhead.js';
import { select, useSelection } from '../state/selection.js';
import {
  Row, NumberField, TextField, ColorField, SelectField,
} from '../ui/Field.jsx';

const DIRS = [
  { value: '0,1', label: '↓ 아래' },
  { value: '1,0', label: '→ 오른쪽' },
  { value: '-1,0', label: '← 왼쪽' },
  { value: '0,-1', label: '↑ 위' },
  { value: '1,1', label: '↘ 대각' },
  { value: '-1,1', label: '↙ 대각' },
  { value: '1,-1', label: '↗ 대각' },
  { value: '-1,-1', label: '↖ 대각' },
];

/** [x,y] 페이지 좌표 편집 */
function PointPair({ label, val, onCh }) {
  return (
    <Row label={label}>
      <NumberField value={val[0]} min={-3} max={14} step={0.05}
        onChange={(v) => onCh([v, val[1]])} />
      <NumberField value={val[1]} min={-3} max={14} step={0.05}
        onChange={(v) => onCh([val[0], v])} />
    </Row>
  );
}

/**
 * 인스펙터 v0.3 — 덩어리(엘리먼트)와 거동(트윈)의 정밀 편집면.
 * 트윈 1개 = gsap.to() 호출 1개. 모든 편집은 undo 히스토리에 쌓인다.
 */
export default function Inspector({ conti, PATH, TOTAL }) {
  const selId = useSelection();
  const [addBody, setAddBody] = useState('box');
  const [jsonOpen, setJsonOpen] = useState(false);
  const sel = conti.elements.find((e) => e.id === selId);
  const selSeg = conti.segments.find((s) => s.id === selId);
  const selTws = sel ? conti.tweens.filter((t) => t.target === sel.id) : [];

  /* ---- 엘리먼트 ---- */
  const patchEl = (id, patch) =>
    commitConti((c) => ({
      ...c,
      elements: c.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const addEl = () => {
    const pos = pagePos(PATH, getP());
    commitConti((c) => {
      const el = makeElement(addBody, c, [
        +(pos.x + 0.5).toFixed(2),
        +(pos.y + 0.45).toFixed(2),
      ]);
      select(el.id);
      return {
        ...c,
        elements: [...c.elements, el],
        tweens: [...c.tweens, makeTween({ ...c, elements: [...c.elements, el] }, el.id, getP())],
      };
    });
  };
  const removeEl = (id) => {
    if (selId === id) select(null);
    commitConti((c) => ({
      ...c,
      elements: c.elements.filter((e) => e.id !== id),
      tweens: c.tweens.filter((t) => t.target !== id),
    }));
  };

  /* ---- 트윈 ---- */
  const patchTw = (id, patch) =>
    commitConti((c) => ({
      ...c,
      tweens: c.tweens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  const patchTwProp = (id, key, value) =>
    commitConti((c) => ({
      ...c,
      tweens: c.tweens.map((t) => {
        if (t.id !== id) return t;
        const props = { ...t.props };
        if (value === null) delete props[key];
        else props[key] = value;
        return { ...t, props };
      }),
    }));
  const addTween = () =>
    commitConti((c) => ({
      ...c,
      tweens: [...c.tweens, makeTween(c, sel.id, getP())],
    }));
  const removeTween = (id) =>
    commitConti((c) => ({ ...c, tweens: c.tweens.filter((t) => t.id !== id) }));

  /* ---- 세그먼트 (v0.2 와 동일 — remapConti 로 창 보존) ---- */
  const patchSeg = (id, patch) =>
    commitConti((c) =>
      remapConti(c, c.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    );
  const removeSeg = (id) =>
    commitConti((c) => remapConti(c, c.segments.filter((s) => s.id !== id)));
  const toggleType = (id) =>
    commitConti((c) =>
      remapConti(
        c,
        c.segments.map((s) => {
          if (s.id !== id) return s;
          if (s.type === 'pin')
            return { ...s, type: 'move', label: dirName(s.dx, s.dy), color: '#4a9be6' };
          return { ...s, type: 'pin', label: 'PIN', color: '#f06088' };
        })
      )
    );

  return (
    <div className="inspector">
      <h4>SEGMENTS — 여정 · 총 {TOTAL}vh</h4>
      {conti.segments.map((s) => (
        <Row
          key={s.id}
          className={`seg${selId === s.id ? ' sel' : ''}`}
          onClick={() => select(selId === s.id ? null : s.id)}
        >
          <span className="chip" style={{ background: s.color }} />
          <label>{s.label}</label>
          <NumberField
            value={s.len} min={50} max={600} step={10} unit="vh"
            onChange={(v) => patchSeg(s.id, { len: clamp(Math.round(v / 10) * 10, 50, 600) })}
          />
          <button
            className="mini"
            title={s.type === 'pin' ? '이동 세그먼트로 되돌리기' : '핀으로 변환'}
            onClick={(ev) => { ev.stopPropagation(); toggleType(s.id); }}
          >
            {s.type === 'pin' ? '→MOVE' : '⊙PIN'}
          </button>
          <button
            className="x" title="세그먼트 삭제"
            disabled={conti.segments.length <= 1}
            onClick={(ev) => { ev.stopPropagation(); removeSeg(s.id); }}
          >
            ×
          </button>
        </Row>
      ))}
      {selSeg && (
        <div className="el-editor">
          <Row label="label">
            <TextField value={selSeg.label} onChange={(v) => patchSeg(selSeg.id, { label: v })} />
          </Row>
          {selSeg.type === 'move' && (
            <Row label="방향">
              <SelectField
                value={`${selSeg.dx},${selSeg.dy}`} options={DIRS}
                onChange={(v) => {
                  const [dx, dy] = v.split(',').map(Number);
                  patchSeg(selSeg.id, { dx, dy });
                }}
              />
            </Row>
          )}
          <Row label="color">
            <ColorField value={selSeg.color} onChange={(v) => patchSeg(selSeg.id, { color: v })} />
          </Row>
        </div>
      )}

      <h4>ELEMENTS — 덩어리 (생명은 트윈이 분다)</h4>
      {conti.elements.map((el) => (
        <Row
          key={el.id}
          className={`el${selId === el.id ? ' sel' : ''}`}
          onClick={() => select(selId === el.id ? null : el.id)}
        >
          <span className="chip" style={{ background: el.color }} />
          <label>
            {BODY_GLYPH[el.body]} {el.label || el.id}
          </label>
          <span className="win">
            tween ×{conti.tweens.filter((t) => t.target === el.id).length}
          </span>
          <button
            className="x" title="엘리먼트 삭제 (트윈 포함)"
            onClick={(ev) => { ev.stopPropagation(); removeEl(el.id); }}
          >
            ×
          </button>
        </Row>
      ))}
      <Row className="actions">
        <SelectField
          value={addBody}
          options={BODIES.map((b) => ({ value: b, label: `${BODY_GLYPH[b]} ${b}` }))}
          onChange={setAddBody}
        />
        <button onClick={addEl}>+ ELEMENT (현재 위치에)</button>
      </Row>

      {sel && (
        <div className="el-editor">
          <Row label="선택">
            <span className="val">{sel.id} · {sel.body}</span>
          </Row>
          <Row label="label">
            <TextField value={sel.label || ''} onChange={(v) => patchEl(sel.id, { label: v })} />
          </Row>
          <Row label="color">
            <ColorField value={sel.color} onChange={(v) => patchEl(sel.id, { color: v })} />
          </Row>
          <Row label="배치">
            <SelectField
              value={sel.place === 'frame' ? 'frame' : 'page'}
              options={[
                { value: 'page', label: '페이지 좌표' },
                { value: 'frame', label: '프레임 고정' },
              ]}
              onChange={(v) => {
                if (v === 'frame') patchEl(sel.id, { place: 'frame' });
                else {
                  const pos = pagePos(PATH, getP());
                  patchEl(sel.id, { place: [+(pos.x + 0.5).toFixed(2), +(pos.y + 0.45).toFixed(2)] });
                }
              }}
            />
          </Row>
          {Array.isArray(sel.place) && (
            <PointPair label="place" val={sel.place} onCh={(v) => patchEl(sel.id, { place: v })} />
          )}
          {sel.body === 'line' && sel.to && (
            <PointPair label="to" val={sel.to} onCh={(v) => patchEl(sel.id, { to: v })} />
          )}
          {(sel.body === 'text' || sel.body === 'band') && (
            <Row label="text">
              <TextField value={sel.text || ''} onChange={(v) => patchEl(sel.id, { text: v })} />
            </Row>
          )}

          <h4>TWEENS — gsap.to() ×{selTws.length}</h4>
          {selTws.map((tw) => {
            const usedProps = Object.keys(tw.props || {});
            const addable = Object.keys(PROP_DEFS).filter((k) => !usedProps.includes(k));
            return (
              <div className="tw-editor" key={tw.id}>
                <Row>
                  <span className="val">{tw.id}</span>
                  <SelectField
                    value={tw.clock}
                    options={[
                      { value: 'scroll', label: '↕ scroll' },
                      { value: 'time', label: '∞ time' },
                    ]}
                    onChange={(v) => patchTw(tw.id, { clock: v })}
                  />
                  <SelectField
                    value={tw.state}
                    options={[
                      { value: 'pure', label: 'scrub' },
                      { value: 'latch', label: '⤓ once' },
                    ]}
                    onChange={(v) => patchTw(tw.id, { state: v })}
                  />
                  <button
                    className="x" title="트윈 삭제"
                    onClick={() => removeTween(tw.id)}
                  >
                    ×
                  </button>
                </Row>
                <Row label="window">
                  <NumberField value={+tw.window[0].toFixed(3)}
                    onChange={(v) => patchTw(tw.id, { window: fixPair([v, tw.window[1]]) })} />
                  <NumberField value={+tw.window[1].toFixed(3)}
                    onChange={(v) => patchTw(tw.id, { window: fixPair([tw.window[0], v]) })} />
                </Row>
                <Row label="ease">
                  <SelectField
                    value={tw.ease || 'smooth'}
                    options={[
                      { value: 'smooth', label: 'smooth' },
                      { value: 'linear', label: 'linear' },
                    ]}
                    onChange={(v) => patchTw(tw.id, { ease: v })}
                  />
                </Row>
                {usedProps.map((k) => {
                  const def = PROP_DEFS[k];
                  const v = tw.props[k];
                  return (
                    <Row label={k} key={k}>
                      {k === 'loop' ? (
                        <SelectField
                          value={v}
                          options={LOOPS.map((l) => ({ value: l, label: `∞ ${l}` }))}
                          onChange={(nv) => patchTwProp(tw.id, k, nv)}
                        />
                      ) : def.pair ? (
                        <>
                          <NumberField value={v[0]} min={def.min} max={def.max} step={def.step}
                            onChange={(nv) => patchTwProp(tw.id, k, [nv, v[1]])} />
                          <NumberField value={v[1]} min={def.min} max={def.max} step={def.step}
                            onChange={(nv) => patchTwProp(tw.id, k, [v[0], nv])} />
                        </>
                      ) : (
                        <NumberField value={v} min={def.min} max={def.max} step={def.step}
                          onChange={(nv) => patchTwProp(tw.id, k, nv)} />
                      )}
                      <button className="x" title="prop 제거"
                        onClick={() => patchTwProp(tw.id, k, null)}>
                        ×
                      </button>
                    </Row>
                  );
                })}
                {addable.length > 0 && (
                  <Row label="+ prop">
                    <SelectField
                      value=""
                      options={[
                        { value: '', label: '선택…' },
                        ...addable.map((k) => ({ value: k, label: k })),
                      ]}
                      onChange={(k) => {
                        if (k) patchTwProp(tw.id, k, PROP_DEFS[k].def);
                      }}
                    />
                  </Row>
                )}
              </div>
            );
          })}
          <Row className="actions">
            <button onClick={addTween}>+ TWEEN</button>
            <span className="hint">트윈 = gsap.to() 1회 — 한 덩어리에 몇 개든</span>
          </Row>
        </div>
      )}

      <details onToggle={(e) => setJsonOpen(e.currentTarget.open)}>
        <summary>CONTI JSON (live)</summary>
        {jsonOpen && <pre>{JSON.stringify(conti, null, 2)}</pre>}
      </details>
    </div>
  );
}
