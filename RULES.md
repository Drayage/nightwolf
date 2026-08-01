# 게임 규칙 명세 (Ground Truth)

이 문서는 `js/engine.js` / `js/data/relics.js`의 실제 동작을 그대로 옮긴 것이다.
헷갈리면 기억이 아니라 **이 문서와 코드**부터 다시 확인할 것. 엔진 로직을 고치면
이 문서도 반드시 같이 고칠 것.

## 0. 절대 원칙 하나 — `actingRelic` 스냅샷

> **"그날 밤 무엇을 하는가"와 "그날 밤 위협인지 아닌지"는 전부 `actingRelic`
> 스냅샷 하나로만 정해진다. 그 밤 안에서 카드가 실시간으로 아무리 오가도 이
> 판정 자체는 절대 안 바뀐다.**

- 스냅샷 시점: `runNightPhase`에서 `deliverBoxSacrifice` 실행 **직후**, 캐스케이드
  (결계→...→선잠) 시작 **직전**. `const actingRelic = new Map(villagers.map(v => [v.id, v.relic]))`.
- 이 스냅샷이 결정하는 것:
  - 그날 밤 어떤 능력을 쓰는가 (`night*` 함수들이 `actingRelic.get(v.id) === "역할"`로 필터링)
  - 그날 밤 위협(거짓말 대상)인가 (`isThreat`)
  - 그날 밤 평범/광기로서 belief를 리셋하는가 (`syncPassiveBelief`)
- 이 스냅샷이 결정하지 **않는** 것: 실제 relic 교환 자체. 카드 이동(누가 뭘 받는지)은
  캐스케이드 안에서 실시간·순서대로 일어난다. 그래서 밤 중간에 카드를 "받기만" 한
  사람은 그 유물의 능력을 그날 못 쓰고, 그 유물에 대한 belief도 안 생긴다 —
  스냅샷에 안 찍혀 있으면 없는 일이다.
- 다음 밤이 되면 스냅샷은 버려지고 처음부터 새로 뜬다.
- **비유**: 다들 밤이 시작되기 전에 동시에 자기 주머니를 확인하고 잠든다. 그 확인한
  내용으로 각자 할 일(능력 사용/거짓말/침묵)이 정해진다. 카드가 자는 동안 손에서
  손으로 넘어가는 건 순서대로 일어나지만, "누가 무슨 꿈을 꾸는가"는 잠들기 전
  확인한 내용 하나로 이미 정해져 있다.

## 1. 마을 구성 (`createVillage` / `generateRelicLayout`)

- 인원: **11명** (`VILLAGE_SIZE`)
- 제물 1명 + 하수인 1명 — **항상 정확히 1명씩** 고정 배정
- 결계: **0 / 2 / 4명** 중 가중치 추첨(2가 가장 흔함) — 항상 짝수
- 나머지 자리: 예지/도둑/문제아/취객/광기/평범/선잠 중 **자리마다 독립적으로** 추첨
  (`DUPLICATABLE_RELICS`) — 이미 나온 유물일수록 가중치 낮아짐(완전 차단은 아님)
  - **어떤 유물이 아예 안 나올 수도, 여러 명 겹칠 수도 있다.** `ROLE_SLOTS`는
    "정확히 그 인원수만큼 나온다"는 보장이 **아니라** 봇 추리용 대충의 기본값일 뿐.
  - 그래서 밤 캐스케이드 함수(`nightMason`/`nightSeer`/`nightRobber`/`nightTroublemaker`/
    `nightDrunk`/`nightInsomniac`)는 전부 그 유물을 쥔 사람 **전원**을 순회해야 한다.
    `.find()`로 한 명만 처리하면 중복 인원의 belief가 안 채워져 낮 증언이 깨진다.
- 유물함(`box`) 초기값: 평범 3장(`BOX_SEED`) + 제물 1장

## 2. 두 층위의 진실: `relic` vs `belief`

