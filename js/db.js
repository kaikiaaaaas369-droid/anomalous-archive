/* ============================================================
   異常事象調査アーカイブ — db.js
   Firestore データアクセス層

   コレクション設計:
     map_pins/{docId}
       lat (number), lng (number), content (string), type (string),
       reliability (number), datetime (string), timestamp (serverTimestamp)

       map_pins/{docId}/comments/{commentId}
         comment (string), datetime (string), timestamp (serverTimestamp)

     forum_topics/{docId}
       title (string), category (string), content (string),
       author (string), createdAt (serverTimestamp)
   ============================================================ */
'use strict';

/* ── コレクション名定数 ──────────────────────────────────── */
const COL_PINS   = 'map_pins';
const COL_TOPICS = 'forum_topics';
const COL_CMTS   = 'comments';

let _db = null;


/* ══════════════════════════════════════════════════════════
   Firebase / Firestore 初期化
   ── 戻り値: true = 接続成功 / false = 設定不備・エラー
══════════════════════════════════════════════════════════ */
function initFirebaseDB() {
  if (typeof firebase === 'undefined') {
    console.error('[db.js] Firebase SDK が読み込まれていません。' +
                  'index.html の Firebase CDN タグを確認してください。');
    return false;
  }

  if (
    typeof FIREBASE_CONFIG === 'undefined' ||
    FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY'
  ) {
    console.warn('[db.js] firebase-config.js の設定値（apiKey 等）を' +
                 'Firebase コンソールのものに置き換えてください。');
    return false;
  }

  try {
    /* 二重初期化を防ぐ */
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = firebase.firestore();
    console.log('[db.js] Firestore 接続完了 | project:', FIREBASE_CONFIG.projectId);
    return true;

  } catch (err) {
    console.error('[db.js] Firebase 初期化エラー:', err);
    return false;
  }
}


/* ── 内部ヘルパー: DB インスタンスを返す ──────────────────── */
function _getDB() {
  if (!_db) {
    throw new Error('Firestore が未初期化です。initFirebaseDB() を先に呼んでください。');
  }
  return _db;
}

/* ── 内部ヘルパー: サーバータイムスタンプ ────────────────── */
function _serverTs() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

/* ── 内部ヘルパー: FieldValue.increment ─────────────────── */
function _inc(n) {
  return firebase.firestore.FieldValue.increment(n);
}

/* ── 内部ヘルパー: 日時文字列（表示用） ─────────────────── */
function _nowStr() {
  return new Date().toLocaleString('ja-JP', { hour12: false });
}


/* ══════════════════════════════════════════════════════════
   map_pins — 全件取得（timestamp 降順）
   ── 返却: { id, lat, lng, content, type, reliability, datetime, timestamp }[]
══════════════════════════════════════════════════════════ */
async function dbGetMapPins() {
  const snap = await _getDB()
    .collection(COL_PINS)
    .orderBy('timestamp', 'desc')
    .get();

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}


/* ══════════════════════════════════════════════════════════
   map_pins — 新規追加
   ── 返却: 新ドキュメントID (string)
══════════════════════════════════════════════════════════ */
async function dbAddMapPin(lat, lng, content, type) {
  const ref = await _getDB().collection(COL_PINS).add({
    lat        : Number(lat),
    lng        : Number(lng),
    content    : String(content),
    type       : String(type),
    reliability: 0,
    datetime   : _nowStr(),
    timestamp  : _serverTs(),
  });
  return ref.id;
}


/* ══════════════════════════════════════════════════════════
   map_pins — 追認（reliability を +1 するアトミック操作）
   ── 返却: 更新後の reliability 値 (number)
══════════════════════════════════════════════════════════ */
async function dbEndorsePin(pinId) {
  const ref = _getDB().collection(COL_PINS).doc(String(pinId));
  await ref.update({ reliability: _inc(1) });
  const snap = await ref.get();
  return snap.data().reliability;
}


/* ══════════════════════════════════════════════════════════
   comments（サブコレクション）— 取得
   ── 返却: { id, comment, datetime, timestamp }[]
══════════════════════════════════════════════════════════ */
async function dbGetComments(pinId) {
  const snap = await _getDB()
    .collection(COL_PINS).doc(String(pinId))
    .collection(COL_CMTS)
    .orderBy('timestamp', 'asc')
    .get();

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}


/* ══════════════════════════════════════════════════════════
   comments（サブコレクション）— 追加
══════════════════════════════════════════════════════════ */
async function dbAddComment(pinId, comment) {
  await _getDB()
    .collection(COL_PINS).doc(String(pinId))
    .collection(COL_CMTS)
    .add({
      comment  : String(comment),
      datetime : _nowStr(),
      timestamp: _serverTs(),
    });
}


/* ══════════════════════════════════════════════════════════
   forum_topics — 全件取得（カテゴリフィルタ対応）
   ── カテゴリ例: '未解決事件' | '都市伝説' | '神話' | '失われた言語'
   ── 返却: { id, title, category, content, author, createdAt }[]
══════════════════════════════════════════════════════════ */
async function dbGetForumTopics(category = null) {
  let query = _getDB().collection(COL_TOPICS).orderBy('createdAt', 'desc');

  if (category) {
    query = _getDB().collection(COL_TOPICS)
      .where('category', '==', category)
      .orderBy('createdAt', 'desc');
  }

  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


/* ══════════════════════════════════════════════════════════
   forum_topics — 新規追加
   ── 返却: 新ドキュメントID (string)
══════════════════════════════════════════════════════════ */
async function dbAddForumTopic(title, category, content, author) {
  const ref = await _getDB().collection(COL_TOPICS).add({
    title    : String(title),
    category : String(category),
    content  : String(content),
    author   : String(author),
    createdAt: _serverTs(),
  });
  return ref.id;
}
