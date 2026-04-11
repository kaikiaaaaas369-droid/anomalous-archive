/* ============================================================
   異常事象調査アーカイブ — artifact.js
   Three.js インタラクティブ3D遺物展示ケース
   ============================================================ */
'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   遺物データ定義（アフィリエイトURLは仮置き）
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ARTIFACTS = [
  {
    id   : 'camera',
    name : '遺物-Ω01：光学観測器',
    desc : '現場で発見された謎の光学機器',
    label: '— 調査装備を入手する —',
    url  : 'https://www.amazon.co.jp/s?k=%E6%9A%97%E8%A6%96%E3%82%AB%E3%83%A1%E3%83%A9+%E8%AA%BF%E6%9F%BB',
  },
  {
    id   : 'torch',
    name : '遺物-Ω02：照明発光体',
    desc : '暗所調査に不可欠な発光遺物',
    label: '— 装備を調達する —',
    url  : 'https://www.amazon.co.jp/s?k=%E9%AB%98%E8%BC%9D%E5%BA%A6LED%E6%87%90%E4%B8%AD%E9%9B%BB%E7%81%AF+%E3%82%B5%E3%83%90%E3%82%A4%E3%83%90%E3%83%AB',
  },
  {
    id   : 'box',
    name : '遺物-Ω03：封印容器',
    desc : '何者かによって封じられた箱',
    label: '— 記録文書を閲覧する —',
    url  : 'https://www.amazon.co.jp/s?k=%E3%82%AA%E3%82%AB%E3%83%AB%E3%83%88+%E6%80%AA%E8%AB%87+%E3%83%9F%E3%82%B9%E3%83%86%E3%83%AA%E3%83%BC%E5%B0%8F%E8%AA%AC',
  },
];


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   メイン初期化（Three.js 読み込み後に実行）
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.addEventListener('DOMContentLoaded', function () {

  if (typeof THREE === 'undefined') {
    console.warn('[artifact.js] Three.js が読み込まれていません');
    return;
  }

  const canvasWrap = document.getElementById('artifact-canvas-wrap');
  const canvas     = document.getElementById('artifact-canvas');
  if (!canvas) return;

  /* ─ レンダラー ──────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas   : canvas,
    antialias: true,
    alpha    : true,   // 透明背景（CSSの暗い背景を活かす）
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputEncoding    = THREE.sRGBEncoding;

  /* ─ シーン & カメラ ─────────────────────────────── */
  const scene  = new THREE.Scene();
  const CAM_Z  = 4.8;
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  /* ─ ライティング ────────────────────────────────── */
  // 微弱アンビエント（暖色）
  scene.add(new THREE.AmbientLight(0x2a1508, 0.7));

  // メインライト（琥珀・斜め上）
  const mainLight = new THREE.DirectionalLight(0xd49010, 1.15);
  mainLight.position.set(2.5, 3.5, 2);
  mainLight.castShadow = true;
  scene.add(mainLight);

  // リムライト（薄紫・後ろ斜め下）→ 不気味な縁取り
  const rimLight = new THREE.DirectionalLight(0x3a1260, 0.60);
  rimLight.position.set(-2.5, -1.5, -3);
  scene.add(rimLight);

  // ポイントライト（ホバー・クリック時に発光強度を上げる）
  const glowLight = new THREE.PointLight(0xffcc44, 0, 4);
  glowLight.position.set(0, 0.5, 2);
  scene.add(glowLight);


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     マテリアル
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function makeMetal(color, rough) {
    return new THREE.MeshStandardMaterial({
      color      : color,
      metalness  : 0.62,
      roughness  : rough !== undefined ? rough : 0.85,
      emissive   : new THREE.Color(0x000000),
    });
  }
  function makeStone(color) {
    return new THREE.MeshStandardMaterial({
      color    : color,
      metalness: 0.04,
      roughness: 0.96,
      emissive : new THREE.Color(0x000000),
    });
  }


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     遺物A — 謎の光学観測器（カメラ風）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function buildCamera() {
    const g = new THREE.Group();

    // 本体: 二十面体
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      makeMetal(0x7a5c3a, 0.88)
    );
    body.castShadow = true;
    g.add(body);

    // レンズ筒
    const lensTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.22, 0.50, 20),
      makeMetal(0x1a1828, 0.35)
    );
    lensTube.rotation.x = Math.PI / 2;
    lensTube.position.z = 0.82;
    g.add(lensTube);

    // レンズガラス（暗青・半透明）
    const lensGlass = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 24),
      new THREE.MeshStandardMaterial({
        color      : 0x1a2840,
        metalness  : 0.2,
        roughness  : 0.05,
        transparent: true,
        opacity    : 0.75,
        emissive   : new THREE.Color(0x0a1828),
        emissiveIntensity: 0.6,
      })
    );
    lensGlass.position.z = 1.08;
    g.add(lensGlass);

    // 装飾スパイク（5本）
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.38, 5),
        makeMetal(0x5a3a1a, 0.9)
      );
      spike.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0);
      spike.lookAt(new THREE.Vector3(0, 0, 0));
      spike.rotateX(Math.PI / 2);
      g.add(spike);
    }

    return g;
  }


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     遺物B — 照明発光体（懐中電灯風）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function buildTorch() {
    const g = new THREE.Group();

    // グリップ（シリンダー）
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.205, 1.10, 14),
      makeStone(0x4a3a28)
    );
    grip.castShadow = true;
    g.add(grip);

    // ヘッド（広い）
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.205, 0.40, 14),
      makeMetal(0x6a4a22, 0.80)
    );
    head.position.y = 0.73;
    g.add(head);

    // 反射板（前面・琥珀色）
    const refMat = new THREE.MeshStandardMaterial({
      color    : 0xc89018,
      metalness: 0.92,
      roughness: 0.12,
      emissive : new THREE.Color(0x604808),
      emissiveIntensity: 0.55,
    });
    const reflector = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 24),
      refMat
    );
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = 0.93;
    g.add(reflector);

    // グリップリング × 3
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.215, 0.033, 10, 24),
        makeMetal(0x3a2a18, 0.6)
      );
      ring.position.y = -0.32 + i * 0.30;
      g.add(ring);
    }

    // テール・エンドキャップ
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.15, 0.10, 14),
      makeMetal(0x5a3a18, 0.75)
    );
    cap.position.y = -0.60;
    g.add(cap);

    g.rotation.x = -0.38;   // 少し傾けて立体感
    return g;
  }


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     遺物C — 封印容器（箱）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function buildBox() {
    const g = new THREE.Group();

    // 本体
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.20, 0.88, 0.82),
      makeStone(0x4e3c2c)
    );
    box.castShadow = true;
    g.add(box);

    // ワイヤーエッジ（琥珀線）
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.21, 0.89, 0.83)),
      new THREE.LineBasicMaterial({
        color      : 0xc8900a,
        transparent: true,
        opacity    : 0.55,
      })
    );
    g.add(edges);

    // 封印の縦バー
    const vBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.70, 0.04),
      makeMetal(0x8b3a10, 0.65)
    );
    vBar.position.set(0, 0, 0.43);
    g.add(vBar);

    // 封印の横バー
    const hBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.00, 0.055, 0.04),
      makeMetal(0x8b3a10, 0.65)
    );
    hBar.position.set(0, 0, 0.43);
    g.add(hBar);

    // 錠前
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.19, 0.09),
      makeMetal(0x7a5020, 0.45)
    );
    lock.position.set(0, 0, 0.46);
    g.add(lock);

    // 錠前アーチ（トーラス半分で表現）
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.025, 8, 12, Math.PI),
      makeMetal(0x5a3a10, 0.55)
    );
    arch.position.set(0, 0.115, 0.46);
    g.add(arch);

    // 四隅の鋲
    [[-0.55, 0.38], [0.55, 0.38], [-0.55, -0.38], [0.55, -0.38]].forEach(([x, y]) => {
      const nail = new THREE.Mesh(
        new THREE.SphereGeometry(0.058, 10, 10),
        makeMetal(0x9a7030, 0.32)
      );
      nail.position.set(x, y, 0.43);
      g.add(nail);
    });

    return g;
  }


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     メッシュ配列の初期化
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const meshes = [buildCamera(), buildTorch(), buildBox()];
  meshes.forEach(m => { m.visible = false; scene.add(m); });


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     状態管理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  let currentIdx  = 0;
  let isHovered   = false;
  let isClicking  = false;
  let clickTimer  = null;
  const clock     = new THREE.Clock();

  /* 表示切替 */
  function showArtifact(idx) {
    meshes.forEach((m, i) => { m.visible = (i === idx); });
    const a = ARTIFACTS[idx];
    document.getElementById('artifact-name').textContent  = a.name;
    document.getElementById('artifact-desc').textContent  = a.desc;
    document.getElementById('artifact-label').textContent = a.label;
    document.getElementById('artifact-index').textContent = `${idx + 1} / ${ARTIFACTS.length}`;
    // メッシュの回転をリセット
    meshes[idx].rotation.set(0, 0, 0);
  }
  showArtifact(0);


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     アニメーションループ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function animate() {
    requestAnimationFrame(animate);

    const t    = clock.getElapsedTime();
    const mesh = meshes[currentIdx];

    // 浮遊（上下サイン）
    mesh.position.y = Math.sin(t * 0.85) * 0.13;

    // 通常回転 vs ホバー回転（速くなる）
    const spd = isHovered ? 0.026 : 0.007;
    mesh.rotation.y += spd;
    mesh.rotation.x += spd * 0.35;

    // クリック震え
    if (isClicking) {
      mesh.position.x = (Math.random() - 0.5) * 0.14;
      mesh.position.z = (Math.random() - 0.5) * 0.09;
    } else {
      mesh.position.x *= 0.85;   // 徐々に中央へ戻す
      mesh.position.z *= 0.85;
    }

    // ポイントライト強度（ホバー: 柔らかく点滅 / クリック: 強閃光）
    if (isClicking) {
      glowLight.intensity = 2.4 + Math.sin(t * 28) * 0.6;
    } else if (isHovered) {
      glowLight.intensity = 0.55 + Math.sin(t * 2.8) * 0.18;
    } else {
      glowLight.intensity *= 0.88;  // フェードアウト
    }

    renderer.render(scene, camera);
  }
  animate();


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     レンダラーサイズ調整
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function resizeRenderer() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     レイキャスト（ホバー & クリック判定）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const raycaster = new THREE.Raycaster();
  const mouse2D   = new THREE.Vector2();

  function setMouse(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouse2D.x =  ((clientX - rect.left)  / rect.width)  * 2 - 1;
    mouse2D.y = -((clientY - rect.top)   / rect.height) * 2 + 1;
  }

  function hitTest() {
    raycaster.setFromCamera(mouse2D, camera);
    return raycaster.intersectObject(meshes[currentIdx], true).length > 0;
  }

  // マウス移動 → ホバー判定
  canvas.addEventListener('mousemove', e => {
    setMouse(e.clientX, e.clientY);
    const hit = hitTest();
    if (hit !== isHovered) {
      isHovered = hit;
      canvas.style.cursor = hit ? 'pointer' : 'default';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    isHovered = false;
    canvas.style.cursor = 'default';
  });


  /* ─ クリック処理 ──────────────────────────────── */
  function triggerClick() {
    if (!hitTest()) return;

    // CSSフラッシュ
    canvasWrap.classList.add('clicking');
    setTimeout(() => canvasWrap.classList.remove('clicking'), 420);

    // 震え + 発光
    isClicking = true;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      isClicking = false;
      window.open(ARTIFACTS[currentIdx].url, '_blank', 'noopener,noreferrer');
    }, 380);
  }

  canvas.addEventListener('click', e => {
    setMouse(e.clientX, e.clientY);
    triggerClick();
  });

  // タッチ（スマホ）
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    setMouse(t.clientX, t.clientY);
    // タッチ時はホバー判定をtrueにしてからヒットテスト
    isHovered = true;
    triggerClick();
  }, { passive: false });


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     前 / 次ボタン
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  document.getElementById('artifact-prev').addEventListener('click', () => {
    currentIdx = (currentIdx - 1 + ARTIFACTS.length) % ARTIFACTS.length;
    showArtifact(currentIdx);
  });

  document.getElementById('artifact-next').addEventListener('click', () => {
    currentIdx = (currentIdx + 1) % ARTIFACTS.length;
    showArtifact(currentIdx);
  });


  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     折りたたみ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const collapseBtn  = document.getElementById('artifact-collapse-btn');
  const artifactBody = document.getElementById('artifact-body');
  let isCollapsed    = false;

  collapseBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    artifactBody.classList.toggle('collapsed', isCollapsed);
    collapseBtn.textContent   = isCollapsed ? '▲' : '▼';
    collapseBtn.title         = isCollapsed ? '展開する' : '折りたたむ';
    collapseBtn.setAttribute('aria-label', isCollapsed ? '展開する' : '折りたたむ');
  });

});