| | `villager.relic` | `villager.belief` (위협이면 `fakeBelief`) |
|---|---|---|
| 뜻 | 기계적으로 "지금 실제 정체" | "본인이 기억하는 자기 모습" |
| 결정하는 것 | 위협 여부(스냅샷 기준)·처형 성공·승리조건 — **전부 이 실시간 값 하나로만** | 낮 증언(`buildPendingClaim`)은 **오직 여기서만** |
| 언제 바뀌나 | 밤 캐스케이드 중 실시간 교환 | 자기가 "그 능력을 실제로 그날 밤 썼을 때"만 (또는 스냅샷이 평범/광기일 때) |

말하는 유물과 실제 유물이 다를 수 있는 이유: 유물은 주머니 속에 있어 아무도 지금
자기가 뭔지 안 보고, 스냅샷 기준으로 "직접 행동"했을 때만 belief가 갱신된다.

## 3. 밤 순서 (`runNightPhase`)

```
1. deliverBoxSacrifice(rng, villagers, box)   ← 제물 재분배, 스냅샷 이전
2. ★ actingRelic 스냅샷 뜸 (여기가 기준점) ★
3. nightMason
4. nightSeer
5. nightRobber
6. nightTroublemaker
7. nightDrunk
8. nightInsomniac                              ← 원작에 없던 확장, 맨 마지막
9. syncPassiveBelief(villagers, day, actingRelic)
10. refreshFakeBeliefs(rng, villagers, box, day, actingRelic)
11. buildPendingClaim × 생존자 전원 → pendingClaims (아직 비공개)
```

순서가 실제로 중요하다 — 예: 도둑이 문제아의 카드를 훔쳐가도, 그 도둑은 이미
스냅샷에 "도둑"으로 찍혀 있으니 도둑 능력만 쓰고 문제아 능력은 안 이어서 쓴다.
반대로 카드를 뺏긴 문제아는 스냅샷에 "문제아"로 찍혀 있으니 그날 밤 예정대로
문제아 능력을 쓴다(카드는 이미 넘어갔어도).

## 4. 유물별 동작

| 유물 | 스냅샷 조건(누가 하는가) | 하는 일 | 실제 relic 교환 | belief |
|---|---|---|---|---|
| 결계 | `actingRelic === "mason"` | villagers 배열 순서대로 둘씩 짝지어 서로 이름을 앎. 카드 이동 없음(`involvedTonight` 안 켬) | 없음 | `{role:"mason", partnerName, day}` (홀수면 마지막 1명은 `partnerName:null`) |
| 예지 | `=== "seer"` | 무작위 1명의 **실제 relic**을 봄 | 없음 | `{role:"seer", targetId, targetName, targetRelic, day}` |
| 도둑 | `=== "robber"` | 무작위 1명과 relic **통째로 교환**. 자기가 뭘 받았는지는 모름 | 있음(본인 ↔ 대상) | `{role:"robber", swappedWithName, day}` (대상의 belief는 안 건드림) |
| 문제아 | `=== "troublemaker"` | 자신 뺀 무작위 2명의 relic을 서로 교환. 본인 relic은 그대로 | 있음(대상 2명끼리) | `{role:"troublemaker", targetName, targetName2, day}` |
| 취객 | `=== "drunk"` | 자기 relic을 유물함에 넣고 무작위로 하나 뽑음. 뭘 받았는지 모름 | 있음(본인 ↔ 유물함) | `{role:"drunk", day}` |
| **선잠의 유물** | `=== "insomniac"` | 캐스케이드 **전부 끝난 뒤** 자기 relic(그 시점 실시간 값!)을 확인 | 없음(관찰만) | `sacrifice`/`minion`이면 `HONEST_RELICS`에서 무작위로 하나 골라 거짓말, 아니면 정직 → `{role:"insomniac", sawRelic, day}` |
| 평범/광기 | `=== "villager"` / `"madness"` | 능력 없음 | 없음 | `syncPassiveBelief`가 스냅샷 값 그대로 되찍음(`day` 필드 없음) |
| 제물/하수인 | `=== "sacrifice"` / `"minion"` | 능력 없음, 위협으로 분류 | 없음(본인은) | `refreshFakeBeliefs`가 매일 새 `fakeBelief` 생성 |

