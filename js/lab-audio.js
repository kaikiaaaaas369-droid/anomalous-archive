/* ============================================================
   異常事象調査アーカイブ — lab-audio.js
   研究室入室 SE（Web Audio API による擬似音生成）

   音声ファイルが用意できた場合は、各関数内の
   「ファイル差し替えポイント」コメント箇所に
   AudioBufferSourceNode によるデコード・再生処理を追加する。
   ============================================================ */
'use strict';

let _audioCtx = null;
let _masterGain = null;

/* ── AudioContext 取得（遅延初期化） ─────────────────────── */
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _audioCtx.createGain();
    _masterGain.gain.value = 0.82;
    _masterGain.connect(_audioCtx.destination);
  }
  return _audioCtx;
}

/* ── 内部ユーティリティ ─────────────────────────────────── */

/** ノイズバッファを生成する */
function _makeNoiseBuffer(ctx, duration) {
  const len  = Math.floor(ctx.sampleRate * duration);
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** BiquadFilterNode チェーンを一括接続して最後のノードを返す */
function _chain(ctx, ...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  nodes[nodes.length - 1].connect(_masterGain ?? ctx.destination);
  return nodes[0];
}


/* ══════════════════════════════════════════════════════════
   1. 廊下の足音（革靴 × 木の床）

   ファイル差し替えポイント:
     assets/audio/footstep.wav などを fetch して
     ctx.decodeAudioData() で読み込み、
     AudioBufferSourceNode.start(when) で再生
   ══════════════════════════════════════════════════════════ */

/**
 * 単発の足音を合成する
 * @param {AudioContext} ctx
 * @param {number}       when  - スケジュール時刻（ctx.currentTime + offset）
 * @param {number}       vel   - 速度感 0–1（1 で最大音量）
 */
function _synthStep(ctx, when, vel = 0.8) {
  /* ── 衝撃ノイズ ── */
  const impactLen  = Math.floor(ctx.sampleRate * 0.055);
  const impactBuf  = ctx.createBuffer(1, impactLen, ctx.sampleRate);
  const impactData = impactBuf.getChannelData(0);
  for (let i = 0; i < impactLen; i++) {
    impactData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impactLen, 6);
  }
  const impactSrc = ctx.createBufferSource();
  impactSrc.buffer = impactBuf;

  /* ── 残響ノイズ（木の響き） ── */
  const tailSrc = ctx.createBufferSource();
  tailSrc.buffer = _makeNoiseBuffer(ctx, 0.14);

  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(vel * 0.12, when);
  tailGain.gain.exponentialRampToValueAtTime(0.001, when + 0.13);

  /* ── フィルタ（革靴っぽい重低音域） ── */
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 140 + Math.random() * 50;
  bp.Q.value = 0.7;

  const ls = ctx.createBiquadFilter();  // 低域強調
  ls.type = 'lowshelf';
  ls.frequency.value = 220;
  ls.gain.value = 9;

  const impGain = ctx.createGain();
  impGain.gain.value = vel * 0.7;

  /* ── 接続 ── */
  impactSrc.connect(bp);
  tailSrc.connect(tailGain);
  bp.connect(ls);
  ls.connect(impGain);
  impGain.connect(_masterGain);
  tailGain.connect(_masterGain);

  impactSrc.start(when);
  tailSrc.start(when + 0.01);
}

/**
 * 廊下歩行シーケンス（コツ……コツ……）
 * @param {number} duration  - 合計再生時間（秒）
 * @param {Function} onDone  - 再生完了コールバック
 */
function playFootsteps(duration = 3.0, onDone) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  /* 歩幅: 最初は速め（0.50s）→ ドア前でゆっくり（0.72s） */
  let t = now + 0.25;
  while (t < now + duration - 0.15) {
    const progress = (t - now) / duration;
    const interval = 0.50 + (progress > 0.55 ? (progress - 0.55) / 0.45 * 0.22 : 0);
    const vel      = 0.75 + Math.random() * 0.2;
    _synthStep(ctx, t, vel);
    t += interval;
  }

  /* 最後の一歩（止まる） */
  _synthStep(ctx, t, 0.6);

  if (typeof onDone === 'function') {
    setTimeout(onDone, duration * 1000 + 100);
  }
}


/* ══════════════════════════════════════════════════════════
   2. ドアの軋み音（ギィィ……）

   ファイル差し替えポイント:
     assets/audio/door-creak.wav
   ══════════════════════════════════════════════════════════ */

/**
 * 重い木製ドアが開く軋み音を合成する（約1.8秒）
 * @param {Function} onDone
 */
