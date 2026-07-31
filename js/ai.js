// 봇/시뮬레이터용 장로 의사결정 — 예지의 유물이 남긴 단서(state.log)만 보고 판단한다.
// scripts/simulate.mjs가 "제대로 추리하면 풀리는 퍼즐인지"를 검증할 때 쓰고,
// 나중에 봇전 모드를 붙일 때도 이 정책을 재사용할 수 있다.
//
// 예지의 유물은 절대 거짓을 말하지 않으므로: "평범했다"고 밝혀진 사람은 영구히 제외하고,
// "이상했다"고 밝혀진 사람 중에서만 고른다. 이상한 사람이 둘 이상 모이면 그 둘 중
// 하나는 반드시 제물/하수인 조합이므로 하나는 가두고 하나는 처형한다(그래도 5할 도박).
// 단서가 없으면 강제로 아무나 처형해야 하는 판(원작 원나잇처럼 정보가 부족한 초반)도 있다.

function classify(state) {
  const strange = new Set();
  const cleared = new Set();
  for (const entry of state.log) {
    const meta = entry.meta;
    if (meta?.kind !== "seer-report") continue;
    if (meta.strange) strange.add(meta.targetId);
    else cleared.add(meta.targetId);
  }
  for (const id of cleared) strange.delete(id); // 나중에 "평범함"이 밝혀지면 혐의 해제
  return { strange, cleared };
}

export function decideElderMove(state) {
  const alive = state.villagers.filter((v) => v.alive);
  const { strange, cleared } = classify(state);

  const suspects = alive.filter((v) => strange.has(v.id));
  const unknown = alive.filter((v) => !strange.has(v.id) && !cleared.has(v.id));

  if (suspects.length >= 2) {
    // 둘 다 혐의자면 하나는 확실히 제물/하수인 조합 — 하나는 가두고 하나는 처형(그래도 5할).
    return { executeId: suspects[0].id, jailId: suspects[1].id };
  }
  if (suspects.length === 1) {
    // 혐의자는 가둬서 살려둔다(처형해버리면 두 번째 혐의자가 나올 때까지 못 기다림).
    // 처형은 어차피 매일 강제이므로 나머지 미상 인물 중에서 어쩔 수 없이 도박한다.
    const suspect = suspects[0];
    const blindPool = unknown.length > 0 ? unknown : alive.filter((v) => v.id !== suspect.id);
    const guess = blindPool[0] ?? suspect;
    return { executeId: guess.id, jailId: suspect.jailed ? null : suspect.id };
  }
  // 단서가 아직 없다면 세탁된(cleared) 사람을 뺀 나머지 중에서 어쩔 수 없이 고른다.
  const fallback = unknown.length > 0 ? unknown : alive;
  return { executeId: fallback[0].id, jailId: null };
}
