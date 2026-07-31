// 게임 규칙/상태 — 순수 함수, DOM 없음 (그래야 scripts/simulate.mjs가 헤드리스로 돌릴 수 있음).
// 모든 무작위성은 인자로 받은 rng 함수를 통해서만 쓴다 (Math.random 직접 호출 금지 —
// 안 그러면 scripts/simulate.mjs의 seed 기반 재현이 깨진다).
import {
  DEFAULT_RELIC_LAYOUT,
  VILLAGER_NAME_POOL,
  DEFENSIVE_LIES,
  CORRUPTED_LIES,
  PLAIN_LINES,
} from "./data/relics.js";

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function drawNames(rng, count) {
  const pool = [...VILLAGER_NAME_POOL];
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

export function createVillage(rng) {
  const relics = shuffle(rng, DEFAULT_RELIC_LAYOUT);
  const names = drawNames(rng, relics.length);
  return relics.map((relic, i) => ({
    id: `v${i}`,
    name: names[i],
    relic,
    alive: true,
    jailed: false,
  }));
}

function generateTestimony(rng, v) {
  if (v.relic === "sacrifice") return pick(rng, CORRUPTED_LIES);
  if (v.relic === "minion") return pick(rng, DEFENSIVE_LIES);
  return pick(rng, rng() < 0.3 ? DEFENSIVE_LIES : PLAIN_LINES);
}

function nameOf(state, id) {
  return state.villagers.find((v) => v.id === id)?.name ?? "???";
}

function runNightPhase(state, rng) {
  const villagers = state.villagers;
  const seer = villagers.find((v) => v.relic === "seer" && v.alive && !v.jailed);
  const log = [...state.log];

  log.push({
    day: state.day,
    phase: "night",
    text: "붉은달이 떠올랐다. 마을은 다시 한번 의식의 밤을 맞이한다.",
  });

  if (seer) {
    const candidates = villagers.filter((v) => v.id !== seer.id && v.alive);
    if (candidates.length > 0) {
      const target = pick(rng, candidates);
      // 유물 종류가 아니라 "현재" 위협인지로 판정: 제물의 유물은 하수인이 방치되면
      // 다른 사람에게 옮겨가므로(relic 필드는 안 바뀜) sacrificeHolderId 기준으로 봐야 한다.
      const strange = target.id === state.sacrificeHolderId || target.id === state.minionId;
      log.push({
        day: state.day,
        phase: "day",
        text: `${seer.name}: "어젯밤 ${target.name}의 유물을 몰래 봤어요. ${
          strange ? "뭔가... 이상했어요." : "평범해 보였어요."
        }"`,
        meta: { kind: "seer-report", seerId: seer.id, targetId: target.id, strange },
      });
    }
  }

  villagers
    .filter((v) => v.alive && v.id !== seer?.id)
    .forEach((v) => {
      log.push({ day: state.day, phase: "day", text: `${v.name}: ${generateTestimony(rng, v)}` });
    });

  return { ...state, log };
}

export function startRun(rng) {
  const villagers = createVillage(rng);
  const sacrifice = villagers.find((v) => v.relic === "sacrifice");
  const minion = villagers.find((v) => v.relic === "minion");

  const initial = {
    day: 1,
    maxDays: 7,
    villagers,
    sacrificeHolderId: sacrifice.id,
    minionId: minion.id,
    log: [],
    status: "playing",
  };

  return runNightPhase(initial, rng);
}

export function jail(state, id) {
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, jailed: true } : v));
  return {
    ...state,
    villagers,
    log: [...state.log, { day: state.day, phase: "day", text: `장로가 ${nameOf(state, id)}을(를) 감옥에 가뒀다.` }],
  };
}

export function release(state, id) {
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, jailed: false } : v));
  return {
    ...state,
    villagers,
    log: [...state.log, { day: state.day, phase: "day", text: `장로가 ${nameOf(state, id)}을(를) 풀어주었다.` }],
  };
}

export function execute(state, id, rng) {
  const target = state.villagers.find((v) => v.id === id);
  if (!target || state.status !== "playing") return state;

  const isCorrect = id === state.sacrificeHolderId;
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, alive: false } : v));
  const log = [...state.log, { day: state.day, phase: "day", text: `장로가 ${target.name}을(를) 제물로 처형했다.` }];

  if (!isCorrect) {
    return {
      ...state,
      villagers,
      log: [
        ...log,
        { day: state.day, phase: "day", text: `${target.name}은(는) 제물의 유물 소지자가 아니었다. 의식이 어긋났다...` },
      ],
      status: "lost",
      lossReason: "잘못된 제물을 바쳐 의식이 실패했습니다.",
    };
  }

  const minion = villagers.find((v) => v.id === state.minionId);
  const minionContained = !minion.alive || minion.jailed;

  if (minionContained) {
    return {
      ...state,
      villagers,
      log: [...log, { day: state.day, phase: "day", text: "붉은달이 잦아들었다. 더 이상 제물은 나타나지 않는다." }],
      status: "won",
    };
  }

  if (state.day >= state.maxDays) {
    return {
      ...state,
      villagers,
      log: [...log, { day: state.day, phase: "day", text: "하수인을 끝내 잡지 못한 채 이레가 지났다..." }],
      status: "lost",
      lossReason: "기한 내에 하수인을 막지 못했습니다.",
    };
  }

  const candidates = villagers.filter((v) => v.alive && v.id !== state.minionId);
  if (candidates.length === 0) {
    return {
      ...state,
      villagers,
      log: [...log, { day: state.day, phase: "day", text: "더 이상 제물로 삼을 사람이 남지 않았다..." }],
      status: "lost",
      lossReason: "더 이상 제물로 삼을 사람이 없습니다.",
    };
  }

  const newHolder = pick(rng, candidates);
  log.push({ day: state.day, phase: "day", text: "하수인이 어둠 속에서 제물의 유물을 다른 이에게 옮겼다..." });

  const nextState = {
    ...state,
    villagers,
    sacrificeHolderId: newHolder.id,
    day: state.day + 1,
    log,
  };

  return runNightPhase(nextState, rng);
}

// ── scripts/simulate.mjs 연결용 헤드리스 인터페이스 ────────────────
// AI 정책(js/ai.js)을 그대로 써서 "제대로 된 플레이면 풀리는 퍼즐인가"를 검증한다.
import { decideElderMove } from "./ai.js";

export function createGame(rng) {
  return { state: startRun(rng), rng };
}

export function stepGame(game) {
  const move = decideElderMove(game.state);
  let state = game.state;
  if (move.jailId) state = jail(state, move.jailId);
  state = execute(state, move.executeId, game.rng);
  game.state = state;
}

export function isGameOver(game) {
  return game.state.status !== "playing";
}

export function getResult(game) {
  return { winner: game.state.status, turns: game.state.day };
}