**갇힌 사람은 전부 스킵** — 모든 `night*` 함수가 `!v.jailed`로 걸러냄. 능력도
못 쓰고 남의 능력의 대상도 못 됨.

## 5. `syncPassiveBelief` — 스냅샷 기준 (실시간 relic 아님!)

```js
function syncPassiveBelief(villagers, day, actingRelic) {
  for (const v of villagers) {
    if (!v.alive || v.jailed) continue;
    const startedTonightAs = actingRelic.get(v.id);
    if (startedTonightAs === "villager" || startedTonightAs === "madness") {
      v.belief = { role: startedTonightAs };
    }
  }
}
```

- **스냅샷이 평범/광기였던 사람만** 리셋됨. 캐스케이드 도중 얼떨결에 평범/광기
  카드를 "받기만" 한 사람은 리셋 **안 됨** — 그날은 원래(스냅샷) 자기 모습을
  계속 말하고, 다음 밤 자기 확인에서야 반영된다.
- 과거에 실시간 `v.relic` 기준으로 짰던 적이 있었는데 **원칙 위반**이었다: (a) 확인한
  적도 없는 새 정체를 그날 바로 말해버리는 버그, (b) 받은 카드가 평범/광기가 아닌
  다른 능동 유물이면 리셋 자체가 안 걸려서 며칠 전 낡은 belief가 새는 버그. 반드시
  스냅샷 기준으로 유지할 것.
- 스냅샷이 평범/광기인 사람은 다른 어떤 `night*` 함수에도 안 걸리므로 `belief.day`가
  미리 오늘로 찍혀 있을 수 없다 — "이미 오늘 행동했으면 건드리지 마라" 가드가 필요 없다.

## 6. 낮 증언 결정 로직 (`buildPendingClaim`)

우선순위 하나만 있으면 끝:

```
1. speaker.jailed 면          → CLAIM_LINES.jailed (belief 안 봄)
2. isThreat(speaker, actingRelic) 면  → speaker.fakeBelief
3. 그 외                      → speaker.belief
```

`isThreat`도 `actingRelic` 스냅샷만 본다(startingRelic도, 실시간 relic도 아님).

## 7. `recency(belief, day)` — "어젯밤" vs "예전에"

`belief.day === 오늘`이면 "어젯밤", 아니면 "예전에". 며칠 묵은 belief를 "어젯밤"
이라 말하면 다른 증거와 모순될 수 있어서 존재.

| 유물 | `recency()` 필요한가 | 이유 |
|---|---|---|
| 예지/도둑 | 필요(안전장치) | 다른 생존자가 0명이면 그날 밤 행동 불가 → belief가 묵을 수 있음. **단, `VILLAGE_SIZE=11`·`maxDays=7` 조합에선 7일간 최대 6번만 처형되므로 밤마다 최소 5명 생존 → 구조적으로 항상 1명은 확보돼 실제로는 절대 안 걸림.** 밸런스 상수를 바꾸면 다시 걸릴 수 있어서 남겨둠. |
| 문제아 | 필요(안전장치) | 위와 동일, 단 "다른 생존자 2명 미만"이 기준. 같은 이유로 현재 상수에선 실제로 안 걸림. |
| **선잠의 유물** | **불필요 — 제거함** | 대상이 필요한 능력이 아니라 자기 확인이라 "대상 부족"으로 못 쓰는 경우 자체가 없음. 갇힌 밤은 `CLAIM_LINES.jailed`로 따로 빠짐. `syncPassiveBelief`가 스냅샷 기준으로 고쳐진 뒤로는, 모든 relic 값이 (능동 유물 함수 / `syncPassiveBelief` / `fakeBelief`) 중 정확히 하나로만 처리되므로 belief가 스냅샷과 어긋난 채 새어 나오는 경로가 구조적으로 없다. `CLAIM_LINES.insomniac`에 도달하는 belief는 밸런스 상수와 무관하게 항상 오늘 것뿐 — 그래서 `recency()` 없이 "어젯밤"으로 고정. |
| 결계/평범/광기 | 사용 안 함 | 애초에 `day`에 의존하지 않는 정적인 대사(결계는 매일 스냅샷 기준으로 다시 짝지어짐) |
| 제물/하수인(`fakeBelief`) | 사용 안 함(항상 "어젯밤") | 사칭은 매일 새로 지어내므로 `day`가 항상 오늘 |

