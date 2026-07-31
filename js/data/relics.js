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

// RelicId: 'villager' | 'seer' | 'robber' | 'troublemaker' | 'drunk' | 'hunter' | 'tanner'
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
    description: "밤마다 다른 사람과 눈이 마주치면 그 유물의 기운을 슬쩍 엿볼 수 있다.",
  },
  troublemaker: {
    name: "혼돈의 유물",
    description: "밤마다 다른 사람 하나의 입을 막는다. 그 사람은 그날 낮 동안 아무 증언도 하지 못한다.",
  },
  drunk: {
    name: "몽롱한 유물",
    description: "너무 취해서 매일 밤 자신이 무슨 유물인지조차 다르게 착각한다 — 낮의 주장이 밤마다 바뀐다.",
  },
  hunter: {
    name: "사냥꾼의 유물",
    description: "억울하게 처형되면, 마지막 힘으로 감옥에 갇힌 자의 진짜 정체를 폭로하고 죽는다.",
  },
  tanner: {
    name: "무두장이의 유물",
    description: "이 짓거리가 지긋지긋해서 오히려 처형되기를 바란다. 처형되면 의식은 실패하지만 결말이 다르게 갈린다.",
  },
  mason: {
    name: "결계의 유물",
    description: "짝이 되는 유물이 마을에 하나 더 있다. 서로의 정체를 알고 있다.",
  },
  minion: {
    name: "그림자의 유물",
    description:
      "의식에 제물의 유물을 몰래 들여온 배신자. 갇히지 않으면 밤마다 제물의 유물을 다른 이에게 옮길 수 있다.",
  },
  sacrifice: {
    name: "제물의 유물",
    description: "이 유물을 지닌 자는 의식의 제물이 되어야 한다. 들키면 죽는다는 공포에 남의 유물을 사칭한다.",
  },
};

// 진짜 정체를 감출 때 사칭 대상이 될 수 있는 "진짜" 유물들 (제물/하수인 제외).
export const HONEST_RELICS = ["villager", "seer", "robber", "troublemaker", "drunk", "hunter", "tanner", "mason"];

// 유일 배정 유물의 정원 (초과 주장이 나오면 그중 최소 하나는 거짓 — 추궁 포인트).
// villager는 정원 제한 없음(여럿이어도 정상)이라 여기 없음.
export const ROLE_SLOTS = { seer: 1, robber: 1, troublemaker: 1, drunk: 1, hunter: 1, tanner: 1, mason: 2 };

// 12명 마을: 제물+하수인+원작 특수 역할 각 1(결계는 2) + 평범 2.
export const DEFAULT_RELIC_LAYOUT = [
  "sacrifice",
  "minion",
  "seer",
  "robber",
  "troublemaker",
  "drunk",
  "hunter",
  "tanner",
  "mason",
  "mason",
  "villager",
  "villager",
];

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
// ctx: { targetName, targetName2, strange, partnerName }
export const CLAIM_LINES = {
  villager: () => "나는 평범한 유물입니다. 특별히 본 것은 없어요.",
  seer: (ctx) =>
    `나는 예지의 유물입니다. 어젯밤 ${ctx.targetName}의 유물을 몰래 봤는데, ${
      ctx.strange ? "뭔가... 이상했어요." : "평범해 보였어요."
    }`,
  robber: (ctx) =>
    `나는 도둑의 유물입니다. 어젯밤 ${ctx.targetName}${and(ctx.targetName)} 눈이 마주쳤는데, ${
      ctx.strange ? "손끝이 서늘할 만큼 이상했어요." : "그냥 평범한 기운이었어요."
    }`,
  troublemaker: (ctx) =>
    ctx.targetName
      ? `나는 혼돈의 유물입니다. 오늘 ${ctx.targetName}의 입을 막아놨어요.`
      : "나는 혼돈의 유물입니다. 오늘은 딱히 손쓸 대상이 없었어요.",
  drunk: () => "나는 몽롱한 유물입니다. 사실 어젯밤 일이 하나도 기억나지 않아요.",
  hunter: () => "나는 사냥꾼의 유물입니다. 저를 억울하게 건드리면 가만있지 않을 겁니다.",
  tanner: () => "나는 무두장이의 유물입니다. 솔직히... 차라리 제가 처형됐으면 좋겠어요.",
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

// 사냥꾼이 처형될 때: 감옥에 갇힌 자가 있으면 그의 진짜 정체를 실제로 폭로한다(실질 효과).
export function hunterRevealLine(jailedName, jailedRelicName) {
  if (!jailedName) return "사냥꾼의 유물이 바닥에 떨어지며 낮게 울린다. 하지만 가리킬 자가 감옥에 없다.";
  return `사냥꾼의 유물이 마지막 힘을 다해 감옥에 갇힌 ${jailedName}을(를) 가리킨다. 그의 진짜 정체는 [${jailedRelicName}]이었다.`;
}

// 무두장이가 처형될 때: 일반 오판과는 다른 결말(연출 + 별도 상태 'tanner')로 갈린다.
export const TANNER_ENDING_TITLE = "무두장이의 소원";
export const TANNER_ENDING_TEXT =
  "무두장이는 오히려 옅은 미소를 지으며 눈을 감았다. 원했던 대로 되었다는 듯이. " +
  "하지만 의식은 여전히 완성되지 못했다 — 진짜 제물은 어딘가에서 이 결말을 지켜보고 있다.";
