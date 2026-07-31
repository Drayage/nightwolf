export const VILLAGER_NAME_POOL = [
  '이삭', '마르가', '두빈', '소린', '헬가', '자카리', '오필', '펠라', '군터', '이자벨',
];

export function drawNames(count: number): string[] {
  const pool = [...VILLAGER_NAME_POOL];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}
