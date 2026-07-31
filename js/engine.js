// 게임 규칙/상태 — 순수 함수, DOM 없음 (그래야 scripts/simulate.mjs가 헤드리스로 돌릴 수 있음).
// 모든 무작위성은 인자로 받은 rng 함수를 통해서만 쓴다 (Math.random 직접 호출 금지 —
// 안 그러면 scripts/simulate.mjs의 seed 기반 재현이 깨진다).
//
// 유물은 주머니 속에 있어 아무도 "지금" 자기가 뭔지 모른다(villager.relic이 기계적으로
// 현재 정체 — 위협 판정·다음 밤 행동 결정에 쓰임). 낮에 하는 말은 villager.belief를
// 바탕으로 한다 — 자기가 직접 행동했을 때만 갱신되는, "내가 기억하는 나"다. 그래서
// 말하는 유물과 실제 유물이 다를 수 있다. 제물의 유물도 같은 원리로 relic이 유일한
// 출처: relic이 'sacrifice'인 사람 전원이 그 순간의 위협이고(여러 명일 수 있다),
// 별도 ID로 추적하지 않는다.
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
  RITUAL_FAILURE_TEXT,
  TIMEOUT_FAILURE_LINE,
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

export function createVillage(rng) {
  const relics = shuffle(rng, DEFAULT_RELIC_LAYOUT);
  const names = drawNames(rng, relics.length);
  const villagers = relics.map((relic, i) => ({
    id: `v${i}`,
    name: names[i],
    relic,
    startingRelic: relic, // 결말 공개용, 절대 안 바뀜
    alive: true,
    jailed: false,
    belief: { role: relic }, // "내가 기억하는 나" — 처음엔 원래 유물 그대로
  }));
  const box = [...BOX_SEED];
  return { villagers, box };
}

// ── 매일 밤 캐스케이드: 비밀요원 → 천리안 → 도둑 → 문제아 → 취객 (원작 기상 순서) ──
// 전부 "지금 그 유물을 쥔 사람"이 수행한다 — 그 유물이 밤마다 다른 사람에게 넘어갈
// 수 있으므로 매번 새로 찾는다. belief는 오직 "행동한 사람"만 갱신된다 — 도둑맞은
// 쪽/문제아에게 휘말린 쪽은 아무것도 모른 채 자기가 알던 대로만 계속 믿는다.
function nightMason(villagers) {
  const masons = villagers.filter((v) => v.relic === "mason" && v.alive && !v.jailed);
  if (masons.length >= 2) {
    const [a, b] = masons;
    a.belief = { role: "mason", partnerName: b.name };
    b.belief = { role: "mason", partnerName: a.name };
    a.involvedTonight = true;
    b.involvedTonight = true;
  } else if (masons.length === 1) {
    masons[0].belief = { role: "mason", partnerName: null };
  }
}

function nightSeer(rng, villagers) {
  const seer = villagers.find((v) => v.relic === "seer" && v.alive && !v.jailed);
  if (!seer) return;
  const others = villagers.filter((v) => v.alive && v.id !== seer.id);
  if (others.length === 0) return;
  const target = pick(rng, others);
  const strange = target.relic === "sacrifice" || target.relic === "minion";
  seer.belief = { role: "seer", targetId: target.id, targetName: target.name, strange };
  seer.involvedTonight = true;
  target.involvedTonight = true;
}

function nightRobber(rng, villagers) {
  const robber = villagers.find((v) => v.relic === "robber" && v.alive && !v.jailed);
  if (!robber) return;
  const others = villagers.filter((v) => v.alive && v.id !== robber.id);
  if (others.length === 0) return;
  const target = pick(rng, others);
  [robber.relic, target.relic] = [target.relic, robber.relic];
  // robber는 누구와 바꿨는지는 알지만(주머니 밖 행동), 뭘 받았는지는 안을 안 봐서 모른다.
  // target은 자기 유물이 바뀐 줄도 모른다 — belief 그대로 둔다.
  robber.belief = { role: "robber", swappedWithName: target.name };
  robber.involvedTonight = true;
  target.involvedTonight = true;
}

function nightTroublemaker(rng, villagers) {
  const troublemaker = villagers.find((v) => v.relic === "troublemaker" && v.alive && !v.jailed);
  if (!troublemaker) return;
  const others = villagers.filter((v) => v.alive && v.id !== troublemaker.id);
  if (others.length < 2) return;
  const [a, b] = shuffle(rng, others);
  [a.relic, b.relic] = [b.relic, a.relic];
  troublemaker.belief = { role: "troublemaker", targetName: a.name, targetName2: b.name };
  troublemaker.involvedTonight = true;
  a.involvedTonight = true;
  b.involvedTonight = true;
}

function nightDrunk(rng, villagers, box) {
  const drunk = villagers.find((v) => v.relic === "drunk" && v.alive && !v.jailed);
  if (!drunk) return;
  box.push(drunk.relic);
  drunk.relic = drawFromBox(rng, box) ?? drunk.relic; // 방금 넣었으니 박스가 비어있을 리 없음
  drunk.belief = { role: "drunk" };
  drunk.involvedTonight = true;
}

