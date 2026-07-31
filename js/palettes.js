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

    // 밤에 누군가에게 귀 기울였을 때, 그 사람이 오늘 밤 능력에 얽혔다면 들리는 낮은 웅성거림
    murmur: [
      { t: "tone", wave: "sine", freq: 145, freqEnd: 110, dur: 0.4, gain: 0.3, attack: 0.05, lp: 600 },
      { t: "noise", dur: 0.3, gain: 0.15, lp: 350 },
    ],
  },
  // 배경음악: 저음 드론 두 겹(살짝 불협하게 어긋남) + 멀리서 울리는 종 + 낮은 맥박음.
  // 32박의 느린 루프(템포 42) — audio.js의 스케줄러는 정수 박자에서만 노트를 매칭하므로
  // beat 값은 항상 정수여야 한다(소수 박자는 절대 안 울림).
  bgm: {
    main: {
      tempo: 42,
      loopBeats: 32,
      inst: { wave: "sine", gain: 0.14, attack: 1.4, lp: 380 },
      notes: [
        // 저음 드론(A1) — 전반 16박
        [0, 55.0, 16],
        [0, 82.41, 16, { gain: 0.05, attack: 2.2, lp: 500 }], // 완전5도 배음, 아주 조용히
        [8, 58.27, 12, { gain: 0.07, attack: 1.8, lp: 350 }], // 단2도 불협음이 슬며시 끼어듦

        // 저음 드론 후반 16박(같은 근음, 배음만 살짝 바뀜 — 루프가 그대로 반복되지 않게)
        [16, 55.0, 16],
        [16, 65.41, 16, { gain: 0.045, attack: 2.4, lp: 480 }],
        [24, 58.27, 8, { gain: 0.06, attack: 1.5, lp: 350 }],

        // 멀리서 울리는 종(toll SFX와 같은 2겹 화음, 훨씬 조용하게) — 루프 중간쯤 한 번
        [20, 130.81, 3.0, { gain: 0.11, attack: 0.06, lp: 650 }],
        [20, 196.0, 2.4, { gain: 0.045, attack: 0.1, lp: 650 }],

        // 낮은 맥박(심장박동처럼 아주 드문드문) — noise 레이어로 대체
        [12, 0, 0.25, { t: "noise", gain: 0.16, lp: 95 }],
        [28, 0, 0.25, { t: "noise", gain: 0.13, lp: 95 }],

        // 바람/천 스치는 질감 — 짧고 아주 조용한 노이즈
        [5, 0, 1.3, { t: "noise", gain: 0.03, lp: 200 }],
        [21, 0, 1.6, { t: "noise", gain: 0.028, lp: 180 }],
      ],
    },
  },
};

export const ALL_PALETTES = { RITUAL };