## 8. 감옥

- **한 자리뿐** — `jail()`이 새 대상을 가두면 이전 수감자는 자동 석방.
- 갇힌 사람: 모든 `night*` 함수의 대상도, 행위자도 못 됨. 낮엔 belief 무시하고
  무조건 `CLAIM_LINES.jailed` 사용.

## 9. 제물의 유물 — 최대 2개 상한

- **총량은 게임 전체에서 절대 2개를 넘지 않는다**: 시작할 때 1명이 들고 시작 +
  `createVillage`가 유물함에 미리 심어두는 여분 1개.
- 하수인이 갇혀있지 않고 유물함에 제물의 유물이 있으면 → `deliverBoxSacrifice`가
  **매일 밤 캐스케이드보다 먼저** 무작위 생존자 1명에게 심는다(원래 유물은 유물함으로).
- **처형된 제물의 유물도 다른 유물과 똑같이 유물함으로 돌아간다**(`resolveExecution`).
  이게 핵심 — 하수인이 계속 자유로우면 방금 처형한 유물이 다음 밤 곧바로 또 다른
  사람에게 심겨 위협이 끊이지 않는다. **하수인을 못 잡은 채로는 상관없는 처형만으로
  절대 못 끝낸다.**
- 하수인을 가두는 순간 `deliverBoxSacrifice`가 멈추고, 그때 살아있는 나머지
  (최대 2명)만 처형하면 끝.
- (예전에 "처형할 때마다 무조건 하나 더 심는" 별도 로직이 있었는데 무한 복제되어
  절대 못 이기는 판이 만들어졌었다 — 제거됨. 지금은 재분배 하나뿐이고 총량이
  절대 안 늘어남.)
- 광기의 유물 처형은 실제로는 아무 제물도 못 없애면서 성공처럼 보이는 위장일 뿐,
  그 자체로 새 제물을 심는 계기는 아님(제물 심기는 오직 `deliverBoxSacrifice` 하나).

## 10. 처형 / 승패

- 매일 처형 필수. 대상이 `relic==='sacrifice'`(진짜)거나 `'madness'`(위장 성공)면
  통과, 그 외엔 즉시 패배(`RITUAL_FAILURE_TEXT` 연출).
- **처형은 2단계**: `execute()`는 "처형했다" 로그만 남기고 `phase:'executed'`로
  멈춘다. `continueAfterExecution()`을 호출해야 결과(성공/실패/위장)가 드러남.
  봇/시뮬레이터는 `stepGame()`이 바로 이어서 호출.
- 승리: 살아있는 `relic==='sacrifice'` 소지자 0명 **AND** 하수인이 갇혀있거나 죽음.
- 7일(`maxDays`) 안에 못 끝내면 패배(`TIMEOUT_FAILURE_LINE`).
- 실패 시 결말 화면에 3열 표(`buildRevealTable`): **처음 시작 유물 / 그날 밤 시작
  유물(=마지막으로 처리된 밤의 `actingRelic` 스냅샷, `state.nightStartRelic`) /
  최종 유물**. 로그와 대조해서 정확히 어느 단계에서 어긋났는지 이 3열로 짚어낼 수 있음.

## 11. 밤/낮 페이즈 분리

- 밤엔 캐스케이드+그날 증언이 전부 미리 계산되지만(`pendingClaims`) 공개 안 됨.
- 플레이어는 밤에 **딱 한 명만** 짚어 귀 기울일 수 있음(`listenTo`,
  `state.nightListenedId`로 잠금). 그 사람이 오늘 밤 능력에 얽혔으면(행위자든
  대상이든, `state.nightInvolvement`) 소리+글이 남고, 아니면 정적.
- "낮이 밝았다" → `revealDay()`가 `pendingClaims`를 `log`에 공개하고 `phase:'day'`로.

