/** 세그먼티드 컨트롤 — Apple 스타일 (선택 = 흰 썸 + 그림자) */
export default function SegmentedControl({ options, value, onChange }) {
  return (
    <span className="ui-seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
