import type { GameState } from './types';
import { createVillage } from './village';
import { generateTestimony } from './testimony';

function nameOf(state: GameState, id: string): string {
  return state.villagers.find((v) => v.id === id)?.name ?? '???';
}

function runNightPhase(state: GameState): GameState {
  const villagers = state.villagers;
  const seer = villagers.find((v) => v.relic === 'seer' && v.alive && !v.jailed);
  const log = [...state.log];

  log.push({
    day: state.day,
    phase: 'night',
    text: '붉은달이 떠올랐다. 마을은 다시 한번 의식의 밤을 맞이한다.',
  });

  if (seer) {
    const candidates = villagers.filter((v) => v.id !== seer.id && v.alive);
    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const strange = target.relic === 'sacrifice' || target.relic === 'minion';
      log.push({
        day: state.day,
        phase: 'day',
        text: `${seer.name}: "어젯밤 ${target.name}의 유물을 몰래 봤어요. ${
          strange ? '뭔가... 이상했어요.' : '평범해 보였어요.'
        }"`,
      });
    }
  }

  villagers
    .filter((v) => v.alive && v.id !== seer?.id)
    .forEach((v) => {
      log.push({ day: state.day, phase: 'day', text: `${v.name}: ${generateTestimony(v)}` });
    });

  return { ...state, log };
}

export function startRun(): GameState {
  const villagers = createVillage();
  const sacrifice = villagers.find((v) => v.relic === 'sacrifice')!;
  const minion = villagers.find((v) => v.relic === 'minion')!;

  const initial: GameState = {
    day: 1,
    maxDays: 7,
    villagers,
    sacrificeHolderId: sacrifice.id,
    minionId: minion.id,
    log: [],
    status: 'playing',
  };

  return runNightPhase(initial);
}

export function jail(state: GameState, id: string): GameState {
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, jailed: true } : v));
  return {
    ...state,
    villagers,
    log: [...state.log, { day: state.day, phase: 'day', text: `장로가 ${nameOf(state, id)}을(를) 감옥에 가뒀다.` }],
  };
}

export function release(state: GameState, id: string): GameState {
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, jailed: false } : v));
  return {
    ...state,
    villagers,
    log: [...state.log, { day: state.day, phase: 'day', text: `장로가 ${nameOf(state, id)}을(를) 풀어주었다.` }],
  };
}

export function execute(state: GameState, id: string): GameState {
  const target = state.villagers.find((v) => v.id === id);
  if (!target || state.status !== 'playing') return state;

  const isCorrect = id === state.sacrificeHolderId;
  const villagers = state.villagers.map((v) => (v.id === id ? { ...v, alive: false } : v));
  const log = [...state.log, { day: state.day, phase: 'day' as const, text: `장로가 ${target.name}을(를) 제물로 처형했다.` }];

  if (!isCorrect) {
    return {
      ...state,
      villagers,
      log: [
        ...log,
        { day: state.day, phase: 'day', text: `${target.name}은(는) 제물의 유물 소지자가 아니었다. 의식이 어긋났다...` },
      ],
      status: 'lost',
      lossReason: '잘못된 제물을 바쳐 의식이 실패했습니다.',
    };
  }

  const minion = villagers.find((v) => v.id === state.minionId)!;
  const minionContained = !minion.alive || minion.jailed;

  if (minionContained) {
    return {
      ...state,
      villagers,
      log: [...log, { day: state.day, phase: 'day', text: '붉은달이 잦아들었다. 더 이상 제물은 나타나지 않는다.' }],
      status: 'won',
    };
  }

  if (state.day >= state.maxDays) {
    return {
      ...state,
      villagers,
      log: [...log, { day: state.day, phase: 'day', text: '하수인을 끝내 잡지 못한 채 이레가 지났다...' }],
      status: 'lost',
      lossReason: '기한 내에 하수인을 막지 못했습니다.',
    };
  }

  const candidates = villagers.filter((v) => v.alive && v.id !== state.minionId);
  if (candidates.length === 0) {
    return {
      ...state,
      villagers,
      log: [...log, { day: state.day, phase: 'day', text: '더 이상 제물로 삼을 사람이 남지 않았다...' }],
      status: 'lost',
      lossReason: '더 이상 제물로 삼을 사람이 없습니다.',
    };
  }

  const newHolder = candidates[Math.floor(Math.random() * candidates.length)];
  log.push({ day: state.day, phase: 'day', text: '하수인이 어둠 속에서 제물의 유물을 다른 이에게 옮겼다...' });

  const nextState: GameState = {
    ...state,
    villagers,
    sacrificeHolderId: newHolder.id,
    day: state.day + 1,
    log,
  };

  return runNightPhase(nextState);
}
