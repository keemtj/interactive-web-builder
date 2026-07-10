import { clamp } from '../conti/path.js';

/** 인스펙터 행 — 라벨 + 컨트롤 */
export function Row({ label, className = '', children, ...rest }) {
  return (
    <div className={`row ${className}`.trim()} {...rest}>
      {label != null && <label>{label}</label>}
      {children}
    </div>
  );
}

/** 수치 입력 — 클램프 내장, 행 클릭(선택)과 분리 */
export function NumberField({ value, onChange, min = 0, max = 1, step = 0.01, unit }) {
  return (
    <>
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const n = +e.target.value;
          onChange(clamp(Number.isFinite(n) ? n : min, min, max));
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </>
  );
}

export function TextField({ value, onChange, placeholder }) {
  return (
    <input
      type="text" value={value} placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ColorField({ value, onChange }) {
  return (
    <input
      type="color" value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectField({ value, onChange, options }) {
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
