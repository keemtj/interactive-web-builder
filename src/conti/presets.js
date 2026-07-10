/**
 * 콘티 프리셋 — 그레이박스 원칙 (PRD D8):
 * 이미지 에셋 데모가 아니라, 와이어프레임 프리미티브로
 * 실제 인터랙션 문법이 동작하는 타임라인 목업이어야 한다.
 * 뼈대는 빌더가, 살은 사용자가 붙인다.
 */
import { defaultConti } from './defaultConti.js';
import { migrate02to03 } from './lifecycle.js';

/**
 * APPLE SKELETON — 애플 제품 페이지의 인터랙션 문법을 그레이박스로.
 * 여정: HERO ↓ → PIN·STAGE(+300vh: 제품 등장·헤드라인·콜아웃)
 *       → 가로 갤러리 ×2 → PIN·SPEC(+150vh) → OUTRO ↓ · 스티키 내비
 */
const appleSkeleton = {
  meta: { name: 'apple-skeleton', schema: '0.2' },

  segments: [
    { id: 's1', type: 'move', len: 100, dx: 0, dy: 1, label: '01 HERO',   color: '#4a9be6' },
    { id: 's2', type: 'pin',  len: 300, dx: 0, dy: 1, label: 'PIN·STAGE', color: '#f06088' },
    { id: 's3', type: 'move', len: 100, dx: 1, dy: 0, label: '02 GAL·A',  color: '#17b89e' },
    { id: 's4', type: 'move', len: 100, dx: 1, dy: 0, label: '03 GAL·B',  color: '#17b89e' },
    { id: 's5', type: 'pin',  len: 150, dx: 0, dy: 1, label: 'PIN·SPEC',  color: '#f06088' },
    { id: 's6', type: 'move', len: 100, dx: 0, dy: 1, label: '04 OUTRO',  color: '#4a9be6' },
  ],

  elements: [
    /* 히어로 타이틀 — 스태거 등장, 역스크롤에도 유지 */
    {
      id: 'hero', lane: 'HERO', mode: 'once', cell: [0, 0], color: '#e09a2f',
      ease: 'smooth', range: [0.01, 0.10], stagger: 0.05, text: 'AERO',
    },
    /* 제품 대역 — 핀 스테이지에서 등장, 스테이지 끝에서 퇴장 */
    {
      id: 'prod', lane: 'PROD', mode: 'scrub', cell: [0, 1], color: '#17b89e',
      ease: 'smooth', in: [0.13, 0.19], out: [0.43, 0.47],
    },
    /* 헤드라인 — 핀 중반 스태거 */
    {
      id: 'head', lane: 'HEAD', mode: 'once', cell: [0, 1], color: '#4a9be6',
      ease: 'smooth', range: [0.17, 0.30], stagger: 0.02, text: 'IMMERSIVE',
    },
    /* 콜아웃 라인 — 핀 후반 드로우 */
    {
      id: 'callout', lane: 'LINE', mode: 'draw', cell: [0, 1], color: '#9b7ff0',
      ease: 'smooth', range: [0.32, 0.43],
    },
    /* 가로 갤러리 카드 ×2 */
    {
      id: 'galA', lane: 'GAL·A', mode: 'scrub', cell: [1, 1], color: '#17b89e',
      ease: 'smooth', in: [0.49, 0.54], out: [0.56, 0.59],
    },
    {
      id: 'galB', lane: 'GAL·B', mode: 'scrub', cell: [2, 1], color: '#4a9be6',
      ease: 'smooth', in: [0.60, 0.65], out: [0.67, 0.71],
    },
    /* 스펙 수치 대역 — 핀 스펙 구간 스태거 (카운트업의 그레이박스) */
    {
      id: 'spec', lane: 'SPEC', mode: 'once', cell: [2, 1], color: '#e09a2f',
      ease: 'smooth', range: [0.74, 0.85], stagger: 0.04, text: '50HRS',
    },
    /* 스티키 내비 */
    {
      id: 'nav', lane: 'NAV', mode: 'sticky', color: '#e09a2f',
      ease: 'smooth', range: [0.05, 0.95], fade: 0.03,
    },
  ],

  breakpoints: {},
};

/**
 * LANDING PAGE — 웹 랜딩의 구성(HERO/FEATURES/PRICING/CTA)이 그대로 보이는 뼈대.
 * 히어로의 ∞ anim(스크롤 비종속 루프)까지 포함 — 인터랙티브 웹의 두 축
 * (스크롤 연출 + 시간 애니메이션)을 모두 담는다.
 */
