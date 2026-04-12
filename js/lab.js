/* ============================================================
   異常事象調査アーカイブ — lab.js
   研究室: 入室演出 / 煙パーティクル / 3D遺物 / 考察モーダル
   ============================================================ */
'use strict';


/* ══════════════════════════════════════════════════════════
   入室演出タイムライン
   0.0s  ページロード → 廊下（黒画面 + 奥行きフレーム表示）
   0.3s  廊下ラベル表示、床ラインを広げる
   0.4s  足音 SE スタート（3.0 秒間）
   3.0s  足音終了直前 → ドア軋み SE、フラッシュ、パネル開放
   4.3s  研究室シーンをフェードイン
   4.6s  着席 SE（椅子 + 衣擦れ）
   5.0s  廊下オーバーレイを非表示（pointer-events オフ）
   5.5s  煙パーティクルシステム起動
   ══════════════════════════════════════════════════════════ */
function startTransition() {
  const transition  = document.getElementById('lab-transition');
  const corridor    = document.getElementById('corridor');
  const corridorLbl = document.getElementById('corridor-label');
  const floorLine   = document.getElementById('corridor-floor-line');
  const flash       = document.getElementById('door-flash');
  const labScene    = document.getElementById('lab-scene');

  /* Step 1 — 廊下ラベル + 床ライン */
  setTimeout(() => {
    corridorLbl.classList.add('visible');
    floorLine.classList.add('spread');
  }, 300);

  /* Step 2 — 足音 SE（3.0秒） */
  setTimeout(() => {
    try { playFootsteps(3.0); } catch (_) { /* audio ブロック時は無音 */ }
  }, 400);

  /* Step 3 — ドア開放（軋み + フラッシュ + パネル） */
  setTimeout(() => {
    /* フラッシュ */
    flash.classList.add('burst');
    setTimeout(() => flash.classList.remove('burst'), 120);

    /* ドア軋み SE */
    try { playDoorCreak(); } catch (_) {}

    /* パネルを左右に割る */
    transition.classList.add('door-open');

    /* 廊下をフェードアウト */
    corridor.classList.add('fade-out');
  }, 3000);

  /* Step 4 — 研究室フェードイン */
  setTimeout(() => {
    labScene.classList.add('visible');
  }, 4200);

  /* Step 5 — 着席 SE */
  setTimeout(() => {
    try { playSeated(); } catch (_) {}
  }, 4500);

  /* Step 6 — 移行レイヤーを完全非表示 */
  setTimeout(() => {
    transition.style.display = 'none';
  }, 5200);

  /* Step 7 — 煙パーティクル起動 */
  setTimeout(initSmokeSystem, 5600);
}


/* ══════════════════════════════════════════════════════════
   煙パーティクルシステム（Canvas ベース）
   ── 気まぐれな間欠性: 5〜11s 放煙 → 8〜17s 休止 → 繰り返し
══════════════════════════════════════════════════════════ */

const SMOKE_W = 160;
const SMOKE_H = 200;

class SmokeParticle {
  constructor(cx) {
    this.x       = cx + (Math.random() - 0.5) * 14;
    this.y       = SMOKE_H - 12;
    this.vx      = (Math.random() - 0.5) * 0.45;
    this.vy      = -(Math.random() * 0.55 + 0.30);
    this.r       = Math.random() * 5 + 3.5;
    this.maxR    = this.r + Math.random() * 18 + 10;
    this.alpha   = Math.random() * 0.18 + 0.05;
    this.life    = 0;
    this.maxLife = Math.floor(Math.random() * 110 + 80);
    this.drift   = (Math.random() - 0.5) * 0.016;
    this.sway    = Math.random() * Math.PI * 2; // 揺れ位相
  }

  update() {
    this.life++;
    /* 揺れながら上昇 */
    this.sway += 0.04;
    this.x += this.vx + Math.sin(this.sway) * 0.25 + this.drift * this.life * 0.5;
    this.y += this.vy;
    this.vy  *= 0.997; // 徐々に減速

    /* 半径を膨張 */
    const prog = this.life / this.maxLife;
    this.r = this.r + (this.maxR - this.r) * 0.012;

    /* フェードイン→フェードアウト（sinカーブ） */
    this.currentAlpha = this.alpha * Math.sin(Math.PI * prog);
  }

