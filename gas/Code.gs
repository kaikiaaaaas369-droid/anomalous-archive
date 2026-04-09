// ============================================================
//  Code.gs — 異常事象調査アーカイブ
//  Google Apps Script Web App
//
//  ▼ デプロイ手順
//    1. スプレッドシートを新規作成し、SPREADSHEET_ID を設定
//    2. GASエディタで「initSheet()」を一度手動実行
//    3. 「新しいデプロイ」→「ウェブアプリ」
//       実行者: 自分  /  アクセス: 全員
//    4. 発行されたWebアプリURLをフロントエンドの GAS_URL に貼る
//
//  Endpoints:
//    GET  ?action=list            → 全イベント一覧（JSON）
//    GET  ?action=endorse&id=N    → 信頼度 +1
//    POST (body: data=JSON文字列) → 新規イベント保存
// ============================================================

// ── ★ 設定欄 ────────────────────────────────────────────────
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // ← スプレッドシートIDを入力
const SHEET_NAME     = '事象記録';

const VALID_TYPES = ['幽霊・人影', '怪光・発光体', '怪音・異音', '変死・遺体', '空間異常', '不明'];


// ── doGet ────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) ? e.parameter.action : 'list';

    if (action === 'list')    return getEvents();
    if (action === 'endorse') return endorseEvent(e.parameter.id);

    return jsonOut({ status: 'error', message: '不明なアクション: ' + action });

  } catch (err) {
    Logger.log('[doGet] ' + err.toString());
    return jsonOut({ status: 'error', message: err.message });
  }
}


// ── doPost ───────────────────────────────────────────────────
//   CORS対策: フロントエンドは URLSearchParams で送信（プリフライト不要）
//   e.parameter.data に JSON文字列が入る
function doPost(e) {
  try {
    let raw = null;

    // ① URLエンコード形式（推奨: プリフライト不要でCORS安全）
    if (e.parameter && e.parameter.data) {
      raw = e.parameter.data;
    }
    // ② JSON ボディ形式（フォールバック）
    else if (e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }

    if (!raw) throw new Error('投稿データが空です');

    const data = JSON.parse(raw);

    // ── バリデーション ───────────────────────────────────────
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    if (isNaN(lat) || lat < -90  || lat > 90)  throw new Error('緯度が無効: ' + data.lat);
    if (isNaN(lng) || lng < -180 || lng > 180) throw new Error('経度が無効: ' + data.lng);

    const content = String(data.content || '').trim();
    if (!content)            throw new Error('内容が空です');
    if (content.length > 500) throw new Error('内容が500文字を超えています');

    const type = VALID_TYPES.includes(data.type) ? data.type : '不明';

    // ── スプレッドシートへ保存 ───────────────────────────────
    const sheet = getSheet();
    const newId = sheet.getLastRow(); // ヘッダー込みの行数 = 次のIDになる

    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
      lat,
      lng,
      content,
      type,
      0  // 初期信頼度
    ]);

    return jsonOut({ status: 'ok', id: newId });

  } catch (err) {
    Logger.log('[doPost] ' + err.toString());
    return jsonOut({ status: 'error', message: err.message });
  }
}


// ── 全イベント取得 ────────────────────────────────────────────
function getEvents() {
  const sheet  = getSheet();
  const values = sheet.getDataRange().getValues();
  const events = [];

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue; // 空行スキップ

    events.push({
      id          : i,
      datetime    : String(r[0]),
      lat         : parseFloat(r[1]),
      lng         : parseFloat(r[2]),
      content     : String(r[3]),
      type        : String(r[4]),
      reliability : parseInt(r[5]) || 0
    });
  }

  return jsonOut({ status: 'ok', events: events, count: events.length });
}


// ── 信頼度カウントアップ ──────────────────────────────────────
function endorseEvent(idStr) {
  const id = parseInt(idStr);
  if (isNaN(id) || id < 1) throw new Error('無効なID: ' + idStr);

  const sheet    = getSheet();
  const rowIndex = id + 1; // データ行は 2行目〜（1行目はヘッダー）

  if (rowIndex > sheet.getLastRow()) {
    throw new Error('ID ' + id + ' は存在しません');
  }

  const cell    = sheet.getRange(rowIndex, 6); // F列 = 信頼度
  const current = parseInt(cell.getValue()) || 0;
  const updated = current + 1;
  cell.setValue(updated);

  return jsonOut({ status: 'ok', id: id, reliability: updated });
}


// ── シート取得 / 初回作成 ─────────────────────────────────────
function getSheet() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupHeaders(sheet);
  }

  return sheet;
}

function setupHeaders(sheet) {
  sheet.appendRow(['日時', '緯度', '経度', '内容', '種別', '信頼度']);

  // ヘッダー書式
  const hdr = sheet.getRange(1, 1, 1, 6);
  hdr.setBackground('#0f0c08');
  hdr.setFontColor('#c8ae82');
  hdr.setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅
  sheet.setColumnWidth(1, 165);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 360);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 80);
}


// ── initSheet（初回のみ手動実行） ─────────────────────────────
function initSheet() {
  const sheet = getSheet();
  Logger.log('✓ シート「' + SHEET_NAME + '」を確認/作成しました');
  SpreadsheetApp.flush();
}


// ── jsonOut ──────────────────────────────────────────────────
//   GAS Web App は "Execute as: Me / Access: Anyone" でデプロイすると
//   ContentService のレスポンスに CORS ヘッダーが自動付与される
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  [将来] AI ボット統合スタブ
//  白衣の調査員（AGENT-7）に OpenAI API 等を接続する際はここに実装
//
//  function askAgent(userMessage) {
//    const OPENAI_API_KEY = PropertiesService.getScriptProperties()
//                            .getProperty('OPENAI_API_KEY');
//    const payload = {
//      model: 'gpt-4o',
//      messages: [
//        { role: 'system', content: 'あなたは異常事象を調査する謎の調査員AGENT-7です。...' },
//        { role: 'user',   content: userMessage }
//      ]
//    };
//    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
//      method: 'post',
//      headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY,
//                 'Content-Type': 'application/json' },
//      payload: JSON.stringify(payload),
//      muteHttpExceptions: true
//    });
//    return JSON.parse(res.getContentText()).choices[0].message.content;
//  }
// ============================================================