const landingPage = {
  meta: { name: 'landing-page', schema: '0.2' },

  segments: [
    { id: 's1', type: 'move', len: 100, dx: 0, dy: 1, label: '01 HERO',       color: '#4a9be6' },
    { id: 's2', type: 'move', len: 100, dx: 0, dy: 1, label: '02 FEATURES 1', color: '#17b89e' },
    { id: 's3', type: 'move', len: 100, dx: 1, dy: 0, label: '03 FEATURES 2', color: '#17b89e' },
    { id: 's4', type: 'pin',  len: 150, dx: 0, dy: 1, label: '04 PRICING',    color: '#f06088' },
    { id: 's5', type: 'move', len: 100, dx: 0, dy: 1, label: '05 CTA',        color: '#9b7ff0' },
  ],

  elements: [
    /* 히어로 — 스크롤과 무관하게 살아 있는 펄스 오브 (∞ anim) */
    {
      id: 'orb', lane: 'ORB', mode: 'anim', variant: 'pulse', cell: [0, 0],
      color: '#9b7ff0', ease: 'smooth', range: [0.0, 0.2],
    },
    {
      id: 'title', lane: 'TITLE', mode: 'once', cell: [0, 0], color: '#e09a2f',
      ease: 'smooth', range: [0.01, 0.09], stagger: 0.05, text: 'LAUNCH',
    },
    {
      id: 'feat1', lane: 'FEAT·1', mode: 'scrub', cell: [0, 1], color: '#17b89e',
      ease: 'smooth', in: [0.2, 0.26], out: [0.3, 0.35],
    },
    {
      id: 'feat2', lane: 'FEAT·2', mode: 'scrub', cell: [1, 2], color: '#4a9be6',
      ease: 'smooth', in: [0.4, 0.47], out: [0.5, 0.54],
    },
    {
      id: 'price', lane: 'PRICE', mode: 'once', cell: [1, 2], color: '#e09a2f',
      ease: 'smooth', range: [0.58, 0.72], stagger: 0.06, text: '$29/MO',
    },
    {
      id: 'ctaline', lane: 'CTA', mode: 'draw', cell: [1, 3], color: '#9b7ff0',
      ease: 'smooth', range: [0.84, 0.95],
    },
    /* CTA 하단 — 무한 마퀴 (awwwards 단골 문법) */
    {
      id: 'mq', lane: 'MARQ', mode: 'anim', variant: 'marquee', cell: [1, 3],
      color: '#17b89e', ease: 'smooth', range: [0.8, 1], text: 'LAUNCH SOON — ',
    },
    {
      id: 'nav', lane: 'NAV', mode: 'sticky', color: '#e09a2f',
      ease: 'smooth', range: [0.04, 0.96], fade: 0.03,
    },
  ],

  breakpoints: {},
};

/**
 * GSAP MAIN — gsap.com 홈페이지 실측 분석(2026-07)을 그레이박스로 옮긴 콘티.
 * 실측: 총 ≈11.7화면(1170vh), 핀 스페이서 1개(ANIMATE ANYTHING ≈420vh),
 * 섹션: HERO(시간 기반 블롭) → Why GSAP(워드 리빌) → 핀 데모 전환 ×3
 *       → Tools 카드 ×2 → Brands 로고 마퀴 → Showcase → Footer 마퀴.
 * "GSAP 라이브러리를 코드가 아니라 GUI로" — 이 콘티가 그 증명이다.
 */
