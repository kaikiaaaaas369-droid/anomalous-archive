/* ============================================================
   異常事象調査アーカイブ — app.js
   Frontend Logic: 地図 / マーカー / 投稿 / ボット / 追認
   ============================================================ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ★ 設定欄
   GAS をデプロイ後、発行された「ウェブアプリURL」をここに貼る
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const GAS_URL = 'https://script.google.com/macros/s/AKfycby1Tsd03QSkh1NBJyMPAsHngKOHMOvSKnajfMJux9-505SeG6ep9Od3yVrZbeog4YNBAw/exec';


/* ── 事象種別マスター ───────────────────────────────────── */
const EVENT_TYPES = [
  { id: '幽霊・人影',   icon: '👁',  color: '#9b59b6' },
  { id: '怪光・発光体', icon: '✦',  color: '#c8a000' },
  { id: '怪音・異音',  icon: '〜',  color: '#e74c3c' },
  { id: '変死・遺体',  icon: '✝',  color: '#4a4a72' },
  { id: '空間異常',   icon: '◎',   color: '#00a896' },
  { id: '不明',       icon: '？',  color: '#7a6a5a' },
];

/* ── 調査員（ボット）メッセージ ─────────────────────────── */
const BOT_MESSAGES = [
  '……調査は順調か？',
  'この地に刻まれた記録を、侮るな。',
  '異常事象は連鎖する。記録を続けよ。',
  '君の報告を待っていた。',
  '記録せよ。記録のみが、我々の武器だ。',
  '……また増えたな。この国の「歪み」が。',
  '信頼度の高い事象には、特別な注意を払え。',
  'データは嘘をつかない。人間が嘘をつくだけだ。',
  '地図の点が増えるほど、世界は正常に近づく。逆説的にな。',
  '現場には必ず何かが残る。空気が、温度が、記憶が。',
];


/* ── アプリ状態 ────────────────────────────────────────── */
let map;
let pendingLatLng = null;
let botMsgIndex   = Math.floor(Math.random() * BOT_MESSAGES.length);
let allEvents     = []; // { id, marker, data } のキャッシュ
let toastTimer    = null;


/* ══════════════════════════════════════════════════════════
   地図 初期化
══════════════════════════════════════════════════════════ */
function initMap() {
  map = L.map('map', {
    center: [36.5, 137.8],
    zoom: 5,
    zoomControl: false,
  });

  // CartoDB Positron（明るいベース）+ CSSセピアで古地図感を演出
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
      ' &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // ズームコントロール（右下）
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 地図クリック → 投稿モーダル表示
  map.on('click', onMapClick);

  // ※ 調査員は固定HTML要素として配置（Leafletマーカーではない）
}