## 12. 자주 헷갈리는 포인트 (Q&A)

**Q. 밤중에 어떤 유물을 도둑/문제아한테 "받기만" 한 사람은 그 유물 능력을 그날 밤 쓰나?**
A. 아니다. 절대 아니다. `actingRelic` 스냅샷(그날 밤 시작 시점)에 안 찍혀 있으면
그 능력은 그날 못 쓴다 — 무슨 유물이든 예외 없음.

**Q. 그 사람은 그날 낮에 뭐라고 말하나?**
A. 스냅샷 기준 원래 자기 모습. 스냅샷이 평범/광기였으면 "저는 평범한 유물이에요" /
"저는 광기의 유물이에요"를 말하고, 스냅샷이 다른 능동 유물이었으면 그 유물의 능력을
그대로 써서 그 결과를 말한다(카드를 나중에 받은 건 그 증언에 아무 영향 없음).

**Q. 처형된 제물의 유물, 유물함으로 돌아가나 안 돌아가나?**
A. **돌아간다.** 안 돌아가면 하수인을 못 잡아도 아무나 2명 처형하면 끝나버리는
구멍이 생긴다(예전에 실수로 이렇게 만들었다가 되돌림). 돌아가야 하수인이 자유로운
한 계속 재분배되어 "하수인을 못 잡으면 절대 못 끝난다"는 규칙이 성립한다.

**Q. 제물의 유물이 3개, 4개로 늘어날 수 있나?**
A. 아니다. 총량은 시작 1개 + 유물함 여분 1개 = 2개로 하드 캡. 재분배는 이 2개
사이에서 순환할 뿐 새로 만들어내지 않는다.

**Q. 선잠의 유물이 "예전에" 확인했다고 말할 수 있나?**
A. 이론상 없다(현재 코드 기준). `syncPassiveBelief`가 스냅샷 기준으로 고쳐진 뒤로는
모든 relic 값이 정확히 하나의 경로로만 처리되고, 선잠의 유물은 대상 없이 스스로
확인하는 능력이라 "대상 부족"으로 확인을 놓치는 경우도 없다. 그래서 실제로
`CLAIM_LINES.insomniac`에 도달하는 belief는 항상 그날 밤 것뿐이다.

**Q. 예지/도둑/문제아는 "예전에" 확인했다고 말할 수 있나?**
A. **구조적으로는 불가능하지 않다** — 다른 생존자가 부족하면(예지/도둑은 0명,
문제아는 2명 미만) 그날 밤 능력을 못 써서 belief가 묵는다. 다만 현재 밸런스 상수
(`VILLAGE_SIZE=11`, `maxDays=7`)에서는 이 조건이 절대 발생하지 않는다(밤마다 최소
5명 생존 보장). 상수를 바꿀 계획이 있으면 이 가정부터 재검토할 것.

**Q. 광기의 유물을 처형하면 뭐가 심어지나?**
A. 아무것도 안 심어진다. 성공한 것처럼 보이는 위장일 뿐, 제물 심기는 오직
`deliverBoxSacrifice`(매일 밤 시작 전) 하나로만 일어난다.

## 13. 밸런스 상수 요약

| 상수 | 값 | 위치 |
|---|---|---|
| `VILLAGE_SIZE` | 11 | `js/data/relics.js` |
| `maxDays` | 7 | `js/engine.js` `startRun` |
| 제물의 유물 총량 상한 | 2 | `createVillage`의 `BOX_SEED` + `sacrifice` 시딩 |
| 감옥 자리 수 | 1 | `jail()` |
| 밤 캐스케이드 순서 | 결계→예지→도둑→문제아→취객→선잠 | `runNightPhase` |

이 상수들을 바꾸면 §7의 "예지/도둑/문제아 recency 안전장치가 실제로 안 걸린다"는
가정과 §9의 사슬(2일이면 끝난다는 계산)이 깨질 수 있으니, 바꾼 뒤엔 반드시
`scripts/simulate.mjs`를 돌려서 교착 0 / 승률 붕괴 없음을 재확인할 것.
