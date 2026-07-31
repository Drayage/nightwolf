// 게임 규칙/상태 — 순수 함수, DOM 없음 (그래야 scripts/simulate.mjs가 헤드리스로 돌릴 수 있음).
// 모든 무작위성은 인자로 받은 rng 함수를 통해서만 쓴다 (Math.random 직접 호출 금지 —
// 안 그러면 scripts/simulate.mjs의 seed 기반 재현이 깨진다).
//
// 유물은 더 이상 "한 번 배정되면 끝"이 아니다 — 도둑/문제아/취객이 밤마다 실제로
// 유물을 맞바꾸므로(원작 그대로, 다만 하룻밤이 아니라 매일 밤 반복) villager.relic이
// 그 사람의 "지금" 정체다. 제물의 유물도 같은 원리: villagers 중 relic이 'sacrifice'인
// 사람 전원이 그 순간의 위협이고(여러 명일 수 있다), 별도 ID로 추적하지 않는다.
import {
  DEFAULT_RELIC_LAYOUT,
  BOX_SEED,
  VILLAGER_NAME_POOL,
  HONEST_RELICS,
  CLAIM_LINES,
  CORRUPTED_MOOD,
  NERVOUS_MOOD,
  MADNESS_EXECUTION_LINE,
  SACRIFICE_PLANTED_LINE,
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

function drawFromBox(rng, box) {
  if (box.length === 0) return null;
  const idx = Math.floor(rng() * box.length);
  return box.splice(idx, 1)[0];
}

// 제물/하수인의 "무슨 유물이라고 사칭할지"를 정한다(한 번 정하면 안 바뀜 — 거짓말도
// 일관성이 있어야 추궁이 성립한다). 이미 claimRole이 있는 사람은 건너뛴다 — 도둑의
// 유물에 휘말려 새로 제물/하수인이 된 사람만 이 시점에 처음 커버 스토리를 얻는다.
// 제물은 살아있는 사람들 중 실제로 존재하는 "진짜" 유물을 사칭하고(정원 초과 추궁이
// 걸리기 쉬움), 하수인은 그보다 훨씬 안일하게 유물함 안을 대충 훑어보고 그중 하나를
// 자기 것인 척한다. villagers를 제자리에서 바꾸므로 새로 복제된 배열에만 호출할 것.
function ensureClaimRoles(rng, villagers, box) {
  const honestPresent = [...new Set(villagers.map((v) => v.relic))].filter((r) => HONEST_RELICS.includes(r));
  const villagerPool = honestPresent.length > 0 ? honestPresent : ["villager"];
  const boxPool = [...new Set(box)].filter((r) => HONEST_RELICS.includes(r));
  const minionPool = boxPool.length > 0 ? boxPool : ["villager"];
  for (const v of villagers) {
    if (v.claimRole) continue;
    if (v.relic === "sacrifice") v.claimRole = pick(rng, villagerPool);
    else if (v.relic === "minion") v.claimRole = pick(rng, minionPool);
  }
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
  const box = [...BOX_SEED];

  ensureClaimRoles(rng, villagers, box);

  return { villagers, box };
}

// ── 매일 밤 캐스케이드: 도둑 → 문제아 → 취객 (원작 기상 순서) ────────
// 셋 다 "지금 그 유물을 쥔 사람"이 수행한다 — 그 유물이 밤마다 다른 사람에게
// 넘어갈 수 있으므로, 매번 새로 찾는다.
function cascadeRobber(rng, villagers) {
  const robber = villagers.find((v) => v.relic === "robber" && v.alive && !v.jailed);
  if (!robber) return;
  const others = villagers.filter((v) => v.alive && v.id !== robber.id);
  if (others.length === 0) return;
  const target = pick(rng, others);
  [robber.relic, target.relic] = [target.relic, robber.relic];
  // robber(원래 도둑)는 오늘 밤 target의 정체를 훔쳐서 새 역할이 됐다 — 그 사실을 알고
  // 있으므로, 오늘 낮 자신의(새 역할) 증언에 "누구 걸 훔쳤는지"를 덧붙일 수 있다.
  // target은 반대로 영문도 모른 채 도둑의 유물을 떠안는다.
  robber.stoleFrom = target.name;
}

function cascadeTroublemaker(rng, villagers) {
  const troublemaker = villagers.find((v) => v.relic === "troublemaker" && v.alive && !v.jailed);
  if (!troublemaker) return;
  const others = villagers.filter((v) => v.alive && v.id !== troublemaker.id);
  if (others.length < 2) return;
  const [a, b] = shuffle(rng, others);
  [a.relic, b.relic] = [b.relic, a.relic];
  troublemaker.tonightSwap = [a.name, b.name]; // 오늘 밤의 진짜 근거 — 매일 갱신
}

function cascadeDrunk(rng, villagers, box) {
  const drunk = villagers.find((v) => v.relic === "drunk" && v.alive && !v.jailed);
  if (!drunk) return;
  box.push(drunk.relic);
  drunk.relic = drawFromBox(rng, box) ?? drunk.relic; // 방금 넣었으니 박스가 비어있을 리 없음
}

function isThreat(v) {
  return v.relic === "sacrifice" || v.relic === "minion";
}

// 낮 증언 한 줄 — "나는 [유물]이다. [구체적 근거]." 형태의 확인 가능한 주장을 만든다.
// "정보가 진짜인가"는 화자가 실제로(오늘 밤 기준) 그 유물을 갖고 있는가(reliable)로
// 결정한다. 같은 유물을 주장하는 사람이 정원(ROLE_SLOTS)보다 많으면 그 자체가 추궁 단서.
function buildClaim(rng, state, speaker) {
  const role = speaker.relic === "sacrifice" || speaker.relic === "minion" ? speaker.claimRole : speaker.relic;
  const reliable = speaker.relic === role;
  const threat = isThreat(speaker);
  const others = state.villagers.filter((v) => v.alive && v.id !== speaker.id);

  const ctx = {};
  let targetId;

  if (role === "seer") {
    if (others.length === 0) return null;
    const target = pick(rng, others);
    targetId = target.id;
    const trueStrange = target.relic === "sacrifice" || target.relic === "minion";
    ctx.strange = reliable ? trueStrange : rng() < 0.5; // 진짜가 아니면 근거 없이 지어낸 값
    ctx.targetName = target.name;
  } else if (role === "troublemaker") {
    if (reliable) {
      ctx.targetName = speaker.tonightSwap?.[0] ?? null;
      ctx.targetName2 = speaker.tonightSwap?.[1] ?? null;
    } else if (others.length >= 2) {
      const [a, b] = shuffle(rng, others);
      ctx.targetName = a.name;
      ctx.targetName2 = b.name;
    }
  } else if (role === "mason") {
    const realPartner = state.villagers.find((v) => v.relic === "mason" && v.alive && v.id !== speaker.id);
    if (reliable) {
      ctx.partnerName = realPartner ? realPartner.name : null;
    } else if (others.length > 0) {
      ctx.partnerName = pick(rng, others).name; // 진짜 결계의 유물 소지자와는 다른 이름일 확률이 높음
    }
  }

  let line = (CLAIM_LINES[role] || CLAIM_LINES.villager)(ctx);
  // 오늘 밤 도둑질로 지금 이 역할을 갖게 됐다면, 누구 것을 훔쳤는지 스스로 밝힐 수 있다
  // (다른 유물로 사칭 중인 제물/하수인이 이 사실을 알 리는 없으니 threat면 건너뛴다).
  if (!threat && speaker.stoleFrom) {
    line += ` 사실 어젯밤 도둑의 유물로 ${speaker.stoleFrom}의 유물을 훔쳐온 거예요.`;
  }

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

  // 오늘 밤 캐스케이드는 여기서만 일어나므로, 이전 상태와 공유되던 참조를 먼저 떼어낸다.
  // stoleFrom은 "바로 어젯밤" 도둑맞았을 때만 유효한 정보라 매일 밤 초기화한다.
  const villagers = state.villagers.map((v) => ({ ...v, stoleFrom: undefined }));
  const box = [...state.box];

  cascadeRobber(rng, villagers);
  cascadeTroublemaker(rng, villagers);
  cascadeDrunk(rng, villagers, box);
  ensureClaimRoles(rng, villagers, box); // 캐스케이드로 새로 제물/하수인이 된 사람에게 커버 부여

  const nextState = { ...state, villagers, box };

  for (const speaker of villagers.filter((v) => v.alive)) {
    const claim = buildClaim(rng, nextState, speaker);
    if (claim) log.push(claim);
  }

  return { ...nextState, log };
}

export function startRun(rng) {
  const { villagers, box } = createVillage(rng);

  const initial = {
    day: 1,
    maxDays: 7,
    villagers,
    box,
    log: [],
    status: "playing",
  };

  return runNightPhase(initial, rng);
}

export function jail(state, id) {
  const target = state.villagers.find((v) => v.id === id);
  if (!target || target.jailed) return state; // 이미 갇혀있으면 할 일 없음

  // 감옥은 한 자리뿐 — 새로 가두면 먼저 있던 사람은 풀려난다.
  const previouslyJailed = state.villagers.find((v) => v.jailed && v.id !== id);
  const villagers = state.villagers.map((v) => {
    if (v.id === id) return { ...v, jailed: true };
    if (v.jailed) return { ...v, jailed: false };
    return v;
  });

  const log = [...state.log];
  if (previouslyJailed) {
    log.push({
      day: state.day,
      phase: "day",
      text: `감옥은 한 자리뿐이라, ${previouslyJailed.name}이(가) 먼저 풀려났다.`,
    });
  }
  log.push({ day: state.day, phase: "day", text: `장로가 ${nameOf(state, id)}을(를) 감옥에 가뒀다.` });

  return { ...state, villagers, log };
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

  const isRealSacrifice = target.relic === "sacrifice";
  const isMadnessDecoy = target.relic === "madness";

  // 죽은 사람의 유물은 유물함으로 돌아가 계속 순환한다.
  let box = [...state.box, target.relic];
  let villagers = state.villagers.map((v) => (v.id === id ? { ...v, alive: false } : v));
  const log = [...state.log, { day: state.day, phase: "day", text: `장로가 ${target.name}을(를) 제물로 처형했다.` }];

  if (!isRealSacrifice && !isMadnessDecoy) {
    return {
      ...state,
      villagers,
      box,
      log: [
        ...log,
        { day: state.day, phase: "day", text: `${target.name}은(는) 제물의 유물 소지자가 아니었다. 의식이 어긋났다...` },
      ],
      status: "lost",
      lossReason: "잘못된 제물을 바쳐 의식이 실패했습니다.",
    };
  }

  // 광기의 유물: 처형이 "성공한 것처럼" 보인다 — 장로는 실패를 느끼지 못한다.
  if (isMadnessDecoy) {
    log.push({ day: state.day, phase: "day", text: MADNESS_EXECUTION_LINE });
  }

  // 하수인이 갇히지 않았다면, 이 처형이 진짜든 위장이든 그 틈을 타 제물을 하나 더 심는다.
  const minion = villagers.find((v) => v.relic === "minion" && v.alive);
  const minionContained = !minion || minion.jailed;

  if (!minionContained) {
    const candidates = villagers.filter((v) => v.alive && v.relic !== "sacrifice" && v.id !== minion.id);
    if (candidates.length > 0) {
      const chosen = pick(rng, candidates);
      box = [...box, chosen.relic];
      villagers = villagers.map((v) => (v.id === chosen.id ? { ...v, relic: "sacrifice" } : v));
      log.push({ day: state.day, phase: "day", text: SACRIFICE_PLANTED_LINE });
    }
  }

  const remainingSacrifices = villagers.filter((v) => v.alive && v.relic === "sacrifice").length;

  if (remainingSacrifices === 0 && minionContained) {
    return {
      ...state,
      villagers,
      box,
      log: [...log, { day: state.day, phase: "day", text: "붉은달이 잦아들었다. 더 이상 제물은 나타나지 않는다." }],
      status: "won",
    };
  }

  if (state.day >= state.maxDays) {
    return {
      ...state,
      villagers,
      box,
      log: [...log, { day: state.day, phase: "day", text: "하수인을 끝내 잡지 못한 채 이레가 지났다..." }],
      status: "lost",
      lossReason: "기한 내에 제물을 모두 막지 못했습니다.",
    };
  }

  const nextState = {
    ...state,
    villagers,
    box,
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
