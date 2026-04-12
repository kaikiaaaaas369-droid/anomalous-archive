/* ============================================================
   異常事象調査アーカイブ — firebase-config.js
   Firebase プロジェクト設定テンプレート

   【セットアップ手順】
   1. https://console.firebase.google.com でプロジェクトを作成
   2. 「ウェブアプリを追加」を選択してアプリを登録
   3. 「SDK の設定と構成」に表示された値を下記に貼り付け
   4. Firebase コンソール → Firestore Database → 「データベースの作成」
   5. セキュリティルールは firestore.rules を参照して設定

   ※ このファイルを GitHub に公開する場合、Firebase セキュリティルールで
      書き込み条件を必ず設定してください（apiKey は公開前提です）
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey           : 'YOUR_API_KEY',
  authDomain       : 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId        : 'YOUR_PROJECT_ID',
  storageBucket    : 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId            : 'YOUR_APP_ID',
};
