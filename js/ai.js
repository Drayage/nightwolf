// 봇/시뮬레이터용 장로 의사결정 — 낮 증언(state.log의 claim들)만 보고 판단한다.
// scripts/simulate.mjs가 "제대로 추리하면 풀리는 퍼즐인지"를 검증할 때 쓰고,
// 나중에 봇전 모드를 붙일 때도 이 정책을 재사용할 수 있다.
//
// 핵심 신호 세 가지:
//  1) 유일 배정 유물(ROLE_SLOTS)을 정원보다 많은 사람이 주장하면, 그중 최소 하나는
//     사칭(제물/하수인)이다 — 주장이 겹친 사람 전원에게 혐의를 둔다.
//  2) 예지/도둑의 유물을 "정직하게" 주장하는 사람이 지목한 대상이 "이상했다"고 하면
//     그 대상도 혐의자다 (단, 그 진술 자체가 사칭일 수도 있으니 100% 신뢰는 아님).
//  3) "나는 몽롱한 유물이다"라는 주장은 100% 거짓이다 — 진짜 취객은 자기가 취객인 줄
//     모르기 때문에 스스로 그렇게 주장할 일이 없다(js/engine.js resolveClaimRole 참고).
import { ROLE_SLOTS } from "./data/relics.js";

function latestClaimsBySpeaker(state) {
  const claims = new Map();
  for (const entry of state.log) {
    const meta = entry.meta;
    if (meta?.kind !== "claim") continue;
    claims.set(meta.speakerId, meta); // 같은 사람은 매일 같은 주장을 하므로 마지막 값이면 충분
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
      for (const id of speakerIds) bump(id, 2); // 정원 초과 — 겹친 사람 전원 혐의
    }
  }
  for (const [speakerId, claim] of claims) {
    if (claim.targetId && claim.strange) bump(claim.targetId, 1);
    if (claim.claimedRole === "drunk") bump(speakerId, 3); // 확정 거짓 주장
  }

  const ranked = [...alive].sort((a, b) => (suspicion[b.id] || 0) - (suspicion[a.id] || 0));
  const executeTarget = ranked[0];
  const jailTarget = ranked.find((v) => v.id !== executeTarget.id && (suspicion[v.id] || 0) > 0 && !v.jailed);

  return { executeId: executeTarget.id, jailId: jailTarget?.id ?? null };
}
