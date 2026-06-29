/**
 * STORE.JS — Firebase Realtime Database (tae-hong 저장소)
 * 통합 파일 - ha-store.js 대체용
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref,
  set as _set, get as _get, push as _push, update as _update, remove as _remove }
  from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

// ── Firebase 초기화 ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAF-Rn7tzIjQeyUDJKnvKTRNccsXUVsIjo",
  authDomain: "higherad-b9d62.firebaseapp.com",
  databaseURL: "https://higherad-b9d62-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "higherad-b9d62",
  storageBucket: "higherad-b9d62.firebasestorage.app",
  messagingSenderId: "938928195180",
  appId: "1:938928195180:web:8209b1e02a8caabe643a49",
  measurementId: "G-01T4L4ZGVV"
};

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── 인증 상태 복원 대기 래퍼 ─────────────────────────────────
const authReady = auth.authStateReady();

async function get(r)        { await authReady; return _get(r); }
async function set(r, v)     { await authReady; return _set(r, v); }
async function push(r, v)    { await authReady; return _push(r, v); }
async function update(r, v)  { await authReady; return _update(r, v); }
async function remove(r)     { await authReady; return _remove(r); }

// ── DB 경로 상수 (tae-hong) ────────────────────────────────
const PATHS = {
  slots: 'tae-hong/slots',
  users: 'tae-hong/users',
};

async function getUserUnitPrice(userId) {
  try {
    const uSnap = await get(ref(db, PATHS.users));
    const u = snapToArray(uSnap).find(u => u.username === (userId || ''));
    return u ? (u.unitPrice || 0) : 0;
  } catch(e) { return 0; }
}

// ── 유틸: Firebase 스냅샷 → 배열 변환 ───────────────────────
function snapToArray(snapshot) {
  if (!snapshot.exists()) return [];
  const val = snapshot.val();
  return Object.entries(val).map(([key, data]) => ({ ...data, _key: key }));
}

// ── 내부 이벤트 버스 ─────────────────────────────────────────
function dispatch(event) {
  window.dispatchEvent(new CustomEvent(event));
}

// ════════════════════════════════════════════════════════════
const HA = {

  // ── 현재 로그인 유저 ───────────────────────────────────────
  getCurrentUser() {
    return JSON.parse(sessionStorage.getItem('ha_current_user') || 'null');
  },

  // ── 로그인 ────────────────────────────────────────────────
  async login(username, password) {
    const email = `${username}@higherad.app`;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid  = cred.user.uid;
      const snapshot = await get(ref(db, PATHS.users));
      const users    = snapToArray(snapshot);
      const found    = users.find(u => u.username === username);
      if (found) {
        if (found.approved === false) return { ok: false, reason: 'pending' };
        const user = { ...found, id: uid };
        sessionStorage.setItem('ha_current_user', JSON.stringify(user));
        return { ok: true, user };
      }
      await signOut(auth);
      return { ok: false };
    } catch (e) {
      return { ok: false };
    }
  },

  logout() {
    sessionStorage.removeItem('ha_current_user');
    signOut(auth).catch(() => {});
  },

  // ════════════════════════════════════════════════════════
  // 캠페인 CRUD
  // ════════════════════════════════════════════════════════

  async getSlots() {
    const snapshot = await get(ref(db, PATHS.slots));
    return snapToArray(snapshot).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  async addSlot(data) {
    const unitPriceSnapshot = await getUserUnitPrice(data.userId || '');

    const newSlot = {
      status:        'pending',
      createdAt:     new Date().toISOString(),
      agencyId:      data.agencyId      || '',
      userId:        data.userId        || '',
      startDate:     data.startDate     || '',
      endDate:       data.endDate       || '',
      storeName:     data.storeName     || '',
      rankKeyword:   data.rankKeyword   || '',
      url:           data.url           || '',
      mid:           data.mid           || '',
      memo:          data.memo          || '',
      days:          Number(data.days)        || 0,
      dailyTarget:   Number(data.dailyTarget) || 0,
      searchKeyword: data.searchKeyword  || '',
      unitPrice:     unitPriceSnapshot,
    };
    const newRef = await push(ref(db, PATHS.slots), newSlot);
    const result = { ...newSlot, _key: newRef.key };
    dispatch('ha:slots:updated');
    return result;
  },

  async updateSlot(key, patch) {
    await update(ref(db, `${PATHS.slots}/${key}`), patch);
    dispatch('ha:slots:updated');
  },

  async approveSlot(key) {
    await update(ref(db, `${PATHS.slots}/${key}`), { status: 'active' });
    dispatch('ha:slots:updated');
  },

  async deleteSlot(key) {
    await remove(ref(db, `${PATHS.slots}/${key}`));
    dispatch('ha:slots:updated');
  },

  // ════════════════════════════════════════════════════════
  // 회원 CRUD
  // ════════════════════════════════════════════════════════

  async getUsers() {
    const snapshot = await get(ref(db, PATHS.users));
    return snapToArray(snapshot);
  },

};

// 전역 노출
window.HA = HA;

export default HA;
