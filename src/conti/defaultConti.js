/**
 * 콘티 JSON — 빌더의 단일 진실 원천 (스키마 v0.2)
 * 명세: docs/conti-schema-v0.1.md (+ v0.2 변경) · docs/PRD.md D2
 *
 * segments[] : 여정 폴리라인. { id, type('move'|'pin'), len(vh), dx, dy, label, color }
 *   - type='pin' 이면 이동 없이 스크롤만 소비. dx/dy 는 보존돼 해제 시 방향 복원.
 * elements[] : mode 가 라이프사이클을 결정한다.
 *   - scrub  : 플레이헤드의 순수 함수. in/out 창. 역스크롤 시 되감김.
 *   - once   : 완료 시 래치. range 창. 역스크롤에도 유지.
 *   - draw   : scrub 의 변형 (stroke-dashoffset). range 창.
 *   - sticky : 페이지가 아닌 프레임에 고정. range 안에서만 존재. cell 없음.
 * breakpoints{} : 반응형 오버라이드 자리 (Phase 3에서 사용).
 */
export const defaultConti = {
  meta: { name: 'basic-journey', schema: '0.2' },

  segments: [
    { id: 's1', type: 'move', len: 100, dx: 0, dy: 1, label: '01 DOWN',  color: '#4a9be6' },
    { id: 's2', type: 'pin',  len: 200, dx: 0, dy: 1, label: 'PIN',      color: '#f06088' },
    { id: 's3', type: 'move', len: 100, dx: 1, dy: 0, label: '02 RIGHT', color: '#17b89e' },
    { id: 's4', type: 'move', len: 100, dx: 0, dy: 1, label: '03 DOWN',  color: '#4a9be6' },
  ],

  elements: [
    {
      id: 'img', lane: 'IMG', mode: 'scrub', cell: [0, 0], color: '#17b89e',
      ease: 'smooth', in: [0.03, 0.10], out: [0.13, 0.19],
    },
    {
      id: 'txt', lane: 'TXT', mode: 'once', cell: [0, 1], color: '#e09a2f',
      ease: 'smooth', range: [0.26, 0.50], stagger: 0.036, text: 'PERSIST',
    },
    {
      id: 'sig', lane: 'SVG', mode: 'draw', cell: [1, 1], color: '#9b7ff0',
      ease: 'smooth', range: [0.62, 0.78],
    },
    {
      id: 'nav', lane: 'NAV', mode: 'sticky', color: '#e09a2f',
      ease: 'smooth', range: [0.08, 0.90], fade: 0.03,
    },
  ],

  breakpoints: {},
};