  draw(ctx) {
    if (!this.currentAlpha || this.currentAlpha < 0.004) return;
    const grad = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.r
    );
    grad.addColorStop(0,   `rgba(210, 210, 210, ${this.currentAlpha})`);
    grad.addColorStop(0.5, `rgba(185, 185, 185, ${this.currentAlpha * 0.5})`);
    grad.addColorStop(1,   'rgba(160, 160, 160, 0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  dead() { return this.life >= this.maxLife; }
}


function initSmokeSystem() {
  const canvas = document.getElementById('smoke-canvas');
  if (!canvas) return;

  canvas.width  = SMOKE_W;
  canvas.height = SMOKE_H;
  const ctx = canvas.getContext('2d');
  const cx  = SMOKE_W / 2;

  let particles = [];
  let emitting  = false;

  /* ── 間欠タイマー ── */
  function scheduleSession() {
    const pause    = (Math.random() * 9  + 7) * 1000;  // 7〜16s 休止
    const duration = (Math.random() * 6  + 5) * 1000;  // 5〜11s 放煙

    setTimeout(() => {
      emitting = true;
      setTimeout(() => {
        emitting = false;
        scheduleSession();
      }, duration);
    }, pause);
  }

  /* ── アニメーションループ ── */
  function tick() {
    requestAnimationFrame(tick);
    ctx.clearRect(0, 0, SMOKE_W, SMOKE_H);

    /* 放煙中は確率 18% で新パーティクル発生 */
    if (emitting && Math.random() < 0.18) {
      particles.push(new SmokeParticle(cx));
    }

    /* 描画 & 寿命切れ除去（後ろから描いて前が上になる） */
    particles = particles.filter(p => {
      p.update();
      p.draw(ctx);
      return !p.dead();
    });
  }

  /* 最初のセッション: 2〜5秒後にスタート */
  setTimeout(() => {
    emitting = true;
    setTimeout(() => {
      emitting = false;
      scheduleSession();
    }, (Math.random() * 5 + 4) * 1000);
  }, (Math.random() * 3 + 2) * 1000);

  tick();
}


/* ══════════════════════════════════════════════════════════
   Three.js 遺物（封印容器）— デスク中央上
══════════════════════════════════════════════════════════ */
function initLabArtifact() {
  if (typeof THREE === 'undefined') {
    console.warn('[lab.js] Three.js が読み込まれていません');
    return;
  }

  const canvas = document.getElementById('lab-3d-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.offsetWidth || 130, canvas.offsetHeight || 130, false);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 3.8);

  /* ── ライティング ── */
  scene.add(new THREE.AmbientLight(0x2a1508, 0.65));

  const mainL = new THREE.DirectionalLight(0xd49010, 1.10);
  mainL.position.set(2.5, 3.5, 2);
  scene.add(mainL);

  const rimL = new THREE.DirectionalLight(0x3a1260, 0.50);
  rimL.position.set(-2.5, -1.5, -3);
  scene.add(rimL);

  const glowL = new THREE.PointLight(0xffcc44, 0, 4);
  glowL.position.set(0, 0.5, 2);
  scene.add(glowL);

  /* ── 封印容器ジオメトリ ── */
  const group = new THREE.Group();

  const makeMat = (color, rough, metal = 0.04) =>
    new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });

  /* 本体 */
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.80, 0.74),
    makeMat(0x4e3c2c, 0.96)
  );
  group.add(box);

  /* ワイヤーエッジ（琥珀） */
  group.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.11, 0.81, 0.75)),
    new THREE.LineBasicMaterial({ color: 0xc8900a, transparent: true, opacity: 0.55 })
  ));

  /* 封印の縦横バー */
  const barMat = makeMat(0x8b3a10, 0.65, 0.42);
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.64, 0.04), barMat);
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.05, 0.04), barMat);
  vBar.position.z = hBar.position.z = 0.39;
  group.add(vBar, hBar);

  /* 錠前 */
  const lock = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.17, 0.08),
    makeMat(0x7a5020, 0.45, 0.62)
  );
  lock.position.set(0, 0, 0.42);
  group.add(lock);

  /* 錠前アーチ */
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(0.058, 0.022, 8, 12, Math.PI),
    makeMat(0x5a3a10, 0.55, 0.55)
  );
  arch.position.set(0, 0.105, 0.42);
  group.add(arch);

  /* 四隅の鋲 */
  [[-0.50, 0.35], [0.50, 0.35], [-0.50, -0.35], [0.50, -0.35]].forEach(([x, y]) => {
    const nail = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 10, 10),
      makeMat(0x9a7030, 0.32, 0.72)
    );
    nail.position.set(x, y, 0.39);
    group.add(nail);
  });

  scene.add(group);

  /* ── アニメーションループ ── */
  const clock   = new THREE.Clock();
  let   hovered = false;

  canvas.addEventListener('mouseenter', () => { hovered = true; });
  canvas.addEventListener('mouseleave', () => { hovered = false; });

  function animate() {
    requestAnimationFrame(animate);
    const t   = clock.getElapsedTime();
    const spd = hovered ? 0.022 : 0.006;

    group.position.y   = Math.sin(t * 0.75) * 0.10;
    group.rotation.y  += spd;
    group.rotation.x  += spd * 0.30;

    glowL.intensity = hovered
      ? 0.50 + Math.sin(t * 2.5) * 0.15
      : glowL.intensity * 0.90;

    renderer.render(scene, camera);
  }
  animate();

  /* リサイズ対応 */
  new ResizeObserver(() => {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w && h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }).observe(canvas);
}


