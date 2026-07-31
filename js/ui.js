// 렌더 — 타이틀 / 하루 진행 / 종료 화면. DOM 전용, 게임 규칙은 engine.js에 있음.
import { startRun, jail, release, execute } from "./engine.js";
import { RELIC_INFO, TITLE, INTRO_TEXT } from "./data/relics.js";
import { saveGame, loadGame, clearGame, saveMarks, loadMarks, clearMarks } from "./storage.js";
import { playSfx } from "./audio.js";
import { RITUAL } from "./palettes.js";

const rng = Math.random;
const gameArea = document.getElementById("game-area");
const actionBar = document.getElementById("action-bar");
const relicModal = document.getElementById("relic-modal");
const relicModalTitle = document.getElementById("relic-modal-title");
const relicModalDesc = document.getElementById("relic-modal-desc");

let state = loadGame();
let marks = loadMarks(); // { [villagerId]: "O" | "X" | "?" } — 플레이어 자신의 추리 메모
let pendingExecuteId = null;

const MARK_CYCLE = [null, "O", "X", "?"];
const MARK_CLASS = { O: "o", X: "x", "?": "q" }; // "?"는 CSS 클래스명에 못 쓰므로 안전한 접미사로 변환
function cycleMark(id) {
  const idx = MARK_CYCLE.indexOf(marks[id] ?? null);
  const next = MARK_CYCLE[(idx + 1) % MARK_CYCLE.length];
  if (next) marks[id] = next;
  else delete marks[id];
  saveMarks(marks);
}

function resetMarks() {
  marks = {};
  clearMarks();
}

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

function openRelicInfo(relicId) {
  const info = RELIC_INFO[relicId];
  relicModalTitle.textContent = info.name;
  relicModalDesc.textContent = info.description;
  relicModal.showModal();
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
          resetMarks();
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
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  const headingByStatus = {
    won: "의식이 완성되었다",
    lost: "의식은 실패했다",
  };
  const bodyByStatus = {
    won: `${state.day}일 만에 붉은달의 저주를 막아냈다.`,
    lost: state.lossReason,
  };

  gameArea.appendChild(
    el("div", { class: "screen end-screen" }, [
      el("h1", {}, headingByStatus[state.status] ?? headingByStatus.lost),
      el("p", {}, bodyByStatus[state.status] ?? bodyByStatus.lost),
    ])
  );
  playSfx(RITUAL, state.status === "won" ? "win" : "error");

  actionBar.appendChild(
    el(
      "button",
      {
        class: "primary-button",
        onClick: () => {
          state = null;
          pendingExecuteId = null;
          resetMarks();
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
    dayLog.map((entry) => {
      const speakerId = entry.meta?.kind === "claim" ? entry.meta.speakerId : null;
      if (!speakerId) return el("p", { class: `log-line ${entry.phase}` }, entry.text);

      const mark = marks[speakerId];
      const prefix = mark ? `[${mark}] ` : "";
      return el(
        "p",
        {
          class: `log-line ${entry.phase} markable${mark ? " marked-" + MARK_CLASS[mark] : ""}`,
          onClick: () => {
            playSfx(RITUAL, "tap");
            cycleMark(speakerId);
            render();
          },
        },
        prefix + entry.text
      );
    })
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

      const mark = marks[v.id];
      const nameLine = mark
        ? el("div", { class: "villager-name" }, [
            el("span", { class: `mark-badge mark-${MARK_CLASS[mark]}` }, mark),
            " " + v.name,
          ])
        : el("div", { class: "villager-name" }, v.name);

      return el("div", { class: `villager-card${v.jailed ? " jailed" : ""}` }, [
        nameLine,
        el("div", { class: "villager-status" }, v.jailed ? "감옥에 갇힘" : "자유로움"),
        el("div", { class: "villager-actions" }, [jailButton, executeButton]),
      ]);
    })
  );

  const legend = el(
    "footer",
    { class: "relic-legend" },
    Object.entries(RELIC_INFO).map(([id, info]) =>
      el("button", { class: "relic-hint", onClick: () => openRelicInfo(id) }, info.name)
    )
  );

  gameArea.appendChild(el("div", { class: "screen run-screen" }, [header, logBox, cards, legend]));
}

render();
