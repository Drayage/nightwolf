// 콘텐츠 데이터 (로직과 분리) — 유물/이름/증언/스토리 텍스트.
// 새 유물 능력을 추가할 때는 여기 RELIC_INFO/DEFAULT_RELIC_LAYOUT/CLAIM_LINES에
// 항목만 늘리고, 실제 대사 조립·판정은 js/engine.js에서 한다.

export const TITLE = "붉은달의 의식";

export const INTRO_TEXT = [
  "마을의 결계를 지키는 유물을 주고받는 밤의 의식이 열린다.",
  "그러나 누군가 외부에서 마을을 파멸시킬 [제물의 유물]을 몰래 들여왔다.",
  "장로인 당신은 마력의 충격으로 눈이 멀어 복면을 쓰고 있다.",
  "주민들의 얼굴은 볼 수 없다. 오직 밤의 흔적과 낮의 목소리로만 추리해야 한다.",
  "이레 안에 제물의 유물을 든 자와, 그것을 들여온 배신자를 찾아내라.",
];

// RelicId: 'villager' | 'seer' | 'robber' | 'troublemaker' | 'drunk' | 'madness'
//        | 'mason' | 'minion' | 'sacrifice'
export const RELIC_INFO = {
  villager: {
    name: "평범한 유물",
    description: "특별한 힘은 없다.",
  },
  seer: {
    name: "예지의 유물",
    description: "밤마다 한 사람의 유물을 몰래 들여다볼 수 있다.",
  },
  robber: {
    name: "도둑의 유물",
    description:
      "밤마다 다른 사람 하나와 유물을 통째로 맞바꾼다. 유물은 주머니 속에 있어 자기가 뭘 받았는지는 본인도 모른다 — 다만 누구와 바꿨는지는 안다.",
  },
  troublemaker: {
    name: "혼돈의 유물",
    description: "밤마다 자신을 뺀 다른 두 사람의 유물을 몰래 맞바꿔놓는다. 정작 자신의 유물은 그대로다.",
  },
  drunk: {
    name: "몽롱한 유물",
    description: "밤마다 유물함 속 유물 하나와 자기 유물을 안 보고 바꾼다. 그래서 자신이 지금 뭘 가졌는지 스스로도 모른다.",
  },
  madness: {
    name: "광기의 유물",
    description:
      "처형되면 의식이 끝난 것처럼 보인다 — 하지만 그건 착각이다. 그 틈에 하수인이 다른 사람에게 제물의 유물을 하나 더 심어놓을 수 있다.",
  },
  mason: {
    name: "결계의 유물",
    description: "짝이 되는 유물이 마을에 하나 더 있다. 서로의 정체를 알고 있다.",
  },
  minion: {
    name: "그림자의 유물",
    description:
      "의식에 제물의 유물을 몰래 들여온 배신자. 갇히지 않으면, 처형이 있을 때마다(진짜든 광기의 유물이든) 다른 사람에게 제물의 유물을 하나 더 심을 수 있다.",
  },
  sacrifice: {
    name: "제물의 유물",
    description: "이 유물을 지닌 자는 의식의 제물이 되어야 한다. 들키면 죽는다는 공포에 남의 유물을 사칭한다.",
  },
};

// 진짜 정체를 감출 때 사칭 대상이 될 수 있는 "진짜" 유물들 (제물/하수인 제외).
export const HONEST_RELICS = ["villager", "seer", "robber", "troublemaker", "drunk", "madness", "mason"];

// 예지의 유물이 (진짜든 사칭이든) "봤다"고 말할 수 있는 유물 전체 — 제물/하수인도 포함.
export const ALL_RELICS = [...HONEST_RELICS, "sacrifice", "minion"];

export const VILLAGE_SIZE = 11;

// 마을 구성은 매 런 무작위다 — 제물/하수인만 정확히 1명씩 고정이고, 나머지는 겹치거나
// 아예 안 나올 수도 있다(결계만 예외: 항상 짝수 명). js/engine.js의 generateRelicLayout
// 참고. 정원(ROLE_SLOTS)은 더 이상 "항상 1명"을 보장하지 않는, 그저 봇 추리용 기본값이다.
export const DUPLICATABLE_RELICS = ["seer", "robber", "troublemaker", "drunk", "madness", "villager"];
export const MASON_COUNT_WEIGHTS = [
  [0, 1],
  [2, 6],
  [4, 1],
];
export const ROLE_SLOTS = { seer: 1, robber: 1, troublemaker: 1, drunk: 1, madness: 1, mason: 2 };

// 유물함(중앙 유물 풀)의 초기 여분 — 원작의 "인원수+3장" 관례를 따른다.
export const BOX_SEED = ["villager", "villager", "villager"];

export const VILLAGER_NAME_POOL = [
  "이삭", "마르가", "두빈", "소린", "헬가", "자카리", "오필", "펠라",
  "군터", "이자벨", "로자", "테오", "브릿", "사무엘",
];

// 한글 조사 선택(과/와, 이에요/예요) — 받침 유무에 따라 자연스러운 문장을 만든다.
function hasBatchim(word) {
  const ch = word?.[word.length - 1];
  const code = ch ? ch.charCodeAt(0) - 0xac00 : -1;
  if (code < 0 || code > 11171) return false; // 한글 음절이 아니면 받침 없다고 취급
  return code % 28 !== 0;
}
export const and = (word) => (hasBatchim(word) ? "과" : "와");
export const copula = (word) => (hasBatchim(word) ? "이에요" : "예요");

