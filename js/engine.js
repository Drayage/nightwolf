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
  VILLAGE_SIZE,
  DUPLICATABLE_RELICS,
  MASON_COUNT_WEIGHTS,
  ALL_RELICS,
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
  nightListenLine,
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

function weightedPick(rng, weightedOptions) {
  const total = weightedOptions.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, w] of weightedOptions) {
    if (r < w) return value;
    r -= w;
  }
  return weightedOptions[weightedOptions.length - 1][0];
}

// 마을 구성을 무작위로 정한다 — 제물/하수인만 1명씩 고정, 결계는 항상 짝수(0/2/4,
// 2가 가장 흔함), 나머지 칸은 예지/도둑/문제아/취객/광기/평범 중에서 칸마다 독립적으로
// 뽑는다. 그래서 어떤 유물이 아예 안 나올 수도, 여러 명 겹칠 수도 있다 — 다만 같은
// 유물이 이미 여러 번 나왔으면 그다음 칸에서 또 나올 확률을 점점 낮춘다(가중치
// 1/(이미 나온 횟수+1)) — 안 그러면 가끔 한쪽으로 확 쏠려서(예: 예지 5명) 재미가
// 없어진다. 완전히 막지는 않으므로 여전히 몰릴 수는 있다.
function generateRelicLayout(rng, size) {
  const layout = ["sacrifice", "minion"];
  let remaining = size - layout.length;

  const masonCount = Math.min(weightedPick(rng, MASON_COUNT_WEIGHTS), remaining);
  for (let i = 0; i < masonCount; i++) layout.push("mason");
  remaining -= masonCount;

  const counts = {};
  for (let i = 0; i < remaining; i++) {
    const options = DUPLICATABLE_RELICS.map((r) => [r, 1 / ((counts[r] ?? 0) + 1)]);
    const picked = weightedPick(rng, options);
    counts[picked] = (counts[picked] ?? 0) + 1;
    layout.push(picked);
  }

  return shuffle(rng, layout);
}

