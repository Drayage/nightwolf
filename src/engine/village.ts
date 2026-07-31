import type { RelicId, Villager } from './types';
import { drawNames } from './names';

const DEFAULT_RELIC_LAYOUT: RelicId[] = [
  'sacrifice',
  'minion',
  'seer',
  'villager',
  'villager',
  'villager',
  'villager',
];

export function createVillage(): Villager[] {
  const relics = [...DEFAULT_RELIC_LAYOUT];
  for (let i = relics.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [relics[i], relics[j]] = [relics[j], relics[i]];
  }

  const names = drawNames(relics.length);

  return relics.map((relic, i) => ({
    id: `v${i}`,
    name: names[i],
    relic,
    alive: true,
    jailed: false,
  }));
}
