// 렌더 — 타이틀 / 하루 진행 / 종료 화면. DOM 전용, 게임 규칙은 engine.js에 있음.
import { startRun, jail, release, execute } from "./engine.js";
import { RELIC_INFO, TITLE, INTRO_TEXT } from "./data/relics.js";
import { saveGame, loadGame, clearGame } from "./storage.js";
import { playSfx } from "./audio.js";
import { RITUAL } from "./palettes.js";

const rng = Math.random;
const gameArea = document.getElementById("game-area");
const actionBar = document.getElementById("action-bar");

let state = loadGame();
let pendingExecuteId = null;

function persist() {
  if (state) saveGame(state);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function render() {
  if (!state) return renderTitle();
  if (state.status !== "playing") return renderEnd();
  return renderRun();
}

function renderTitle() {
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  gameArea.appendChild(
    el("div", { class: "screen title-screen" }, [
      el("h1", {}, TITLE),
      ...INTRO_TEXT.map((line) => el("p", { class: "intro-line" }, line)),
    ])
  );

  actionBar.appendChild(
    el(
      "button",
      {
        class: "primary-button",
        onClick: () => {
          playSfx(RITUAL, "confirm");
          state = startRun(rng);
          persist();
          render();
        },
      },
      "의식을 시작한다"
    )
  );
}

function renderEnd() {
  const won = state.status === "won";
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  gameArea.appendChild(
    el("div", { class: "screen end-screen" }, [
      el("h1", {}, won ? "의식이 완성되었다" : "의식은 실패했다"),
      el("p", {}, won ? `${state.day}일 만에 붉은달의 저주를 막아냈다.` : state.lossReason),
    ])
  );
  playSfx(RITUAL, won ? "win" : "error");

  actionBar.appendChild(
    el(
      "button",
      {
        class: "primary-button",
        onClick: () => {
          state = null;
          pendingExecuteId = null;
          clearGame();
          render();
        },
      },
      "다시 시작한다"
    )
  );
}

function renderRun() {
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  const dayLog = state.log.filter((entry) => entry.day === state.day);
  const alive = state.villagers.filter((v) => v.alive);

  const header = el("h2", { class: "run-header" }, `${state.day}일째 밤 / 최대 ${state.maxDays}일`);

  const logBox = el(
    "section",
    { class: "log" },
    dayLog.map((entry) => el("p", { class: `log-line ${entry.phase}` }, entry.text))
  );

  const cards = el(
    "section",
    { class: "villagers" },
    alive.map((v) => {
      const jailButton = v.jailed
        ? el(
            "button",
            {
              onClick: () => {
                playSfx(RITUAL, "tap");
                state = release(state, v.id);
                persist();
                render();
              },
            },
            "풀어주기"
          )
        : el(
            "button",
            {
              onClick: () => {
                playSfx(RITUAL, "tap");
                state = jail(state, v.id);
                persist();
                render();
              },
            },
            "가두기"
          );

      const executeButton =
        pendingExecuteId === v.id
          ? el(
              "button",
              {
                class: "danger-button",
                onClick: () => {
                  playSfx(RITUAL, "toll");
                  state = execute(state, v.id, rng);
                  pendingExecuteId = null;
                  persist();
                  render();
                },
              },
              "정말로 처형?"
            )
          : el(
              "button",
              {
                class: "danger-button",
                onClick: () => {
                  pendingExecuteId = v.id;
                  render();
                },
              },
              "처형"
            );

      return el("div", { class: `villager-card${v.jailed ? " jailed" : ""}` }, [
        el("div", { class: "villager-name" }, v.name),
        el("div", { class: "villager-status" }, v.jailed ? "감옥에 갇힘" : "자유로움"),
        el("div", { class: "villager-actions" }, [jailButton, executeButton]),
      ]);
    })
  );

  const legend = el(
    "footer",
    { class: "relic-legend" },
    Object.entries(RELIC_INFO).map(([id, info]) => el("span", { class: "relic-hint", title: info.description }, info.name))
  );

  gameArea.appendChild(el("div", { class: "screen run-screen" }, [header, logBox, cards, legend]));
}

render();
