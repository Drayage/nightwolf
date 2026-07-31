// ── 게임별 설정: 새 게임에서 반드시 수정 ──────────────────────────
// APP_VERSION은 코드를 수정한 커밋마다 갱신하고, sw.js의 CACHE_VERSION과
// index.html의 스크립트 ?v= 쿼리를 같은 값으로 맞춘다.

export const APP_ID = "redmoon"; // Firebase 네임스페이스 프리픽스: `${APP_ID}_rooms/...`
export const APP_NAME = "붉은달의 의식";
export const APP_VERSION = "20260731-9";

// 공유 Firebase 프로젝트 config (Drayage/DEADLINE에서 복사 — deadline-38cdb 프로젝트).
// 새 프로젝트를 만들지 말 것. 아직 온라인 모드를 쓰지 않아 net.js는 미사용 상태.
// (config 키는 비밀이 아님 — 보안은 database rules가 담당)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyByKyy7PYBIMi2K1jxH6KmzfWbE2_SsB5A",
  authDomain: "deadline-38cdb.firebaseapp.com",
  databaseURL: "https://deadline-38cdb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "deadline-38cdb",
  storageBucket: "deadline-38cdb.firebasestorage.app",
  messagingSenderId: "768255871086",
  appId: "1:768255871086:web:1677a38d4c6bf64d9cbe7f",
};
