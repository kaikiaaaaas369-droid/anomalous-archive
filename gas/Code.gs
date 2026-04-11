// ============================================================
//  Code.gs — 異常事象調査アーカイブ
//  Google Apps Script Web App
//
//  Endpoints:
//    GET  ?action=list                       → 全イベント一覧
//    GET  ?action=endorse&id=N              → 信頼度 +1
//    GET  ?action=comments&id=N             → コメント一覧
//    GET  ?action=update&id=N&lat=X&lng=Y   → 座標更新（管理用）
//    POST (data=JSON)                        → 新規イベント保存
//    POST (data=JSON{ action:'addComment' }) → コメント追加
// ============================================================

// ── ★ 設定欄 ────────────────────────────────────────────────
const SPREADSHEET_ID     = 'YOUR_SPREADSHEET_ID_HERE'; // ← GASエディタで設定済みのIDをそのまま使用
const SHEET_NAME         = '事象記録';
const COMMENT_SHEET_NAME = 'コメント';

const VALID_TYPES = ['幽霊・人影', '怪光・発光体', '怪音・異音', '変死・遺体', '空間異常', '不明'];


// ── doGet ────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) ? e.parameter.action : 'list';

    if (action === 'list')     return getEvents();
    if (action === 'endorse')  return endorseEvent(e.parameter.id);
    if (action === 'comments') return getComments(e.parameter.id);
    if (action === 'update')   return updateEventCoords(
                                        e.parameter.id,
                                        e.parameter.lat,
                                        e.parameter.lng
                                      );

    return jsonOut({ status: 'error', message: '不明なアクション: ' + action });

  } catch (err) {
    Logger.log('[doGet] ' + err.toString());
    return jsonOut({ status: 'error', message: err.message });
  }
}


// ── doPost ───────────────────────────────────────────────────
function doPost(e) {
  try {
    let raw = null;
    if (e.parameter && e.parameter.data) {
      raw = e.parameter.data;
    } else if (e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }
    if (!raw) throw new Error('投稿データが空です');

    const data = JSON.parse(raw);

    // コメント追加
    if (data.action === 'addComment') return addComment(data);

    // ── 新規イベント保存 ─────────────────────────────────────
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    if (isNaN(lat) || lat < -90  || lat > 90)  throw new Error('緯度が無効: ' + data.lat);
    if (isNaN(lng) || lng < -180 || lng > 180) throw new Error('経度が無効: ' + data.lng);

    const content = String(data.content || '').trim();
    if (!content) throw new Error('内容が空です');
    if (content.length > 500) throw new Error('内容が500文字を超えています');

    const type = VALID_TYPES.includes(data.type) ? data.type : '不明';

    const sheet = getSheet();
    const newId = sheet.getLastRow();

    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
      lat,
      lng,
      content,
      type,
      0
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
    if (!r[0]) continue;

    events.push({
      id         : i,
      datetime   : String(r[0]),
      lat        : parseFloat(r[1]),
      lng        : parseFloat(r[2]),
      content    : String(r[3]),
      type       : String(r[4]),
      reliability: parseInt(r[5]) || 0
    });
  }

  return jsonOut({ status: 'ok', events: events, count: events.length });
}


// ── 信頼度カウントアップ ──────────────────────────────────────
function endorseEvent(idStr) {
  const id = parseInt(idStr);
  if (isNaN(id) || id < 1) throw new Error('無効なID: ' + idStr);

  const sheet    = getSheet();
  const rowIndex = id + 1;

  if (rowIndex > sheet.getLastRow()) throw new Error('ID ' + id + ' は存在しません');

  const cell    = sheet.getRange(rowIndex, 6);
  const current = parseInt(cell.getValue()) || 0;
  const updated = current + 1;
  cell.setValue(updated);

  return jsonOut({ status: 'ok', id: id, reliability: updated });
}


// ── 座標更新（管理用） ───────────────────────────────────────
function updateEventCoords(idStr, latStr, lngStr) {
  const id  = parseInt(idStr);
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(id))  throw new Error('IDが無効');
  if (isNaN(lat)) throw new Error('緯度が無効');
  if (isNaN(lng)) throw new Error('経度が無効');

  const sheet    = getSheet();
  const rowIndex = id + 1;

  if (rowIndex > sheet.getLastRow()) throw new Error('ID ' + id + ' は存在しません');

  sheet.getRange(rowIndex, 2).setValue(lat);
  sheet.getRange(rowIndex, 3).setValue(lng);

  return jsonOut({ status: 'ok', id: id, lat: lat, lng: lng });
}


// ── コメント一覧取得 ─────────────────────────────────────────
function getComments(idStr) {
  const id = parseInt(idStr);
  if (isNaN(id) || id < 1) throw new Error('無効なID: ' + idStr);

  const sheet    = getCommentSheet();
  const lastRow  = sheet.getLastRow();
  if (lastRow < 2) return jsonOut({ status: 'ok', comments: [] });

  const values   = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const comments = [];

  values.forEach(function(r) {
    if (parseInt(r[0]) === id && r[2]) {
      comments.push({
        datetime: String(r[1]),
        comment : String(r[2])
      });
    }
  });

  return jsonOut({ status: 'ok', comments: comments });
}


// ── コメント追加 ─────────────────────────────────────────────
function addComment(data) {
  const eventId = parseInt(data.eventId);
  if (isNaN(eventId) || eventId < 1) throw new Error('無効なイベントID');

  const comment = String(data.comment || '').trim();
  if (!comment) throw new Error('コメントが空です');
  // 文字数制限なし

  const sheet = getCommentSheet();
  sheet.appendRow([
    eventId,
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    comment
  ]);

  return jsonOut({ status: 'ok' });
}


// ── シート取得 ────────────────────────────────────────────────
function getSheet() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupEventHeaders(sheet);
  }
  return sheet;
}

function getCommentSheet() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(COMMENT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(COMMENT_SHEET_NAME);
    setupCommentHeaders(sheet);
  }
  return sheet;
}

function setupEventHeaders(sheet) {
  sheet.appendRow(['日時', '緯度', '経度', '内容', '種別', '信頼度']);
  const hdr = sheet.getRange(1, 1, 1, 6);
  hdr.setBackground('#0f0c08');
  hdr.setFontColor('#c8ae82');
  hdr.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 165);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 360);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 80);
}

function setupCommentHeaders(sheet) {
  sheet.appendRow(['event_id', '日時', 'コメント']);
  const hdr = sheet.getRange(1, 1, 1, 3);
  hdr.setBackground('#0f0c08');
  hdr.setFontColor('#c8ae82');
  hdr.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 165);
  sheet.setColumnWidth(3, 500);
}


// ── initSheet（初回のみ手動実行） ─────────────────────────────
function initSheet() {
  getSheet();
  getCommentSheet();
  Logger.log('✓ シートを確認/作成しました');
  SpreadsheetApp.flush();
}


// ── jsonOut ──────────────────────────────────────────────────
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
