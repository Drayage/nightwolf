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
    description: "밤마다 다른 사람 하나와 유물을 통째로 맞바꾼다. 그날그날 훔친 역할로 살아간다.",
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

// 유일 배정 유물의 정원 (초과 주장이 나오면 그중 최소 하나는 거짓 — 추궁 포인트).
// villager는 정원 제한 없음(여럿이어도 정상)이라 여기 없음.
export const ROLE_SLOTS = { seer: 1, robber: 1, troublemaker: 1, drunk: 1, madness: 1, mason: 2 };

// 11명 마을: 제물+하수인+원작 특수 역할 각 1(결계는 2) + 평범 2.
export const DEFAULT_RELIC_LAYOUT = [
  "sacrifice",
  "minion",
  "seer",
  "robber",
  "troublemaker",
  "drunk",
  "madness",
  "mason",
  "mason",
  "villager",
  "villager",
];

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

// 낮 증언: "나는 [유물]이다. [구체적 근거]." 형태로 통일해 추궁(대조/모순 찾기)이 가능하게 한다.
// 도둑/문제아/취객은 이제 밤마다 실제로 유물이 바뀌므로, 그날그날 "현재" 유물을 가진
// 사람이 그날의 증언을 한다 (전날까지 누가 그 유물이었는지는 중요하지 않다).
// ctx: { targetName, targetName2, strange, partnerName }
export const CLAIM_LINES = {
  villager: () => "나는 평범한 유물입니다. 특별히 본 것은 없어요.",
  seer: (ctx) =>
    `나는 예지의 유물입니다. 어젯밤 ${ctx.targetName}의 유물을 몰래 봤는데, ${
      ctx.strange ? "뭔가... 이상했어요." : "평범해 보였어요."
    }`,
  robber: () => "나는 도둑의 유물입니다. 어젯밤도 누군가와 유물이 통째로 뒤바뀐 걸 알아챘어요.",
  troublemaker: (ctx) =>
    ctx.targetName && ctx.targetName2
      ? `나는 혼돈의 유물입니다. 어젯밤 ${ctx.targetName}${and(ctx.targetName)} ${ctx.targetName2}의 유물을 몰래 바꿔놨어요.`
      : "나는 혼돈의 유물입니다. 어젯밤도 누군가의 유물을 몰래 바꿔놨는데, 상대가 잘 기억나지 않아요.",
  drunk: () => "나는 몽롱한 유물입니다. 사실 지금 제가 뭘 가졌는지도 몰라요.",
  madness: () => "나는 광기의 유물입니다. 머릿속이 온통 뒤엉켜 있어요. 차라리... 절 데려가 주세요.",
  mason: (ctx) =>
    ctx.partnerName
      ? `나는 결계의 유물입니다. 제 짝은 ${ctx.partnerName}${copula(ctx.partnerName)}.`
      : "나는 결계의 유물입니다. 짝이 있었을 텐데, 이제 소식을 알 수 없어요.",
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