// 제물/하수인의 사칭(claimRole)은 처음 그 역할이 됐을 때 한 번만 정해지고 안 바뀐다.
// 사칭의 "구체적 근거"(누굴 봤다, 누구랑 바꿨다 등)는 매일 밤 새로 지어낸다 — 진짜
// 능력이 있는 척하려면 매일 그럴듯한 최신 정보를 대야 하기 때문이다(로버만 예외 —
// 원래도 "모른다"가 정답이라 지어낼 필요가 없다).
function refreshFakeBeliefs(rng, villagers, box) {
  const honestPresent = [...new Set(villagers.map((v) => v.relic))].filter((r) => HONEST_RELICS.includes(r));
  const villagerPool = honestPresent.length > 0 ? honestPresent : ["villager"];
  const boxPool = [...new Set(box)].filter((r) => HONEST_RELICS.includes(r));
  const minionPool = boxPool.length > 0 ? boxPool : ["villager"];

  for (const v of villagers) {
    if (v.relic !== "sacrifice" && v.relic !== "minion") continue;
    if (!v.claimRole) v.claimRole = pick(rng, v.relic === "sacrifice" ? villagerPool : minionPool);

    const role = v.claimRole;
    const others = villagers.filter((o) => o.alive && o.id !== v.id);
    const fake = { role };
    if (role === "seer") {
      if (others.length > 0) {
        const t = pick(rng, others);
        fake.targetId = t.id;
        fake.targetName = t.name;
        fake.strange = rng() < 0.5;
      }
    } else if (role === "troublemaker") {
      if (others.length >= 2) {
        const [a, b] = shuffle(rng, others);
        fake.targetName = a.name;
        fake.targetName2 = b.name;
      }
    } else if (role === "mason") {
      if (others.length > 0) fake.partnerName = pick(rng, others).name;
    }
    v.fakeBelief = fake;
  }
}

function isThreat(v) {
  return v.relic === "sacrifice" || v.relic === "minion";
}

// 낮 증언 한 줄 — belief(또는 사칭이면 fakeBelief)를 그대로 문장으로 옮긴다.
// 같은 유물을 주장하는 사람이 정원(ROLE_SLOTS)보다 많으면 그 자체가 추궁 단서.
function buildPendingClaim(rng, speaker) {
  const threat = isThreat(speaker);
  const belief = threat ? speaker.fakeBelief : speaker.belief;
  if (!belief) return null;

  const role = belief.role;
  const line = (CLAIM_LINES[role] || CLAIM_LINES.villager)(belief);
  let mood = "";
  if (threat) mood = " " + pick(rng, CORRUPTED_MOOD);
  else if (role === "villager" && rng() < 0.3) mood = " " + pick(rng, NERVOUS_MOOD);

  return {
    phase: "day",
    text: `${speaker.name}: "${line}"${mood}`,
    meta: { kind: "claim", speakerId: speaker.id, claimedRole: role, targetId: belief.targetId, strange: belief.strange },
  };
}

function nameOf(state, id) {
  return state.villagers.find((v) => v.id === id)?.name ?? "???";
}

// 밤 페이즈: 캐스케이드 + 오늘 낮에 할 말을 전부 미리 정해두지만, 아직 log에는 넣지
// 않는다(pendingClaims) — 플레이어가 "낮이 밝았다"를 눌러야 공개된다(revealDay).
function runNightPhase(state, rng) {
  const log = [...state.log];
  log.push({ day: state.day, phase: "night", text: "붉은달이 떠올랐다. 마을은 다시 한번 의식의 밤을 맞이한다." });

  const villagers = state.villagers.map((v) => ({ ...v, involvedTonight: false }));
  const box = [...state.box];

  nightMason(villagers);
  nightSeer(rng, villagers);
  nightRobber(rng, villagers);
  nightTroublemaker(rng, villagers);
  nightDrunk(rng, villagers, box);
  refreshFakeBeliefs(rng, villagers, box);

  const pendingClaims = [];
  for (const speaker of villagers.filter((v) => v.alive)) {
    const claim = buildPendingClaim(rng, speaker);
    if (claim) pendingClaims.push({ day: state.day, ...claim });
  }

  const nightInvolvement = villagers.filter((v) => v.alive && v.involvedTonight).map((v) => v.id);

  return { ...state, villagers, box, phase: "night", pendingClaims, nightInvolvement, log };
}

// 밤에 정해둔 오늘의 증언을 실제로 공개한다 — "낮이 밝았다" 버튼에서 호출.
export function revealDay(state) {
  if (state.phase !== "night") return state;
  return {
    ...state,
    phase: "day",
    log: [...state.log, ...(state.pendingClaims || [])],
    pendingClaims: [],
  };
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
  if (state.status !== "playing") return state;
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
    log.push({ day: state.day, phase: "day", text: `감옥은 한 자리뿐이라, ${previouslyJailed.name}이(가) 먼저 풀려났다.` });
  }
  log.push({ day: state.day, phase: "day", text: `장로가 ${nameOf(state, id)}을(를) 감옥에 가뒀다.` });

  return { ...state, villagers, log };
}

export function release(state, id) {
  if (state.status !== "playing") return state;
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, jailed: false } : v));
  return {
    ...state,
    villagers,
    log: [...state.log, { day: state.day, phase: "day", text: `장로가 ${nameOf(state, id)}을(를) 풀어주었다.` }],
  };
}

function buildRevealTable(villagers) {
  return villagers.map((v) => ({ id: v.id, name: v.name, startingRelic: v.startingRelic, endingRelic: v.relic }));
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
      log: [...log, ...RITUAL_FAILURE_TEXT.map((text) => ({ day: state.day, phase: "ending", text }))],
      status: "lost",
      lossReason: "잘못된 제물을 바쳐 의식이 실패했습니다.",
      revealTable: buildRevealTable(villagers),
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
      log: [...log, { day: state.day, phase: "day", text: TIMEOUT_FAILURE_LINE }],
      status: "lost",
      lossReason: "기한 내에 제물을 모두 막지 못했습니다.",
      revealTable: buildRevealTable(villagers),
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
  if (game.state.phase === "night") game.state = revealDay(game.state);
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