function playDoorCreak(onDone) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const dur = 1.85;

  /**
   * 軋み音レイヤー
   * @param {OscillatorType} type
   * @param {number} f0, f1, f2 - 周波数の始点・頂点・終点
   * @param {number} amp
   */
  function layer(type, f0, f1, f2, amp) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.linearRampToValueAtTime(f1, now + dur * 0.38);
    osc.frequency.linearRampToValueAtTime(f2, now + dur);

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 680;
    filt.Q.value = 5.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.07);
    g.gain.setValueAtTime(amp * 0.85, now + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filt);
    filt.connect(g);
    g.connect(_masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  layer('sawtooth', 52,  215, 36,  0.22);  // 低域 ＝ 扉の質量感
  layer('square',   88,  410, 62,  0.10);  // 中域 ＝ 木の摩擦
  layer('sine',    220,  560, 175, 0.055); // 高域 ＝ 金属ヒンジ

  /* 微かな空気感（狭帯域ノイズ） */
  const nSrc = ctx.createBufferSource();
  nSrc.buffer = _makeNoiseBuffer(ctx, dur);
  const nBP = ctx.createBiquadFilter();
  nBP.type = 'bandpass';
  nBP.frequency.value = 900;
  nBP.Q.value = 8;
  const nG = ctx.createGain();
  nG.gain.setValueAtTime(0.04, now);
  nG.gain.exponentialRampToValueAtTime(0.001, now + dur);
  nSrc.connect(nBP);
  nBP.connect(nG);
  nG.connect(_masterGain);
  nSrc.start(now);

  if (typeof onDone === 'function') {
    setTimeout(onDone, dur * 1000 + 80);
  }
}


/* ══════════════════════════════════════════════════════════
   3. 着席音（椅子の軋み + 衣擦れ）

   ファイル差し替えポイント:
     assets/audio/seat-creak.wav
   ══════════════════════════════════════════════════════════ */

/**
 * 椅子に腰掛ける音（椅子軋み + 衣擦れノイズ）
 */
function playSeated() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  /* 椅子の軋み（鋸歯状波 → 周波数を下方へスウィープ） */
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(175, now);
  osc.frequency.exponentialRampToValueAtTime(52, now + 0.42);

  const cf = ctx.createBiquadFilter();
  cf.type = 'lowpass';
  cf.frequency.setValueAtTime(2200, now);
  cf.frequency.exponentialRampToValueAtTime(400, now + 0.42);

  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.20, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

  osc.connect(cf);
  cf.connect(cg);
  cg.connect(_masterGain);
  osc.start(now);
  osc.stop(now + 0.55);

  /* 衣擦れ（高周波ノイズ バースト） */
  const rLen  = Math.floor(ctx.sampleRate * 0.28);
  const rBuf  = ctx.createBuffer(1, rLen, ctx.sampleRate);
  const rData = rBuf.getChannelData(0);
  for (let i = 0; i < rLen; i++) {
    rData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rLen, 1.6) * 0.14;
  }
  const rSrc = ctx.createBufferSource();
  rSrc.buffer = rBuf;

  const rHP = ctx.createBiquadFilter();
  rHP.type = 'highpass';
  rHP.frequency.value = 3800;

  const rG = ctx.createGain();
  rG.gain.value = 0.55;

  rSrc.connect(rHP);
  rHP.connect(rG);
  rG.connect(_masterGain);
  rSrc.start(now + 0.12); // 椅子軋みより少し遅れて

  /* 深呼吸っぽい低域バースト（着席した安堵感） */
  const bOsc = ctx.createOscillator();
  bOsc.type = 'sine';
  bOsc.frequency.value = 80;
  const bG = ctx.createGain();
  bG.gain.setValueAtTime(0, now + 0.05);
  bG.gain.linearRampToValueAtTime(0.04, now + 0.2);
  bG.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  bOsc.connect(bG);
  bG.connect(_masterGain);
  bOsc.start(now + 0.05);
  bOsc.stop(now + 0.6);
}


/* ══════════════════════════════════════════════════════════
   将来のオーディオファイル読み込み用スタブ

   assets/audio/ に wav/mp3 を配置して使う場合の
   テンプレート関数（現在は未使用）
   ══════════════════════════════════════════════════════════ */
async function _loadAudioFile(url) {
  const ctx = getAudioCtx();
  try {
    const res = await fetch(url);
    const ab  = await res.arrayBuffer();
    return await ctx.decodeAudioData(ab);
  } catch (err) {
    console.warn(`[lab-audio] ファイル読込失敗 (${url})、合成音にフォールバック:`, err);
    return null;
  }
}