export function createVillage(rng) {
  const relics = generateRelicLayout(rng, VILLAGE_SIZE);
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
// **누가 그 능력을 쓰는지는 그날 밤 시작 시점의 유물(스냅샷, `actingRelic`)로 딱 한
// 번 정한다** — 다 같이 동시에 능력을 쓰는 거고, 처리(실제 카드 이동)만 순서대로
// 하는 거라고 생각하면 된다. 그래서 도둑이 문제아의 유물을 훔쳐가도, 그 도둑은
// 그날 밤 안에 문제아 능력까지 이어서 쓰지 않는다(원래 자기가 갖고 있던 도둑
// 능력만 씀) — 반대로 문제아 쪽에서 유물을 뺏긴 사람도, 스냅샷에 문제아로
// 기록돼 있으니 그날 밤 예정대로 문제아 능력을 쓴다(카드는 이미 넘어갔어도).
// 카드 이동 자체(relic 값 교환)는 실시간으로 순서대로 일어나므로, 다음 날 밤부터는
// 새로 스냅샷을 떠서 그 결과가 반영된다. belief는 오직 "행동한 사람"만 갱신된다 —
// 도둑맞은 쪽/문제아에게 휘말린 쪽은 아무것도 모른 채 자기가 알던 대로만 계속 믿는다.
// 구성이 무작위라 결계/예지/도둑/문제아/취객 모두 같은 밤에 여러 명 나올 수 있다 —
// 스냅샷에 그 유물로 찍힌 사람 전원이 각자 자기 몫의 능력을 쓴다(한 명뿐이라도
// 동작은 같다). 결계는 항상 짝수로 나오도록 설계돼 있지만, 감옥에 갇혀 이번 밤엔
// 제외되는 경우 홀수가 될 수 있어 마지막 한 명은 짝 없이 남는다.
// 같은 유물을 여럿이 쥐고 있을 때 "누가 먼저 능력을 썼는가"는 villagers 배열의 순서
// (=낮 증언·주민 카드가 뜨는 순서, 절대 재배열되지 않음)를 그대로 따른다 — 그래서
// 결계도 무작위로 짝짓지 않고 그 순서대로 앞에서부터 둘씩 묶는다.
// 밤에 귀 기울여 얽힘 여부를 듣는 건 "카드가 실제로 움직였는가"(대상이 됐거나 자기
// 유물이 바뀜) 기준이다 — 결계는 서로 정체를 아는 것뿐, 아무 유물도 움직이지 않으니
// 소리가 안 남(involvedTonight을 아예 안 켠다).
// 유물(relic)은 계속 유지되지만, belief(자기 인식)는 매일 밤 새로 생긴다 —
// 다들 밤이 시작되기 전에 자기 유물을 스스로 확인하고 들어간다. 그래서:
//  - 능동 유물(예지/도둑/문제아/취객)을 쥔 사람은 그날 밤 실제로 그 능력을 쓰고,
//    belief가 그 행동으로 갱신된다(아래 night* 함수들).
//  - 평범/광기처럼 아무 능력도 없는 유물은 숨길 것도 없으니 그냥 "확인한 그대로"
//    믿는다(`syncPassiveBelief`) — 도둑/문제아한테 능동 유물을 뺏겨 평범/광기가
//    된 사람은 바로 다음 날부터 정확히 그렇게 말한다.
//  - **제물/하수인도 마찬가지다.** 그 유물을 얼떨결에 넘겨받은 사람은 그날 밤
//    확인하는 순간 "헉, 내가 제물?"하며 그때부터 거짓말을 시작하고(`fakeBelief`),
//    반대로 도둑/문제아한테 그 유물을 뺏긴 사람은 "나 이제 아니네" 하고 안심하며
//    다시 진실을 말한다(`isThreat()`가 v.relic을 그대로 봄 — startingRelic이
//    아님). 제물/하수인 유물 자체는 도둑·문제아·취객을 거치며 계속 다른 사람에게
//    넘어갈 수 있다 — "지금" 누가 위험한지, 처형 성공 여부, 승리 조건, 하수인의
//    제물 심기 자격 전부 relic 하나로 판정.
// syncPassiveBelief를 캐스케이드 맨 앞에서 돌리는 이유는, 그날 밤 실제로 능동
// 유물을 얻어 행동하게 되면(예: 확인 직후 도둑맞아 결계가 된 경우) 뒤이은
// night*가 그 belief를 자연스럽게 다시 덮어써야 하기 때문이다.
function syncPassiveBelief(villagers) {
  for (const v of villagers) {
    if (!v.alive || v.jailed) continue;
    if (v.relic === "villager" || v.relic === "madness") {
      v.belief = { role: v.relic };
    }
  }
}

function nightMason(villagers, actingRelic) {
  const masons = villagers.filter((v) => actingRelic.get(v.id) === "mason" && v.alive && !v.jailed);
  for (let i = 0; i + 1 < masons.length; i += 2) {
    const a = masons[i];
    const b = masons[i + 1];
    a.belief = { role: "mason", partnerName: b.name };
    b.belief = { role: "mason", partnerName: a.name };
  }
  if (masons.length % 2 === 1) {
    masons[masons.length - 1].belief = { role: "mason", partnerName: null };
  }
}

function nightSeer(rng, villagers, day, actingRelic) {
  const seers = villagers.filter((v) => actingRelic.get(v.id) === "seer" && v.alive && !v.jailed);
  for (const seer of seers) {
    // 갇힌 사람은 격리돼 있어 남의 능력의 대상도 될 수 없다 — 훔쳐볼 수도, 훔쳐갈 수도 없음.
    const others = villagers.filter((v) => v.alive && !v.jailed && v.id !== seer.id);
    if (others.length === 0) continue;
    const target = pick(rng, others);
    // day를 belief에 찍어둔다 — 이 belief가 "어젯밤" 일어난 일인지, 며칠 전에 굳어버린
    // 오래된 belief인지 낮 증언(CLAIM_LINES)이 구분해서 말할 수 있게 하기 위해서다.
    seer.belief = { role: "seer", targetId: target.id, targetName: target.name, targetRelic: target.relic, day };
    // 예지 자신은 유물도 안 바뀌고 대상도 아니다 — 얽힘은 "보인" 쪽만.
    target.involvedTonight = true;
  }
}

function nightRobber(rng, villagers, day, actingRelic) {
  const robbers = villagers.filter((v) => actingRelic.get(v.id) === "robber" && v.alive && !v.jailed);
  for (const robber of robbers) {
    // 갇힌 사람은 격리돼 있어 남의 능력의 대상도 될 수 없다 — 훔쳐볼 수도, 훔쳐갈 수도 없음.
    // 제물/하수인 유물 자체는 여기서도 다른 유물과 똑같이 훔칠 수 있다(누가 지금
    // 위험한지는 여전히 relic이 정한다) — 다만 그렇게 훔쳐간 사람은 거짓말은 안
    // 한다(아래 isThreat 참고: 거짓말 여부는 그날 밤 최종 relic 기준).
    const others = villagers.filter((v) => v.alive && !v.jailed && v.id !== robber.id);
    if (others.length === 0) continue;
    const target = pick(rng, others);
    [robber.relic, target.relic] = [target.relic, robber.relic];
    // robber는 누구와 바꿨는지는 알지만(주머니 밖 행동), 뭘 받았는지는 안을 안 봐서 모른다.
    // target은 자기 유물이 바뀐 줄도 모른다 — belief 그대로 둔다.
    robber.belief = { role: "robber", swappedWithName: target.name, day };
    // 도둑은 자기 유물도, 대상의 유물도 둘 다 바뀐다 — 그래서 둘 다 얽힘.
    robber.involvedTonight = true;
    target.involvedTonight = true;
  }
}

function nightTroublemaker(rng, villagers, day, actingRelic) {
  const troublemakers = villagers.filter((v) => actingRelic.get(v.id) === "troublemaker" && v.alive && !v.jailed);
  for (const troublemaker of troublemakers) {
    // 갇힌 사람은 격리돼 있어 남의 능력의 대상도 될 수 없다 — 훔쳐볼 수도, 훔쳐갈 수도 없음.
    const others = villagers.filter((v) => v.alive && !v.jailed && v.id !== troublemaker.id);
    if (others.length < 2) continue;
    const [a, b] = shuffle(rng, others);
    [a.relic, b.relic] = [b.relic, a.relic];
    troublemaker.belief = { role: "troublemaker", targetName: a.name, targetName2: b.name, day };
    // 문제아 자신의 유물은 그대로다 — 유물이 실제로 바뀐 a, b만 얽힘.
    a.involvedTonight = true;
    b.involvedTonight = true;
  }
}

function nightDrunk(rng, villagers, box, day, actingRelic) {
  const drunks = villagers.filter((v) => actingRelic.get(v.id) === "drunk" && v.alive && !v.jailed);
  for (const drunk of drunks) {
    box.push(drunk.relic);
    drunk.relic = drawFromBox(rng, box) ?? drunk.relic; // 방금 넣었으니 박스가 비어있을 리 없음
    drunk.belief = { role: "drunk", day };
    drunk.involvedTonight = true;
  }
}

// 제물/하수인도 평범/광기와 마찬가지로 매일 밤 자기 유물을 스스로 확인하고 들어간다
// (syncPassiveBelief와 같은 원리 — 유물은 유지되지만 belief는 매일 밤 새로 생긴다).
// 그래서 도둑/문제아한테 그 유물을 뺏기면 바로 다음 날부터 "나 이제 제물 아니네"
// 하고 안심하며 진실을 말하고(isThreat() 참고 — v.relic 기준), 반대로 얼떨결에
// 그 유물을 받은 사람은 그날 밤 확인하고서야 "헉, 내가 제물?" 하고 그 순간부터
// 거짓말을 시작한다. claimRole(사칭 대상)만 한 번 정해지면 안 바뀐다 — 매일 같은
// 거짓말쟁이 정체를 유지해야 앞뒤가 맞으니까. 사칭의 "구체적 근거"(누굴 봤다,
// 누구랑 바꿨다 등)는 매일 밤 새로 지어낸다 — 진짜 능력이 있는 척하려면 매일
// 그럴듯한 최신 정보를 대야 하기 때문이다(로버만 예외 — 원래도 "모른다"가
// 정답이라 지어낼 필요가 없다).
function refreshFakeBeliefs(rng, villagers, box, day) {
  const honestPresent = [...new Set(villagers.map((v) => v.relic))].filter((r) => HONEST_RELICS.includes(r));
  const villagerPool = honestPresent.length > 0 ? honestPresent : ["villager"];
  const boxPool = [...new Set(box)].filter((r) => HONEST_RELICS.includes(r));
  const minionPool = boxPool.length > 0 ? boxPool : ["villager"];

  for (const v of villagers) {
    if (v.relic !== "sacrifice" && v.relic !== "minion") continue;
    if (!v.claimRole) v.claimRole = pick(rng, v.relic === "sacrifice" ? villagerPool : minionPool);

    const role = v.claimRole;
    const others = villagers.filter((o) => o.alive && o.id !== v.id);
    // 사칭은 매일 새로 지어내므로 항상 "어젯밤" 방금 일어난 일처럼 말한다(day를 오늘로 찍음).
    const fake = { role, day };
    if (role === "seer") {
      if (others.length > 0) {
        const t = pick(rng, others);
        fake.targetId = t.id;
        fake.targetName = t.name;
        fake.targetRelic = pick(rng, ALL_RELICS); // 근거 없이 지어낸 유물 — 진짜와 다를 수 있음
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

// 거짓말 여부도 지금 실제로 뭘 들고 있는지(v.relic)로 정한다 — 매일 밤 자기 유물을
// 스스로 확인하고 들어가기 때문에(refreshFakeBeliefs 참고), "원래" 뭐였는지는
// 상관없다.
function isThreat(v) {
  return v.relic === "sacrifice" || v.relic === "minion";
}

// 낮 증언 한 줄 — belief(또는 사칭이면 fakeBelief)를 그대로 문장으로 옮긴다.
// 같은 유물을 주장하는 사람이 정원(ROLE_SLOTS)보다 많으면 그 자체가 추궁 단서.
// 갇혀 있던 사람은 애초에 어젯밤 아무 능력도 못 썼으니(사칭이든 진짜든) belief를
// 참고할 필요 없이 갇혀 있었다는 사실 그대로만 말한다.
function buildPendingClaim(rng, speaker, day) {
  const threat = !speaker.jailed && isThreat(speaker);
  const belief = speaker.jailed ? { role: "jailed" } : threat ? speaker.fakeBelief : speaker.belief;
  if (!belief) return null;

  const role = belief.role;
  // belief.day가 오늘(day)과 다르면 며칠 전에 굳어버린 오래된 belief라는 뜻 — 도둑/문제아
  // 한테 유물을 뺏겨서 그 뒤로 한 번도 다시 행동한 적이 없는 경우다(예: 그날 밤 예지가
  // 정확히 지금 유물을 봤다고 말하는데, 정작 본인은 며칠 전 얘기를 "어젯밤"이라고
  // 하면 앞뒤가 안 맞는다 — CLAIM_LINES가 day 차이를 보고 표현을 다르게 골라준다).
  const line = (CLAIM_LINES[role] || CLAIM_LINES.villager)(belief, day);
  let mood = "";
  if (threat) mood = " " + pick(rng, CORRUPTED_MOOD);
  else if (role === "villager" && rng() < 0.3) mood = " " + pick(rng, NERVOUS_MOOD);

  return {
    phase: "day",
    text: `${speaker.name}: "${line}"${mood}`,
    meta: { kind: "claim", speakerId: speaker.id, claimedRole: role, targetId: belief.targetId, targetRelic: belief.targetRelic },
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

  // 그날 밤 시작 시점의 유물 스냅샷 — "누가 그 능력을 쓰는가"는 이 스냅샷 하나로
  // 고정한다(다 같이 동시에 능력을 쓰고, 카드 이동 처리만 순서대로 하는 것).
  const actingRelic = new Map(villagers.map((v) => [v.id, v.relic]));

  // 능동 유물 캐스케이드보다 먼저 — 아래 night*가 그날 밤 실제로 행동하게 된 사람의
  // belief를 자연스럽게 덮어쓸 수 있도록.
  syncPassiveBelief(villagers);
  nightMason(villagers, actingRelic);
  nightSeer(rng, villagers, state.day, actingRelic);
  nightRobber(rng, villagers, state.day, actingRelic);
  nightTroublemaker(rng, villagers, state.day, actingRelic);
  nightDrunk(rng, villagers, box, state.day, actingRelic);
  refreshFakeBeliefs(rng, villagers, box, state.day);

  const pendingClaims = [];
  for (const speaker of villagers.filter((v) => v.alive)) {
    const claim = buildPendingClaim(rng, speaker, state.day);
    if (claim) pendingClaims.push({ day: state.day, ...claim });
  }

  const nightInvolvement = villagers.filter((v) => v.alive && v.involvedTonight).map((v) => v.id);

  return { ...state, villagers, box, phase: "night", pendingClaims, nightInvolvement, nightListenedId: null, log };
}

// 밤에 딱 한 사람에게만 귀 기울일 수 있다 — 한 번 고르면 그날 밤은 그걸로 끝.
// 그 사람이 오늘 밤 능력에 얽혔으면(행위자든 대상이든) 웅성거림이, 아니면 정적이 들린다.
export function listenTo(state, id) {
  if (state.phase !== "night" || state.nightListenedId) return state;
  const target = state.villagers.find((v) => v.id === id);
  if (!target) return state;

  const involved = (state.nightInvolvement || []).includes(id);
  return {
    ...state,
    nightListenedId: id,
    log: [...state.log, { day: state.day, phase: "night", text: nightListenLine(target.name, involved) }],
  };
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
  if (state.status !== "playing" || state.phase !== "day") return state;
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
  if (state.status !== "playing" || state.phase !== "day") return state;
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

// 처형은 두 단계다: execute()는 "처형했다"만 보여주고 결과를 pendingResolution에
// 감춰둔다. 플레이어가 "계속"을 누르면 continueAfterExecution()이 그걸 편다 —
// 결과(성공/실패/연출)가 처형 그 자체와 동시에 보이지 않게 하기 위해서다.
export function execute(state, id, rng) {
  const target = state.villagers.find((v) => v.id === id);
  if (!target || state.status !== "playing" || state.phase !== "day") return state;

  const deadVillagers = state.villagers.map((v) => (v.id === id ? { ...v, alive: false } : v));
  const log = [
    ...state.log,
    { day: state.day, phase: "day", text: `장로가 ${target.name}을(를) 제물로 처형했다.`, meta: { kind: "execution" } },
  ];

  // resolveExecution이 이어 붙일 로그는 별도 복사본에 쓴다 — 지금 당장 보여줄 log와
  // 섞이면 "처형했다"와 동시에 결과까지 새어 보이게 된다.
  const pendingResolution = resolveExecution(state, target, [...log], deadVillagers, rng);

  return { ...state, villagers: deadVillagers, log, phase: "executed", pendingResolution };
}

export function continueAfterExecution(state) {
  if (state.phase !== "executed" || !state.pendingResolution) return state;
  return state.pendingResolution;
}

function resolveExecution(state, target, log, villagers, rng) {
  const isRealSacrifice = target.relic === "sacrifice";
  const isMadnessDecoy = target.relic === "madness";
  let box = [...state.box, target.relic];

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
  state = continueAfterExecution(state); // 봇은 "처형했다" 중간 화면 없이 바로 다음 상태로
  game.state = state;
}

export function isGameOver(game) {
  return game.state.status !== "playing";
}

export function getResult(game) {
  return { winner: game.state.status, turns: game.state.day };
}
