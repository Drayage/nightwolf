// headless 시뮬레이터 뼈대 — N판 자동 진행 + 교착 감지 워치독.
// AI·밸런스·라운드 플로우가 있는 게임은 로직을 짜기 "전에" 이 파일을 엔진에 연결하고,
// 이후 모든 로직 수정은 시뮬 통과를 기준으로 삼는다.
// (uritichu 1000판 시뮬의 일반화 + loveletterlegend 교착 15커밋의 예방책)
//
// 사용법: node scripts/simulate.mjs [판수]
// 연결: 아래 TODO 세 함수를 게임 엔진에 연결한다. 엔진은 DOM 없이 동작해야 한다
//       (엔진과 렌더를 분리해두면 자동으로 충족됨).

const GAMES = Number(process.argv[2] || 500);
const MAX_STEPS = 5000; // 이 스텝을 넘으면 교착으로 판정

// ── 게임 엔진 연결 ─────────────────────────────────────────────
// engine.createGame(rng)는 rng 함수를 직접 받는다 — 아래 루프가 이미
// seededRandom(i)로 만든 rng 함수를 넘겨주므로 그대로 재사용한다.
import { createGame, stepGame, isGameOver, getResult } from "../js/engine.js";
// ────────────────────────────────────────────────────────────────

function seededRandom(seed) {
  // mulberry32 — 재현 가능한 판을 위해 seed 기반 RNG 사용 (Math.random 직접 사용 금지)
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stats = { games: 0, deadlocks: 0, totalTurns: 0, wins: {}, deadlockSeeds: [] };

for (let i = 0; i < GAMES; i++) {
  const game = createGame(seededRandom(i));
  let steps = 0;
  let dead = false;
  while (!isGameOver(game)) {
    stepGame(game);
    if (++steps > MAX_STEPS) {
      dead = true;
      break;
    }
  }
  stats.games++;
  if (dead) {
    stats.deadlocks++;
    stats.deadlockSeeds.push(i);
    if (stats.deadlockSeeds.length <= 3)
      console.error(`⚠ 교착 감지 seed=${i} — 같은 seed로 재현 가능. 상태:`, JSON.stringify(game).slice(0, 500));
  } else {
    const r = getResult(game);
    stats.totalTurns += r.turns || steps;
    stats.wins[r.winner] = (stats.wins[r.winner] || 0) + 1;
  }
}

console.log("── 시뮬 결과 ──");
console.log(`판수: ${stats.games}, 교착: ${stats.deadlocks}${stats.deadlocks ? " ← 0이어야 함!" : ""}`);
console.log(`평균 턴: ${(stats.totalTurns / Math.max(1, stats.games - stats.deadlocks)).toFixed(1)}`);
console.log("승률:", stats.wins);
if (stats.deadlockSeeds.length) console.log("교착 seed 목록:", stats.deadlockSeeds.slice(0, 20));
process.exit(stats.deadlocks ? 1 : 0);
