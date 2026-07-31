// 게임 규칙/상태 — 순수 함수, DOM 없음 (그래야 scripts/simulate.mjs가 헤드리스로 돌릴 수 있음).
// 모든 무작위성은 인자로 받은 rng 함수를 통해서만 쓴다 (Math.random 직접 호출 금지 —
// 안 그러면 scripts/simulate.mjs의 seed 기반 재현이 깨진다).
import {
  DEFAULT_RELIC_LAYOUT,
  VILLAGER_NAME_POOL,
  HONEST_RELICS,
  RELIC_INFO,
  CLAIM_LINES,
  CORRUPTED_MOOD,
  NERVOUS_MOOD,
  hunterRevealLine,
  TANNER_ENDING_TEXT,
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
  const villagers = relics.map((relic, i) => ({
    id: `v${i}`,
    name: names[i],
    relic,
    alive: true,
    jailed: false,
  }));

  // 제물/하수인은 정체를 감추려고 실제로 마을에 존재하는 "진짜" 유물 중 하나를 사칭한다.
  // 사칭 대상은 마을 생성 시 한 번만 정해지고(그날그날 안 바뀜) — 거짓말도 일관성이 있어야
  // 추궁(모순 찾기)이 성립한다.
  const honestPresent = [...new Set(villagers.map((v) => v.relic))].filter((r) => HONEST_RELICS.includes(r));
  const pool = honestPresent.length > 0 ? honestPresent : ["villager"];

  return villagers.map((v) =>
    v.relic === "sacrifice" || v.relic === "minion" ? { ...v, claimRole: pick(rng, pool) } : v
  );
}

// 취객은 자기 유물을 스스로도 착각한다 — 매일 밤 다른 "진짜" 유물을 무작위로 주장한다
// (드렁크 자신은 절대 제외: "나는 몽롱한 유물이다"라고는 스스로 말하지 않는다).
function resolveClaimRole(rng, speaker) {
  if (speaker.relic === "sacrifice" || speaker.relic === "minion") return speaker.claimRole;
  if (speaker.relic === "drunk") return pick(rng, HONEST_RELICS.filter((r) => r !== "drunk"));
  return speaker.relic;
}

function isThreat(v) {
  return v.relic === "sacrifice" || v.relic === "minion";
}

// 낮 증언 한 줄 — "나는 [유물]이다. [구체적 근거]." 형태의 확인 가능한 주장을 만든다.
// "정보가 진짜인가"는 화자가 실제로 그 유물을 갖고 있는가(reliable)로 결정한다 — 취객처럼
// 무해해도 진짜 그 유물이 아니면 근거는 지어낸 것이다. 둘 다 문장 형태는 동일해서, 같은
// 유물을 주장하는 사람이 정원(ROLE_SLOTS)보다 많으면 그 자체가 추궁 단서가 된다.
function buildClaim(rng, state, speaker, silencedId) {
  const role = resolveClaimRole(rng, speaker);
  const reliable = speaker.relic === role;
  const threat = isThreat(speaker);
  const others = state.villagers.filter((v) => v.alive && v.id !== speaker.id);

  const ctx = {};
  let targetId;

  if (role === "seer" || role === "robber") {
    if (others.length === 0) return null;
    const target = pick(rng, others);
    targetId = target.id;
    // 유물 종류가 아니라 "현재" 위협인지로 판정: 제물의 유물은 하수인이 방치되면
    // 다른 사람에게 옮겨가므로(relic 필드는 안 바뀜) sacrificeHolderId 기준으로 봐야 한다.
    const trueStrange = target.id === state.sacrificeHolderId || target.id === state.minionId;
    ctx.strange = reliable ? trueStrange : rng() < 0.5; // 진짜가 아니면 근거 없이 지어낸 값
    ctx.targetName = target.name;
  } else if (role === "troublemaker") {
    if (reliable) {
      const silenced = state.villagers.find((v) => v.id === silencedId);
      ctx.targetName = silenced ? silenced.name : null;
    } else if (others.length > 0) {
      ctx.targetName = pick(rng, others).name; // 지어낸 이름 — 실제로 막힌 사람과 다를 수 있음
    }
  } else if (role === "mason") {
    if (reliable) {
      const realPartner = state.villagers.find((v) => v.relic === "mason" && v.id !== speaker.id);
      ctx.partnerName = realPartner ? realPartner.name : null;
    } else if (others.length > 0) {
      ctx.partnerName = pick(rng, others).name; // 진짜 결계의 유물 소지자와는 다른 이름일 확률이 높음
    }
  }

  const line = (CLAIM_LINES[role] || CLAIM_LINES.villager)(ctx);
  let mood = "";
  if (threat) mood = " " + pick(rng, CORRUPTED_MOOD);
  else if (role === "villager" && rng() < 0.3) mood = " " + pick(rng, NERVOUS_MOOD);

  return {
    day: state.day,
    phase: "day",
    text: `${speaker.name}: "${line}"${mood}`,
    meta: { kind: "claim", speakerId: speaker.id, claimedRole: role, targetId, strange: ctx.strange },
  };
}

function nameOf(state, id) {
  return state.villagers.find((v) => v.id === id)?.name ?? "???";
}

function runNightPhase(state, rng) {
  const log = [...state.log];
  log.push({
    day: state.day,
    phase: "night",
    text: "붉은달이 떠올랐다. 마을은 다시 한번 의식의 밤을 맞이한다.",
  });

  // 진짜 혼돈의 유물 소지자(갇히지 않은 채 살아있어야 함)가 그날 입을 막을 대상을 고른다.
  const troublemaker = state.villagers.find((v) => v.relic === "troublemaker" && v.alive && !v.jailed);
  let silencedId = null;
  if (troublemaker) {
    const candidates = state.villagers.filter((v) => v.alive && v.id !== troublemaker.id);
    if (candidates.length > 0) silencedId = pick(rng, candidates).id;
  }

  for (const speaker of state.villagers.filter((v) => v.alive)) {
    if (speaker.id === silencedId) continue; // 실제로 입이 막혀 그날은 증언하지 못한다
    const claim = buildClaim(rng, state, speaker, silencedId);
    if (claim) log.push(claim);
  }

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
    // 무두장이는 처형되길 원했던 자 — 일반적인 오판과는 다른 결말로 갈린다(실질 효과).
    if (target.relic === "tanner") {
      return {
        ...state,
        villagers,
        log: [...log, { day: state.day, phase: "day", text: TANNER_ENDING_TEXT }],
        status: "tanner",
        lossReason: TANNER_ENDING_TEXT,
      };
    }

    const epilogue = [
      { day: state.day, phase: "day", text: `${target.name}은(는) 제물의 유물 소지자가 아니었다. 의식이 어긋났다...` },
    ];
    // 사냥꾼은 죽으며 감옥에 갇힌 자의 진짜 정체를 실제로 폭로한다(실질 효과).
    if (target.relic === "hunter") {
      const jailedVillager = villagers.find((v) => v.jailed && v.id !== target.id);
      epilogue.push({
        day: state.day,
        phase: "day",
        text: hunterRevealLine(jailedVillager?.name, jailedVillager ? RELIC_INFO[jailedVillager.relic].name : null),
      });
    }

    return {
      ...state,
      villagers,
      log: [...log, ...epilogue],
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