// 낮 증언: 유물은 주머니 속에 있어 아무도 "지금" 자기가 뭔지 모른다. 다들 어젯밤
// 자기가 한 행동(혹은 계속 같은 자기 인식)을 말할 뿐이다 — 그래서 말하는 유물과
// 지금 실제로 들고 있는 유물이 다를 수 있다. 능동적으로 뭔가를 "한" 유물(예지/도둑/
// 문제아/취객)은 과거형으로, 그냥 "그런 사람"인 유물(평범/결계/광기)은 현재형으로 쓴다.
// belief: { role, targetName, targetName2, targetRelic, partnerName, swappedWithName }
export const CLAIM_LINES = {
  villager: () => "저는 평범한 유물이에요. 특별히 본 건 없어요.",
  seer: (belief) =>
    `어젯밤 예지의 유물을 썼어요. ${belief.targetName}의 유물을 몰래 봤는데, ${
      RELIC_INFO[belief.targetRelic]?.name ?? "알 수 없는 유물"
    }이었어요.`,
  robber: (belief) =>
    belief.swappedWithName
      ? `어젯밤 도둑의 유물을 썼어요. ${belief.swappedWithName}${and(belief.swappedWithName)} 유물을 통째로 바꿨는데, 지금 제가 뭘 가졌는지는 저도 몰라요.`
      : "어젯밤 도둑의 유물을 썼는데, 상대가 잘 기억나지 않아요. 지금 제가 뭘 가졌는지도 몰라요.",
  troublemaker: (belief) =>
    belief.targetName && belief.targetName2
      ? `어젯밤 혼돈의 유물을 썼어요. ${belief.targetName}${and(belief.targetName)} ${belief.targetName2}의 유물을 몰래 바꿔놨어요.`
      : "어젯밤 혼돈의 유물을 썼는데, 누구 걸 바꿨는지 잘 기억나지 않아요.",
  drunk: () => "어젯밤 몽롱한 유물을 썼어요. 유물함이랑 뭔가 바꿨는데, 뭘 가져왔는지 기억이 안 나요.",
  madness: () => "저는 광기의 유물이에요. 머릿속이 온통 뒤엉켜 있어요. 차라리... 절 데려가 주세요.",
  mason: (belief) =>
    belief.partnerName
      ? `저는 결계의 유물이에요. 제 짝은 ${belief.partnerName}${copula(belief.partnerName)}.`
      : "저는 결계의 유물이에요. 짝이 있었을 텐데, 이제 소식을 알 수 없어요.",
};

// 오염된(제물/하수인) 화자가 주장 뒤에 붙이는 짧은 태도 — 공포/과잉 확신을 드러낸다.
export const CORRUPTED_MOOD = [
  "목소리가 이상하리만치 차분하다.",
  "너무 태연해서 오히려 눈에 띈다.",
  "말끝이 미묘하게 끊긴다.",
  "손끝이 떨리는 걸 애써 감추고 있다.",
];

// 평범한 유물이 가끔 덧붙이는 위축된 태도 (거짓은 아니지만 겁먹은 어조 — 낚시성 붉은청어).
export const NERVOUS_MOOD = [
  "늑대가 자신을 노릴까 봐 두려워하는 눈치다.",
  "장로가 오인할까 봐 잔뜩 움츠러들어 있다.",
  "말을 아끼며 주위를 살핀다.",
];

// 광기의 유물을 처형했을 때: 실패처럼 보이지 않는다 — 오히려 성공한 것 같은 찜찜한 안도감.
// (장로에게는 진짜와 구분되지 않는다. 하수인이 자유로우면 이 틈에 새 제물을 심는다.)
export const MADNESS_EXECUTION_LINE =
  "광기의 유물이 산산이 부서지며 낮은 웃음소리 같은 게 새어 나온다. 의식이 끝난 듯한 이상한 안도감이 마을을 감돈다...";

export const SACRIFICE_PLANTED_LINE = "어둠 속에서 하수인이 또 다른 이에게 제물의 유물을 몰래 심어놓았다...";

// 잘못된 제물을 바쳤을 때: 결과가 바로 뜨지 않고 이 대사들이 순서대로 흐른 뒤 결말로 넘어간다.
export const RITUAL_FAILURE_TEXT = [
  "장로의 선택이 빗나갔다.",
  "붉은달이 핏빛으로 타오르기 시작한다.",
  "마을 사람들이 홀린 듯 하나둘 집 밖으로 걸어 나온다. 낮게 웅얼거리는 주문 소리가 겹쳐 든다.",
  "그리고 — 거대한 늑대가 어둠 속에서 걸어 나와, 마을을 집어삼킨다.",
];

export const TIMEOUT_FAILURE_LINE = "이레가 지나도록 배신자를 끝내 가두지 못했다. 붉은달의 저주가 마을을 뒤덮는다.";

// 밤에 한 사람에게 귀 기울였을 때: 그날 밤 능력에 얽혔으면(행위자든 대상이든) vs 아니면.
export function nightListenLine(name, involved) {
  return involved ? `${name} 쪽에서 낮게 웅성거리는 소리가 들렸다...` : `${name} 쪽은 고요하다.`;
}
