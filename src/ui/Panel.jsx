import { useState } from 'react';
import { clamp } from '../conti/path.js';

/**
 * 패널 셸 — 타이틀·툴바 슬롯·선택적 좌측 리사이즈 핸들 (PRD D5).
 * 모든 패널은 이 셸 위에 조립된다. resizable = { initial, min, max }.
 */
export default function Panel({
  title, tooltip, toolbar, resizable, className = '', children,
}) {
  const [width, setWidth] = useState(resizable?.initial);

  const onResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev) =>
      setWidth(clamp(startW + (startX - ev.clientX), resizable.min, resizable.max));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className={`col ${className}`} style={resizable ? { width } : undefined}>
      {resizable && <div className="col-resizer" onPointerDown={onResizeStart} />}
      <h3 className="pv-head" title={tooltip}>
        <span className="pv-title">{title}</span>
        {toolbar}
      </h3>
      {children}
    </div>
  );
}
