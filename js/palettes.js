// 게임 전용 팔레트 — "음산하고 무거운 의식감" (사용자 확인 완료).
// 낮고 긴 종/공명음, 북소리 기반 긴장감. 금속성·밝은 음색은 금지.
// audio-preview.html에서 튜닝을 반복해서 확인할 것.

export const RITUAL = {
  name: "붉은달의 의식",
  sfx: {
    // 주민 선택 등 가벼운 탭 — 낮은 둔탁한 타격음
    tap: [{ t: "noise", dur: 0.05, gain: 0.25, lp: 400 }],

    // 투옥/확인 등 결정 확정 — 낮은 종(공명) 톤
    confirm: [
      { t: "tone", wave: "sine", freq: 130, dur: 0.5, gain: 0.5, attack: 0.01, lp: 700 },
      { t: "tone", wave: "sine", freq: 195, dur: 0.5, gain: 0.2, attack: 0.02, lp: 700 },
    ],

    // 처형(제물 봉헌) — 무거운 종 타종(toll)
    toll: [
      { t: "tone", wave: "sine", freq: 82, dur: 1.1, gain: 0.55, attack: 0.005, lp: 500 },
      { t: "tone", wave: "sine", freq: 123, dur: 0.9, gain: 0.25, attack: 0.01, lp: 500 },
      { t: "noise", dur: 0.08, gain: 0.3, lp: 300 },
    ],

    // 오판/의식 실패 — 낮게 흘러내리는 불협 톤
    error: [
      { t: "tone", wave: "sawtooth", freq: 110, freqEnd: 55, dur: 1.0, gain: 0.35, attack: 0.02, lp: 350 },
      { t: "tone", wave: "sine", freq: 98, freqEnd: 49, dur: 1.0, gain: 0.3, attack: 0.02, lp: 350 },
    ],

    // 승리(의식 성공) — 낮고 느린 공명 화음, 밝지 않게
    win: [
      { t: "tone", wave: "sine", freq: 98, dur: 1.8, gain: 0.4, attack: 0.1, lp: 700 },
      { t: "tone", wave: "sine", freq: 147, dur: 1.8, gain: 0.28, attack: 0.3, lp: 700 },
      { t: "tone", wave: "sine", freq: 196, dur: 2.0, gain: 0.2, attack: 0.5, lp: 700 },
    ],
  },
  bgm: {
    main: {
      tempo: 48,
      loopBeats: 16,
      inst: { wave: "sine", gain: 0.16, attack: 0.4, lp: 500 },
      notes: [
        [0, 65, 4], [4, 73, 3], [8, 65, 4], [12, 61, 3.5],
      ],
    },
  },
};

export const ALL_PALETTES = { RITUAL };
