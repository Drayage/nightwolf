import { useState } from 'react';
import type { GameState } from './engine/types';
import { startRun, jail, release, execute } from './engine/run';
import { RELIC_INFO } from './engine/relics';
import { TITLE, INTRO_TEXT } from './story/text';
import './App.css';

function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen title-screen">
      <h1>{TITLE}</h1>
      {INTRO_TEXT.map((line, i) => (
        <p key={i} className="intro-line">
          {line}
        </p>
      ))}
      <button className="primary-button" onClick={onStart}>
        의식을 시작한다
      </button>
    </div>
  );
}

function EndScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const won = state.status === 'won';
  return (
    <div className="screen end-screen">
      <h1>{won ? '의식이 완성되었다' : '의식은 실패했다'}</h1>
      <p>{won ? `${state.day}일 만에 붉은달의 저주를 막아냈다.` : state.lossReason}</p>
      <button className="primary-button" onClick={onRestart}>
        다시 시작한다
      </button>
    </div>
  );
}

function RunScreen({ state, setState }: { state: GameState; setState: (s: GameState) => void }) {
  const [pendingExecuteId, setPendingExecuteId] = useState<string | null>(null);
  const alive = state.villagers.filter((v) => v.alive);
  const dayLog = state.log.filter((l) => l.day === state.day);

  const handleExecuteConfirm = (id: string) => {
    setState(execute(state, id));
    setPendingExecuteId(null);
  };

  return (
    <div className="screen run-screen">
      <header className="run-header">
        <h2>
          {state.day}일째 밤 / 최대 {state.maxDays}일
        </h2>
      </header>

      <section className="log">
        {dayLog.map((entry, i) => (
          <p key={i} className={`log-line ${entry.phase}`}>
            {entry.text}
          </p>
        ))}
      </section>

      <section className="villagers">
        {alive.map((v) => (
          <div key={v.id} className={`villager-card ${v.jailed ? 'jailed' : ''}`}>
            <div className="villager-name">{v.name}</div>
            <div className="villager-status">{v.jailed ? '감옥에 갇힘' : '자유로움'}</div>
            <div className="villager-actions">
              {v.jailed ? (
                <button onClick={() => setState(release(state, v.id))}>풀어주기</button>
              ) : (
                <button onClick={() => setState(jail(state, v.id))}>가두기</button>
              )}
              {pendingExecuteId === v.id ? (
                <button className="danger-button" onClick={() => handleExecuteConfirm(v.id)}>
                  정말로 처형?
                </button>
              ) : (
                <button className="danger-button" onClick={() => setPendingExecuteId(v.id)}>
                  처형
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <footer className="relic-legend">
        {Object.entries(RELIC_INFO).map(([id, info]) => (
          <span key={id} className="relic-hint" title={info.description}>
            {info.name}
          </span>
        ))}
      </footer>
    </div>
  );
}

function App() {
  const [state, setState] = useState<GameState | null>(null);

  if (!state) {
    return <TitleScreen onStart={() => setState(startRun())} />;
  }

  if (state.status !== 'playing') {
    return <EndScreen state={state} onRestart={() => setState(null)} />;
  }

  return <RunScreen state={state} setState={setState} />;
}

export default App;
