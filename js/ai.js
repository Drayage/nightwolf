// 봇/시뮬레이터용 장로 의사결정 — 낮 증언(state.log의 claim들)만 보고 판단한다.
// scripts/simulate.mjs가 "제대로 추리하면 풀리는 퍼즐인지"를 검증할 때 쓰고,
// 나중에 봇전 모드를 붙일 때도 이 정책을 재사용할 수 있다.
//
// 핵심 신호 두 가지:
//  1) 예지의 유물을 "정직하게" 주장하는 사람이 지목한 대상이 정확히 어떤 유물을
//     봤는지 말하므로, 그게 제물/하수인이면 그 대상이 강하게 의심스럽다(단, 그
//     진술 자체가 사칭일 수도 있으니 100% 신뢰는 아님).
//  2) 유일 배정 유물(ROLE_SLOTS)을 정원보다 많은 사람이 주장하면 그중 최소 하나는
//     사칭이다 — 다만 마을 구성이 이제 무작위라(같은 유물이 여러 명일 수 있음)
//     신호가 약해졌으므로 가중치를 낮게 둔다.
// 도둑/문제아/취객이 밤마다 실제로 유물을 바꾸므로 누구의 주장이든 날마다 달라질 수
// 있다 — 그래서 각 화자의 "가장 최근" 주장만 오늘의 판단 근거로 쓴다.
import { ROLE_SLOTS } from "./data/relics.js";

function latestClaimsBySpeaker(state) {
  const claims = new Map();
  for (const entry of state.log) {
    const meta = entry.meta;
    if (meta?.kind !== "claim") continue;
    claims.set(meta.speakerId, meta); // 뒤에 나온 값이 더 최신이므로 계속 덮어쓴다
  }
  return claims;
}

export function decideElderMove(state) {
  const alive = state.villagers.filter((v) => v.alive);
  const claims = latestClaimsBySpeaker(state);

  const bySpeakerOfRole = new Map();
  for (const [speakerId, claim] of claims) {
    if (!bySpeakerOfRole.has(claim.claimedRole)) bySpeakerOfRole.set(claim.claimedRole, []);
    bySpeakerOfRole.get(claim.claimedRole).push(speakerId);
  }

  const suspicion = {};
  const bump = (id, n) => {
    suspicion[id] = (suspicion[id] || 0) + n;
  };

  for (const [role, speakerIds] of bySpeakerOfRole) {
    const slots = ROLE_SLOTS[role];
    if (slots && speakerIds.length > slots) {
      for (const id of speakerIds) bump(id, 1); // 정원 초과 — 겹친 사람 전원 혐의(약한 신호)
    }
  }
  for (const claim of claims.values()) {
    if (claim.targetId && (claim.targetRelic === "sacrifice" || claim.targetRelic === "minion")) {
      bump(claim.targetId, 3); // 정확한 유물명을 봤다는 주장 — 훨씬 강한 신호
    }
  }

  const ranked = [...alive].sort((a, b) => (suspicion[b.id] || 0) - (suspicion[a.id] || 0));
  const executeTarget = ranked[0];
  const jailTarget = ranked.find((v) => v.id !== executeTarget.id && (suspicion[v.id] || 0) > 0 && !v.jailed);

  return { executeId: executeTarget.id, jailId: jailTarget?.id ?? null };
}