const gsapMain = {
  meta: { name: 'gsap-main', schema: '0.2' },

  segments: [
    { id: 's1', type: 'move', len: 125, dx: 0, dy: 1, label: '01 HERO',          color: '#4a9be6' },
    { id: 's2', type: 'move', len: 100, dx: 0, dy: 1, label: '02 WHY GSAP',      color: '#17b89e' },
    { id: 's3', type: 'pin',  len: 400, dx: 0, dy: 1, label: 'ANIMATE ANYTHING', color: '#f06088' },
    { id: 's4', type: 'move', len: 125, dx: 0, dy: 1, label: '03 TOOLS CORE',    color: '#17b89e' },
    { id: 's5', type: 'move', len: 125, dx: 0, dy: 1, label: '04 TOOLS PLUGINS', color: '#17b89e' },
    { id: 's6', type: 'move', len: 50,  dx: 0, dy: 1, label: '05 BRANDS',        color: '#e09a2f' },
    { id: 's7', type: 'move', len: 100, dx: 0, dy: 1, label: '06 SHOWCASE',      color: '#4a9be6' },
    { id: 's8', type: 'move', len: 100, dx: 0, dy: 1, label: '07 FOOTER',        color: '#9b7ff0' },
  ],

  elements: [
    /* HERO — 로드 즉시 살아 있는 블롭 (스크롤 비종속) + 타이틀 스플릿 등장 */
    {
      id: 'blob', lane: 'BLOB', mode: 'anim', variant: 'float', cell: [0, 0],
      color: '#9b7ff0', ease: 'smooth', range: [0.0, 0.11],
    },
    {
      id: 'htitle', lane: 'H1', mode: 'once', cell: [0, 0], color: '#e09a2f',
      ease: 'smooth', range: [0.005, 0.05], stagger: 0.04, text: 'ANIMATE',
    },
    /* WHY GSAP — "anything JS can touch" 워드-바이-워드 리빌 (SplitText 문법) */
    {
      id: 'why', lane: 'WHY', mode: 'once', cell: [0, 1], color: '#e09a2f',
      ease: 'smooth', range: [0.12, 0.19], stagger: 0.02, text: 'ANYTHING JS',
    },
    /* ANIMATE ANYTHING 핀 — 화면 고정 상태에서 데모 3종 전환 */
    {
      id: 'demoA', lane: 'DEMO·A', mode: 'scrub', cell: [0, 2], color: '#17b89e',
      ease: 'smooth', in: [0.21, 0.26], out: [0.30, 0.34],
    },
    /* 핀 화면을 x축으로 가로지르는 데모 — gsap.com 의 수평 이동 문법 (travel 배치) */
    {
      id: 'demoB', lane: 'DEMO·B', mode: 'scrub', color: '#4a9be6',
      ease: 'smooth', in: [0.34, 0.39], out: [0.43, 0.47],
      from: [-0.25, 2.4], to: [1.25, 2.4],
    },
    {
      id: 'demoC', lane: 'DEMO·C', mode: 'draw', cell: [0, 2], color: '#9b7ff0',
      ease: 'smooth', range: [0.47, 0.54],
    },
    /* TOOLS — 코어/플러그인 카드 리빌 */
    {
      id: 'tcore', lane: 'CORE', mode: 'scrub', cell: [0, 3], color: '#17b89e',
      ease: 'smooth', in: [0.57, 0.61], out: [0.64, 0.66],
    },
    {
      id: 'tplug', lane: 'PLUGIN', mode: 'scrub', cell: [0, 4], color: '#4a9be6',
      ease: 'smooth', in: [0.68, 0.72], out: [0.75, 0.77],
    },
    /* BRANDS — 로고 무한 마퀴 (실물 그대로) */
    {
      id: 'brands', lane: 'BRANDS', mode: 'anim', variant: 'marquee', cell: [0, 5],
      color: '#17b89e', ease: 'smooth', range: [0.77, 0.83],
      text: 'WEBFLOW · NETFLIX · NIKE · ',
    },
    /* SHOWCASE — 카드가 오른쪽에서 왼쪽으로 슬라이드 (x축 travel) */
    {
      id: 'show', lane: 'SHOW', mode: 'scrub', color: '#e09a2f',
      ease: 'smooth', in: [0.83, 0.87], out: [0.89, 0.91],
      from: [1.25, 6.45], to: [-0.25, 6.45],
    },
    /* 페이지 전체를 관통하는 세로 드로우 레일 — 세그먼트가 아니라 타임라인에 산다 */
    {
      id: 'rail', lane: 'RAIL', mode: 'draw', color: '#f06088',
      ease: 'linear', range: [0.03, 0.97],
      from: [0.92, 0.15], to: [0.92, 7.85],
    },
    /* FOOTER — 거대 GSAP 워드마크 마퀴 */
    {
      id: 'fmarq', lane: 'GSAP∞', mode: 'anim', variant: 'marquee', cell: [0, 7],
      color: '#9b7ff0', ease: 'smooth', range: [0.92, 1], text: 'GSAP — ',
    },
    /* 상단 고정 내비 */
    {
      id: 'nav', lane: 'NAV', mode: 'sticky', color: '#e09a2f',
      ease: 'smooth', range: [0.02, 0.98], fade: 0.02,
    },
  ],

  breakpoints: {},
};

/* 프리셋 본문은 v0.2 어휘로 정의하고 로드 시 v0.3(elements+tweens)으로 변환 */
const gsap3 = migrate02to03(gsapMain);
/* v0.3 의 증명 — 한 덩어리에 트윈 N개: NAV(frame)가 창에 종속된 채
   핀 구간에서 x축으로도 밀린다 (구 모델에선 불가능했던 조합) */
gsap3.tweens.push({
  id: 'twNavX', target: 'nav', clock: 'scroll', state: 'pure', ease: 'smooth',
  window: [0.22, 0.5], props: { x: [0, -0.12] },
});

export const PRESETS = [
  { id: 'gsap-main', label: 'GSAP MAIN', conti: gsap3 },
  { id: 'landing-page', label: 'LANDING PAGE', conti: migrate02to03(landingPage) },
  { id: 'apple-skeleton', label: 'APPLE SKELETON', conti: migrate02to03(appleSkeleton) },
  { id: 'basic', label: 'BASIC JOURNEY', conti: migrate02to03(defaultConti) },
];
