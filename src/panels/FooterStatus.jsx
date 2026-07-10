import { usePlayhead } from '../state/playhead.js';
import { resetLatches, useLatches } from '../state/latches.js';
import { pagePos } from '../conti/path.js';

/** 푸터 상태바 — p 구독을 App 에서 분리해 앱 전체 리렌더를 막는다 */
export default function FooterStatus({ PATH, TOTAL, conti }) {
  const p = usePlayhead();
  const latches = useLatches();
  const pos = pagePos(PATH, p);
  const isPin = pos.seg.isPin;

  const latchTws = conti.tweens.filter((t) => t.state === 'latch');
  const setCount = latchTws.filter((t) => latches[t.id]).length;

  return (
    <footer className="app-footer">
      <span>
        scroll <span className="v">{Math.round(p * TOTAL)}vh</span> / {TOTAL}vh
      </span>
      <span>
        {isPin ? (
          <span className="p">
            {pos.seg.label} · local {pos.local.toFixed(2)}
          </span>
        ) : (
          <>
            seg <span className="v">{pos.seg.label}</span>
          </>
        )}
      </span>
      <span>
        latch:{' '}
        {setCount > 0 ? (
          <span className="v">{setCount}/{latchTws.length} SET</span>
        ) : (
          <span className="p">unset</span>
        )}
      </span>
      <button onClick={resetLatches}>RESET LATCH</button>
      <span style={{ marginLeft: 'auto' }}>
        휠 = 스크럽 · 방향키 = ±0.002 · ⌘Z = 되돌리기
      </span>
    </footer>
  );
}
