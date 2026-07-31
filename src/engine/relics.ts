import type { RelicId } from './types';

export const RELIC_INFO: Record<RelicId, { name: string; description: string }> = {
  villager: {
    name: '평범한 유물',
    description: '특별한 힘은 없다.',
  },
  seer: {
    name: '예지의 유물',
    description: '밤마다 한 사람의 유물을 몰래 들여다볼 수 있다.',
  },
  minion: {
    name: '그림자의 유물',
    description:
      '의식에 제물의 유물을 몰래 들여온 배신자. 갇히지 않으면 밤마다 제물의 유물을 다른 이에게 옮길 수 있다.',
  },
  sacrifice: {
    name: '제물의 유물',
    description: '이 유물을 지닌 자는 의식의 제물이 되어야 한다. 들키면 죽는다는 공포에 거짓을 말한다.',
  },
};