/* ══════════════════════════════════════════════════════════
   調査員は index.html の #investigator-fixed（固定HTML要素）
   DOMContentLoaded 内でクリックイベントを登録する
══════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════
   イベントデータ取得（GET ?action=list）
══════════════════════════════════════════════════════════ */
async function loadEvents() {
  setStatus('照合中…');

  // URLが未設定なら警告のみ
  if (GAS_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    setStatus('未接続');
    showToast('⚠ js/app.js の GAS_URL にデプロイ後のURLを設定してください', 'warn');
    buildLegend();
    return;
  }

  try {
    const res = await fetch(`${GAS_URL}?action=list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'データ取得失敗');

    // 既存マーカーをリセット
    allEvents.forEach(({ marker }) => map.removeLayer(marker));
    allEvents = [];

    json.events.forEach(ev => {
      if (!isNaN(ev.lat) && !isNaN(ev.lng)) {
        addEventMarker(ev);
      }
    });

    setStatus(`記録数: ${json.events.length}件`);
    updateRecentList(json.events);
    buildLegend();

  } catch (err) {
    setStatus('接続失敗');
    showToast(`⚠ 取得エラー: ${err.message}`, 'error');
    console.error('[loadEvents]', err);
    buildLegend();
  }
}


/* ══════════════════════════════════════════════════════════
   マーカー追加
══════════════════════════════════════════════════════════ */
function addEventMarker(ev) {
  const tc = getTypeConfig(ev.type);

  const icon = L.divIcon({
    html: `<div class="event-marker" style="--marker-color:${tc.color}">${tc.icon}</div>`,
    className: '',
    iconSize:   [34, 34],
    iconAnchor: [17, 17],
    popupAnchor:[0, -20],
  });

  const marker = L.marker([ev.lat, ev.lng], { icon }).addTo(map);
  marker.on('click', e => {
    L.DomEvent.stopPropagation(e);   // 地図クリック（投稿モーダル）を防ぐ
    openEventPopup(ev);
  });

  allEvents.push({ id: ev.id, marker, data: ev });
}


/* ══════════════════════════════════════════════════════════
   事象ポップアップ（追認 + コメント機能）
   ※ marker.bindPopup は使わず openOn(map) で何度でも開けるようにする
══════════════════════════════════════════════════════════ */
function openEventPopup(ev) {
  const tc     = getTypeConfig(ev.type);
  const relBar = buildRelBar(ev.reliability);

  const html = `
    <div class="popup-content">
      <div class="popup-type" style="color:${tc.color}">
        ${tc.icon}&ensp;${escHtml(ev.type)}
      </div>
      <div class="popup-datetime">📅 ${escHtml(ev.datetime)}</div>
      <p class="popup-text">${escHtml(ev.content)}</p>
      <div class="popup-footer">
        <span class="popup-reliability">${relBar}</span>
        <button class="btn-endorse" id="endorse-${ev.id}"
          onclick="window.endorseEvent(${ev.id}, this)">
          ＋ 追認
        </button>
      </div>

      <div class="popup-comments-section">
        <div class="popup-comments-heading">— 調査コメント —</div>
        <div id="pcl-${ev.id}" class="popup-comment-list">
          <span class="popup-comment-dim">照合中…</span>
        </div>
        <div class="popup-comment-form">
          <textarea id="pci-${ev.id}" class="popup-comment-input"
            placeholder="コメントを記録せよ"></textarea>
          <button class="popup-comment-btn"
            onclick="window.submitComment(${ev.id}, this)">記録</button>
        </div>
      </div>
    </div>
  `;

  // マーカーに bind しない → 何度でも開閉可能
  L.popup({ className: 'custom-popup-wrap', maxWidth: 380, minWidth: 260 })
    .setLatLng([ev.lat, ev.lng])
    .setContent(html)
    .openOn(map);

  // DOM 生成後にコメントを非同期取得
  setTimeout(() => loadComments(ev.id), 80);
}

/* 信頼度バー（10マス） */
function buildRelBar(n) {
  const filled = Math.min(n, 10);
  const empty  = Math.max(0, 10 - filled);
  return `<span title="信頼度スコア: ${n}">` +
         `${'▮'.repeat(filled)}${'▯'.repeat(empty)}</span> (${n})`;
}


/* ══════════════════════════════════════════════════════════
   コメント読み込み（GET ?action=comments&id=N）
══════════════════════════════════════════════════════════ */
async function loadComments(eventId) {
  const listEl = document.getElementById(`pcl-${eventId}`);
  if (!listEl) return;

  try {
    const res  = await fetch(`${GAS_URL}?action=comments&id=${eventId}`);
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message);

    if (!json.comments || json.comments.length === 0) {
      listEl.innerHTML = '<span class="popup-comment-dim">記録なし</span>';
    } else {
      listEl.innerHTML = json.comments.map(c => `
        <div class="popup-comment-item">
          <span class="popup-comment-time">${escHtml(c.datetime)}</span>
          <p class="popup-comment-text">${escHtml(c.comment)}</p>
        </div>
      `).join('');
    }

  } catch (_) {
    if (document.getElementById(`pcl-${eventId}`)) {
      document.getElementById(`pcl-${eventId}`).innerHTML =
        '<span class="popup-comment-dim">読込失敗</span>';
    }
  }
}


/* ══════════════════════════════════════════════════════════
   コメント送信（POST action=addComment）
   グローバルに公開 → ポップアップ内のインラインonclickから呼ぶ
══════════════════════════════════════════════════════════ */
window.submitComment = async function(eventId, btn) {
  const input = document.getElementById(`pci-${eventId}`);
  if (!input) return;

  const comment = input.value.trim();
  if (!comment) {
    showToast('コメントを入力してください', 'warn');
    return;
  }

  btn.disabled    = true;
  btn.textContent = '記録中…';

  try {
    const body = new URLSearchParams();
    body.append('data', JSON.stringify({ action: 'addComment', eventId, comment }));

    const res  = await fetch(GAS_URL, { method: 'POST', body });
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || '送信失敗');

    input.value = '';
    showToast('✓ コメントを記録した', 'success');
    loadComments(eventId);   // 一覧をリロード

  } catch (err) {
    showToast(`⚠ 記録失敗: ${err.message}`, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '記録';
  }
};


/* ══════════════════════════════════════════════════════════
   追認（GET ?action=endorse&id=N）
   グローバルに公開 → ポップアップ内のインラインonclickから呼ぶ
══════════════════════════════════════════════════════════ */
window.endorseEvent = async function(id, btn) {
  btn.disabled    = true;
  btn.textContent = '…';

  try {
    const res  = await fetch(`${GAS_URL}?action=endorse&id=${id}`);
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message);

    btn.textContent = `✓ ${json.reliability}`;
    showToast('追認を記録した', 'success');

    // ローカルキャッシュ更新
    const entry = allEvents.find(e => e.id === id);
    if (entry) entry.data.reliability = json.reliability;

  } catch (err) {
    btn.disabled    = false;
    btn.textContent = '＋ 追認';
    showToast(`⚠ 追認失敗: ${err.message}`, 'error');
  }
};


/* ══════════════════════════════════════════════════════════
   地図クリック → 投稿モーダル表示
══════════════════════════════════════════════════════════ */
function onMapClick(e) {
  pendingLatLng = e.latlng;
  document.getElementById('post-location').textContent =
    `📍 緯度 ${e.latlng.lat.toFixed(5)}  経度 ${e.latlng.lng.toFixed(5)}`;
  document.getElementById('inp-content').value = '';
  document.getElementById('char-counter').textContent = '0';
  showModal('post-modal');
}


/* ══════════════════════════════════════════════════════════
   投稿送信（POST with URLSearchParams → CORS プリフライト不要）
══════════════════════════════════════════════════════════ */
async function submitPost() {
  if (!pendingLatLng) return;

  const content = document.getElementById('inp-content').value.trim();
  const type    = document.getElementById('inp-type').value;

  if (!content) {
    showToast('内容を入力してください', 'warn');
    document.getElementById('inp-content').focus();
    return;
  }

  const submitBtn       = document.getElementById('post-submit');
  submitBtn.disabled    = true;
  submitBtn.textContent = '記録中…';

  try {
    const payload  = {
      lat    : pendingLatLng.lat,
      lng    : pendingLatLng.lng,
      content: content,
      type   : type,
    };

    // URLSearchParams でエンコード → application/x-www-form-urlencoded
    // → CORSプリフライトを回避できる GAS 推奨の送信方法
    const body = new URLSearchParams();
    body.append('data', JSON.stringify(payload));

    const res  = await fetch(GAS_URL, { method: 'POST', body });
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || '保存失敗');

    // 投稿したマーカーを即時表示
    const newEv = {
      id          : json.id || (allEvents.length + 1),
      lat         : pendingLatLng.lat,
      lng         : pendingLatLng.lng,
      content,
      type,
      reliability : 0,
      datetime    : new Date().toLocaleString('ja-JP', { hour12: false }),
    };
    addEventMarker(newEv);
    updateRecentList(allEvents.map(e => e.data));

    hideModal('post-modal');
    showToast('✓ 事象を記録した', 'success');
    pendingLatLng = null;

    // ステータス更新
    setStatus(`記録数: ${allEvents.length}件`);

  } catch (err) {
    showToast(`⚠ 記録失敗: ${err.message}`, 'error');
    console.error('[submitPost]', err);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = '記録する';
  }
}


/* ══════════════════════════════════════════════════════════
   ボット（調査員）ダイアログ
══════════════════════════════════════════════════════════ */
function showBotDialog() {
  const msg = BOT_MESSAGES[botMsgIndex % BOT_MESSAGES.length];
  typewriter('bot-message', msg, 55);
  botMsgIndex++;
  showModal('bot-dialog');
}

/* タイプライター効果 */
function typewriter(elementId, text, interval = 55) {
  const el = document.getElementById(elementId);
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      el.textContent += text[i++];
    } else {
      clearInterval(timer);
    }
  }, interval);
}


/* ══════════════════════════════════════════════════════════
   サイドパネル更新
══════════════════════════════════════════════════════════ */
function updateRecentList(events) {
  const container = document.getElementById('recent-events');
  if (!events || events.length === 0) {
    container.innerHTML = '<p class="dim-text">記録なし</p>';
    return;
  }

  const recent = [...events].sort((a, b) => b.id - a.id).slice(0, 10);
  container.innerHTML = recent.map(ev => {
    const tc   = getTypeConfig(ev.type);
    const text = ev.content.length > 26
      ? ev.content.substring(0, 26) + '…'
      : ev.content;
    return `
      <div class="recent-item"
           onclick="map.panTo([${ev.lat},${ev.lng}],{animate:true})"
           title="${escHtml(ev.content)}">
        <span class="ri-type" style="color:${tc.color}">${tc.icon}</span>
        <span class="ri-text">${escHtml(text)}</span>
        <span class="ri-rel" title="信頼度">${ev.reliability}</span>
      </div>
    `;
  }).join('');
}

function buildLegend() {
  const list = document.getElementById('legend-list');
  list.innerHTML = EVENT_TYPES.map(t => `
    <li class="legend-item">
      <span class="legend-dot" style="color:${t.color};border-color:${t.color}">${t.icon}</span>
      <span>${t.id}</span>
    </li>
  `).join('');
}


/* ══════════════════════════════════════════════════════════
   ユーティリティ
══════════════════════════════════════════════════════════ */
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function setStatus(text) {
  document.getElementById('header-status').textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTypeConfig(typeName) {
  return EVENT_TYPES.find(t => t.id === typeName) || EVENT_TYPES[5];
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (toastTimer) clearTimeout(toastTimer);
  toast.className   = `toast toast-${type}`;
  toast.textContent = msg;
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 4500);
}


/* ══════════════════════════════════════════════════════════
   入室オーバーレイ（巻物アニメーション）
══════════════════════════════════════════════════════════ */
function initEntryOverlay() {
  const overlay   = document.getElementById('entry-overlay');
  const parchment = document.getElementById('scroll-parchment');
  const title     = document.getElementById('scroll-title');
  const hint      = document.getElementById('scroll-hint');
  const terms     = document.getElementById('scroll-terms');
  const entryBtn  = document.getElementById('entry-btn');
  const termsBtn  = document.getElementById('terms-reopen');

  if (!overlay) return;

  /* ① 0.5秒後: 巻物を横に開く */
  setTimeout(() => {
    parchment.classList.add('open');
  }, 500);

  /* ② 巻物が開き切った後: タイトル＆ヒントをフェードイン */
  setTimeout(() => {
    title.classList.add('visible');
    hint.classList.add('visible');
  }, 1600);

  /* タイトル / ヒントをクリック → 条文展開 */
  function expandTerms() {
    if (terms.classList.contains('expanded')) return;
    terms.classList.add('expanded');
    hint.classList.add('hint-collapse');
    /* 条文が開いてからボタンを表示 */
    setTimeout(() => {
      entryBtn.classList.add('visible');
    }, 500);
  }

  title.addEventListener('click', expandTerms);
  hint.addEventListener('click', expandTerms);

  /* 入室ボタン → オーバーレイをフェードアウトして消す */
  entryBtn.addEventListener('click', () => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 820);
  });

  /* フッター「利用規約」→ 条文展開状態でオーバーレイを再表示 */
  termsBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden', 'fade-out');
    overlay.style.opacity = '';
    parchment.classList.add('open');
    title.classList.add('visible');
    hint.classList.add('hint-collapse');
    terms.classList.add('expanded');
    entryBtn.classList.add('visible');
  });
}


/* ══════════════════════════════════════════════════════════
   [将来] AI 対話インターフェース スタブ
   OpenAI API / GAS経由で AGENT-7 を対話可能にする場合はここに実装
   ──────────────────────────────────────────────────────
   async function askAgent(userMessage) {
     const res = await fetch(GAS_URL, {
       method: 'POST',
       body: new URLSearchParams({
         data: JSON.stringify({ action: 'ai_chat', message: userMessage })
       })
     });
     const json = await res.json();
     return json.reply || '……（通信不良）';
   }
══════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════
   DOMContentLoaded — 起動処理
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── 入室オーバーレイ ───────────────────────────────── */
  initEntryOverlay();

  /* ── 地図・データ初期化 ─────────────────────────────── */
  initMap();
  loadEvents();

  /* ── 投稿フォーム ───────────────────────────────────── */
  document.getElementById('post-form').addEventListener('submit', e => {
    e.preventDefault();
    submitPost();
  });

  document.getElementById('post-cancel').addEventListener('click', () => {
    hideModal('post-modal');
    pendingLatLng = null;
  });

  document.getElementById('inp-content').addEventListener('input', function () {
    document.getElementById('char-counter').textContent = this.value.length;
  });

  /* ── 調査員 固定ボタン ──────────────────────────────────── */
  const investigator = document.getElementById('investigator-fixed');
  investigator.addEventListener('click', showBotDialog);
  investigator.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBotDialog(); }
  });

  /* ── ボットダイアログ ───────────────────────────────── */
  document.getElementById('bot-close').addEventListener('click', () => {
    hideModal('bot-dialog');
  });

  document.getElementById('bot-next').addEventListener('click', () => {
    const msg = BOT_MESSAGES[botMsgIndex % BOT_MESSAGES.length];
    typewriter('bot-message', msg, 55);
    botMsgIndex++;
  });

  /* ── モーダル背景クリックで閉じる ──────────────────── */
  ['post-modal', 'bot-dialog'].forEach(id => {
    document.getElementById(id).addEventListener('click', function (e) {
      if (e.target === this) {
        hideModal(id);
        if (id === 'post-modal') pendingLatLng = null;
      }
    });
  });

  /* ── サイドパネル 開閉 ──────────────────────────────── */
  const panel  = document.getElementById('side-panel');
  const toggle = document.getElementById('panel-toggle');

  toggle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    toggle.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
    toggle.setAttribute(
      'aria-label',
      panel.classList.contains('collapsed') ? 'パネルを開く' : 'パネルを閉じる'
    );
  });

  /* ── キーボード: Escape でモーダルを閉じる ─────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideModal('post-modal');
      hideModal('bot-dialog');
      pendingLatLng = null;
    }
  });

});