/* ══════════════════════════════════════════════════════════
   書類クリック → 考察モーダル
   ── 将来 Firestore の forum_topics から取得する拡張ポイント
══════════════════════════════════════════════════════════ */
const CAT_DESC = {
  '未解決事件':    '未だ解明されていない事件の記録と、調査員たちによる考察を集積した文書群。',
  '都市伝説':     '口伝で広がる異常事象の記録。信頼度の検証と地図データとの照合が課題。',
  '神話':         '古事記・風土記・地方伝承との照合。現代の異常事象との類似点を精査する。',
  '失われた言語':  '複数の事象現場で発見された未解読文字群の解析資料。文字種は現時点で未同定。',
};

function openTopicModal(cat) {
  const modal   = document.getElementById('topic-modal');
  const title   = document.getElementById('topic-modal-title');
  const listEl  = document.getElementById('topic-list');

  title.textContent = `▍${cat}`;
  listEl.innerHTML  = '';

  /* ── [将来実装] Firestore から forum_topics を取得 ──────
     if (typeof dbGetForumTopics === 'function') {
       dbGetForumTopics(cat).then(topics => {
         if (!topics.length) {
           listEl.innerHTML = '<p class="coming-soon-msg">記録なし</p>';
           return;
         }
         topics.forEach(t => {
           const el = document.createElement('div');
           el.className = 'topic-item';
           el.innerHTML = `
             <p class="topic-item-title">${escSafe(t.title)}</p>
             <p class="topic-item-meta">${escSafe(t.author)} &ensp;|&ensp; ${escSafe(t.createdAt?.toDate?.().toLocaleDateString('ja-JP') ?? '')}</p>
           `;
           listEl.appendChild(el);
         });
       });
     }
     ─────────────────────────────────────────────────── */

  /* 現在は準備中メッセージ */
  listEl.innerHTML = `
    <p class="coming-soon-msg">
      ${escSafe(CAT_DESC[cat] ?? '')}
      <br><br>
      この考察セクションは現在準備中です。<br>
      <span class="coming-soon-sub">— AGENT-7 より —</span>
    </p>
  `;

  modal.classList.remove('hidden');
}

function closeTopicModal() {
  document.getElementById('topic-modal').classList.add('hidden');
}

function escSafe(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/* ══════════════════════════════════════════════════════════
   DOMContentLoaded — 起動
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── 入室演出（ユーザー操作後でないと AudioContext は起動できないため
         DOMContentLoaded 直後に遷移開始し、最初の click / touch で
         AudioContext をアンロックする） ── */
  startTransition();

  /* ── 3D 遺物（lab-scene が見えてから初期化） ── */
  setTimeout(initLabArtifact, 4300);

  /* ── 書類クリック ── */
  document.querySelectorAll('.doc-paper').forEach(paper => {
    const handler = () => openTopicModal(paper.dataset.cat);
    paper.addEventListener('click',   handler);
    paper.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });

  /* ── モーダルを閉じる ── */
  document.getElementById('topic-modal-close')
    .addEventListener('click', closeTopicModal);

  document.getElementById('topic-modal')
    .addEventListener('click', e => {
      if (e.target === e.currentTarget) closeTopicModal();
    });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTopicModal();
  });

  /* ── AudioContext アンロック（iOS / Chrome の自動再生ポリシー対策） ──
     ユーザーの最初のタップ/クリックで AudioContext を resume する */
  function unlockAudio() {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (_) {}
    document.removeEventListener('click',      unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  }
  document.addEventListener('click',      unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });

});
