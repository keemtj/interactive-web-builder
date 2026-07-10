import { useEffect, useMemo, useState } from 'react';
import { buildPath } from './conti/path.js';
import Panel from './ui/Panel.jsx';
import { startPlayhead, nudgeTarget } from './state/playhead.js';
import {
  useConti, undo, redo, canUndo, canRedo, resetConti, commitConti,
} from './state/history.js';
import { resetLatches } from './state/latches.js';
import { PRESETS } from './conti/presets.js';
import Preview from './panels/Preview.jsx';
import Timeline from './panels/Timeline.jsx';
import UnfoldedMap from './panels/UnfoldedMap.jsx';
import Inspector from './panels/Inspector.jsx';
import FooterStatus from './panels/FooterStatus.jsx';

const THEME_KEY = 'previz.theme';

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || 'light'
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  return [theme, setTheme];
}

/** 우측 열 — 전개도(오버뷰) + 인스펙터 */
function SidePanel({ PATH, conti, TOTAL }) {
  return (
    <Panel
      title="UNFOLDED MAP"
      tooltip="경로 드래그 = 스크럽 · 노드/끝점 드래그 = 세그먼트 삽입 · 마커 드래그 = 셀 이동"
      className="map-col"
      resizable={{ initial: 300, min: 230, max: 480 }}
    >
      <UnfoldedMap PATH={PATH} conti={conti} />
      <Inspector conti={conti} PATH={PATH} TOTAL={TOTAL} />
    </Panel>
  );
}

const inField = (t) =>
  t?.closest?.('input, select, textarea, [contenteditable]');

export default function App() {
  /* 콘티 JSON = 단일 진실 원천 (history 스토어가 소유) */
  const conti = useConti();
  const [theme, setTheme] = useTheme();
  const { PATH, TOTAL } = useMemo(
    () => buildPath(conti.segments),
    [conti.segments]
  );

  /* 전역 입력: 휠 스크럽 + 키보드 (정밀 스텝 · undo/redo)
     p 는 여기서 구독하지 않는다 — 각 패널이 리프에서 직접 구독. */
  useEffect(() => {
    startPlayhead();
    const onWheel = (e) => {
      if (e.altKey) return; // ⌥휠은 로컬 용도(타임라인 줌)에 양보
      if (e.target.closest?.('.inspector')) return; // 인스펙터는 네이티브 스크롤
      e.preventDefault();
      nudgeTarget(e.deltaY * 0.0005);
    };
    const onKey = (e) => {
      if (inField(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      const step = e.shiftKey ? 0.0005 : 0.002;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nudgeTarget(step);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nudgeTarget(-step);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">
          PREVIZ v0.1 — <b>인터랙션 디렉팅 빌더</b> · 콘티 JSON 단일 진실 원천
        </span>
        <span className="toolbar">
          <select
            value=""
            title="프리셋 콘티 불러오기 (undo 가능)"
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (p) {
                commitConti(structuredClone(p.conti));
                resetLatches();
              }
            }}
          >
            <option value="" disabled>
              PRESET…
            </option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button disabled={!canUndo()} onClick={undo} title="되돌리기 (⌘Z)">
            ↺ UNDO
          </button>
          <button disabled={!canRedo()} onClick={redo} title="다시하기 (⇧⌘Z)">
            ↻ REDO
          </button>
          <button
            onClick={() => {
              resetConti();
              resetLatches();
            }}
            title="콘티를 기본값으로 (undo 가능)"
          >
            RESET CONTI
          </button>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '☾ DARK' : '☀ LIGHT'}
          </button>
        </span>
      </header>

      <main className="app-main">
        <Preview PATH={PATH} TOTAL={TOTAL} conti={conti} />
        <Timeline PATH={PATH} TOTAL={TOTAL} conti={conti} />
        <SidePanel PATH={PATH} conti={conti} TOTAL={TOTAL} />
      </main>

      <FooterStatus PATH={PATH} TOTAL={TOTAL} conti={conti} />
    </div>
  );
}
