// 렌더 — 타이틀 / 밤(듣기) / 낮(증언·처형) / 종료 화면. DOM 전용, 게임 규칙은 engine.js에 있음.
import { startRun, revealDay, listenTo, jail, release, execute, continueAfterExecution } from "./engine.js";
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
  if (state.phase === "night") return renderNight();
  if (state.phase === "executed") return renderExecuted();
  return renderDay();
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

// 밤: 아직 아무 말도 공개되지 않는다. 주민 하나만 짚어 귀를 기울일 수 있고, 그 사람이
// 그날 밤 누군가에게 능력을 썼거나 능력을 받은 적이 있으면 소리와 함께 글도 뜬다.
// 한 번 고르고 나면 그날 밤은 그걸로 끝 — 다른 사람은 더 짚을 수 없다.
function renderNight() {
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  const nightNumber = state.day - 1;
  const involvement = new Set(state.nightInvolvement || []);
  const alive = state.villagers.filter((v) => v.alive);
  const listened = state.nightListenedId;

  const header = el("h2", { class: "run-header" }, `${nightNumber}일째 밤`);
  const hint = el(
    "p",
    { class: "intro-line" },
    listened ? "이미 한 사람에게 귀를 기울였다." : "아무것도 보이지 않는다. 딱 한 사람만 짚어 귀를 기울일 수 있다."
  );

  const nightLog = el(
    "section",
    { class: "log" },
    state.log.filter((e) => e.day === state.day && e.phase === "night").map((e) => el("p", { class: "log-line night" }, e.text))
  );

  const cards = el(
    "section",
    { class: "villagers" },
    alive.map((v) => {
      const disabled = listened && listened !== v.id;
      return el(
        "button",
        {
          class: `villager-card night-card${v.jailed ? " jailed" : ""}${disabled ? " night-card-disabled" : ""}`,
          onClick: () => {
            if (disabled) return;
            if (listened === v.id) {
              // 이미 고른 사람은 다시 눌러 소리만 재생(로그는 중복으로 안 쌓임)
              playSfx(RITUAL, "tap");
              if (involvement.has(v.id)) playSfx(RITUAL, "murmur");
              return;
            }
            playSfx(RITUAL, "tap");
            if (involvement.has(v.id)) playSfx(RITUAL, "murmur");
            state = listenTo(state, v.id);
            persist();
            render();
          },
        },
        [
          el("div", { class: "villager-name" }, v.name),
          el("div", { class: "villager-status" }, v.jailed ? "감옥에 갇힘" : listened === v.id ? "귀 기울이는 중" : "귀 기울이기"),
        ]
      );
    })
  );

  gameArea.appendChild(el("div", { class: "screen run-screen" }, [header, hint, nightLog, cards]));

  actionBar.appendChild(
    el(
      "button",
      {
        class: "primary-button",
        onClick: () => {
          playSfx(RITUAL, "confirm");
          state = revealDay(state);
          resetMarks();
          persist();
          render();
        },
      },
      "낮이 밝았다"
    )
  );
}

// 처형 직후: 결과는 아직 감춰져 있다("처형했다"만 보임). "계속"을 눌러야 실제 결과가 드러난다.
function renderExecuted() {
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  const executionLog = state.log.filter((e) => e.day === state.day && e.meta?.kind === "execution");
  const logBox = el("section", { class: "log" }, executionLog.map((e) => el("p", { class: "log-line day" }, e.text)));

  gameArea.appendChild(el("div", { class: "screen run-screen" }, [el("h2", { class: "run-header" }, "..."), logBox]));

  actionBar.appendChild(
    el(
      "button",
      {
        class: "primary-button",
        onClick: () => {
          playSfx(RITUAL, "tap");
          state = continueAfterExecution(state);
          persist();
          render();
        },
      },
      "계속"
    )
  );
}

function renderEnd() {
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  const won = state.status === "won";
  const children = [el("h1", {}, won ? "의식이 완성되었다" : "의식은 실패했다")];

  if (won) {
    children.push(el("p", {}, `${state.day}일 만에 붉은달의 저주를 막아냈다.`));
  } else {
    const endingLines = state.log.filter((e) => e.day === state.day && e.phase === "ending").map((e) => e.text);
    for (const line of endingLines.length ? endingLines : [state.lossReason]) {
      children.push(el("p", { class: "intro-line" }, line));
    }
    if (state.revealTable) {
      children.push(
        el("table", { class: "reveal-table" }, [
          el("thead", {}, el("tr", {}, [el("th", {}, "이름"), el("th", {}, "시작 유물"), el("th", {}, "마지막 유물")])),
          el(
            "tbody",
            {},
            state.revealTable.map((row) =>
              el("tr", {}, [
                el("td", {}, row.name),
                el("td", {}, RELIC_INFO[row.startingRelic]?.name ?? row.startingRelic),
                el("td", {}, RELIC_INFO[row.endingRelic]?.name ?? row.endingRelic),
              ])
            )
          ),
        ])
      );
    }
  }

  gameArea.appendChild(el("div", { class: "screen end-screen" }, children));
  playSfx(RITUAL, won ? "win" : "error");

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

function renderDay() {
  gameArea.innerHTML = "";
  actionBar.innerHTML = "";

  const dayLog = state.log.filter((entry) => entry.day === state.day && entry.phase === "day");
  const alive = state.villagers.filter((v) => v.alive);

  const header = el("h2", { class: "run-header" }, `${state.day}일째 낮 (최대 ${state.maxDays}일)`);

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
