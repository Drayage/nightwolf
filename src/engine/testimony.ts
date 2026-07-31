import type { Villager } from './types';

// 진짜 주민: 늑대에게 노려질까, 오인당할까 무서워서 치는 방어용 거짓말(연막)
const DEFENSIVE_LIES = [
  '"저는... 그냥 평범한 밤을 보냈을 뿐이에요." 손끝이 떨리고 있다.',
  '"제 유물이요? 아, 아무것도 못 봤어요." 시선을 피한다.',
  '"늑대가 제 것을 노릴까 봐 무서워서 아무 말도 못 하겠어요."',
];

// 제물의 유물 소지자: 정상적인 능력을 썼다고 당당히 내뱉는 오염된 거짓말(헛소리)
const CORRUPTED_LIES = [
  '"저는 정직하게 제 힘을 썼을 뿐입니다." 목소리에 미묘한 확신이 서려 있다.',
  '"의심하실 이유가 전혀 없어요." 너무 태연하다.',
  '"제가 본 건... 아무것도 아니었어요." 말끝이 묘하게 끊긴다.',
];

const PLAIN_LINES = [
  '"저는 그냥 잠을 잤어요." 별다른 특이사항은 없어 보인다.',
  '"밤새 아무 소리도 못 들었는데요."',
  '"딱히 드릴 말씀이 없네요."',
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function generateTestimony(v: Villager): string {
  if (v.relic === 'sacrifice') {
    return pick(CORRUPTED_LIES);
  }
  if (v.relic === 'minion') {
    return pick(DEFENSIVE_LIES);
  }
  return pick(Math.random() < 0.3 ? DEFENSIVE_LIES : PLAIN_LINES);
}
