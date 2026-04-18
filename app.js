'use strict';

/* ========== IndexedDB ========== */
const DB_NAME = 'HitokotoCalendarDB';
const DB_VER  = 1;
const STORE   = 'images';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess  = e => { db = e.target.result; resolve(db); };
    req.onerror    = e => reject(e.target.error);
  });
}

async function idbGet(key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbSet(key, value) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbDelete(key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

/* ========== ローカルストレージ ========== */
function loadEntries() {
  try { return JSON.parse(localStorage.getItem('entries') || '{}'); }
  catch { return {}; }
}
function saveEntries(entries) {
  localStorage.setItem('entries', JSON.stringify(entries));
}

/* ========== 状態 ========== */
const State = {
  tab:        'home',
  month:      new Date(),
  entries:    loadEntries(),   // { dateKey: { message, hasImage } }
  editKey:    null,            // 編集中の dateKey
  editBlob:   null,            // 編集中の画像 Blob
  editRemove: false,           // 既存写真を削除するか
};

/* ========== 日付ユーティリティ ========== */
function toKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayKey() { return toKey(new Date()); }

function formatDateJa(date) {
  const d = new Date(date);
  const days = ['日','月','火','水','木','金','土'];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}曜日`;
}

function formatMonthJa(date) {
  return `${date.getFullYear()}年 ${date.getMonth()+1}月`;
}

/* ========== Toast ========== */
let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ========== ホーム画面 ========== */
async function renderHome() {
  const el    = document.getElementById('home-content');
  const key   = todayKey();
  const entry = State.entries[key];

  let html = `<p class="home-date">${formatDateJa(new Date())}</p>`;

  // ① テキスト（主役）
  if (entry?.message) {
    html += `<div class="home-message">${escHtml(entry.message)}</div>`;
  } else {
    html += `
      <div class="home-empty">
        <svg width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>今日の一言はまだ登録されていません</p>
      </div>`;
  }

  // ② 添付写真（サブ）— テキストの下に小さく表示
  if (entry?.hasImage) {
    const blob = await idbGet(key);
    const url  = blob ? URL.createObjectURL(blob) : null;
    if (url) {
      html += `
        <div class="home-attachment" id="home-photo-wrap" data-key="${key}">
          <div class="attachment-label">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            添付写真
          </div>
          <img src="${url}" class="attachment-thumb" alt="添付写真">
          <div class="attachment-expand">タップで拡大 ⤢</div>
        </div>`;
    }
  }

  // ③ 写真を添付するボタン（控えめスタイル）
  html += `
    <div class="attach-row">
      <label class="btn-attach">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
        ${entry?.hasImage ? '写真を変更' : '写真を添付'}
        <input type="file" accept="image/*" class="hidden-input" id="home-photo-library">
      </label>
      <label class="btn-attach">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        撮影して添付
        <input type="file" accept="image/*" capture="environment" class="hidden-input" id="home-photo-camera">
      </label>
    </div>
    <button class="btn-primary" id="home-edit-btn">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      ${entry ? '一言を編集する' : '一言を登録する'}
    </button>`;

  el.innerHTML = html;

  document.getElementById('home-edit-btn')
    ?.addEventListener('click', () => openEditModal(key));
  document.getElementById('home-photo-wrap')
    ?.addEventListener('click', () => openFullscreen(key));
  ['home-photo-library', 'home-photo-camera'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      await quickSavePhoto(key, file);
      renderHome();
    });
  });
}

// 写真だけをホームから直接保存（一言はそのまま）
async function quickSavePhoto(key, file) {
  const blob = await resizeImage(file, 1200);
  await idbSet(key, blob);
  State.entries[key] = {
    ...(State.entries[key] || { message: '' }),
    hasImage: true,
  };
  saveEntries(State.entries);
  showToast('写真を保存しました');
}

/* ========== カレンダー画面 ========== */
function renderCalendar() {
  const el   = document.getElementById('calendar-content');
  const year = State.month.getFullYear();
  const mon  = State.month.getMonth();
  const firstDay  = new Date(year, mon, 1).getDay();
  const daysInMon = new Date(year, mon + 1, 0).getDate();
  const todayK    = todayKey();

  const weekdays = ['日','月','火','水','木','金','土'];

  let grid = '';
  // 空白セル
  for (let i = 0; i < firstDay; i++) grid += `<div class="cal-day empty"></div>`;
  // 日付セル
  for (let d = 1; d <= daysInMon; d++) {
    const date = new Date(year, mon, d);
    const key  = toKey(date);
    const dow  = date.getDay();
    const isToday = key === todayK;
    const hasEntry = !!State.entries[key];
    const classes = [
      'cal-day',
      dow === 0 ? 'sun' : '',
      dow === 6 ? 'sat' : '',
      isToday   ? 'today' : '',
      hasEntry  ? 'has-entry' : '',
    ].filter(Boolean).join(' ');

    grid += `
      <div class="${classes}" data-key="${key}">
        <div class="cal-day-num">${d}</div>
        <div class="cal-dot"></div>
      </div>`;
  }

  el.innerHTML = `
    <div class="cal-header">
      <button class="cal-nav-btn" id="cal-prev">&#8249;</button>
      <span class="cal-month-label">${formatMonthJa(State.month)}</span>
      <button class="cal-nav-btn" id="cal-next">&#8250;</button>
    </div>
    <div class="cal-weekdays">${weekdays.map(w => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid" id="cal-grid">${grid}</div>`;

  document.getElementById('cal-prev').addEventListener('click', () => {
    State.month = new Date(year, mon - 1, 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    State.month = new Date(year, mon + 1, 1);
    renderCalendar();
  });
  document.getElementById('cal-grid').addEventListener('click', e => {
    const cell = e.target.closest('[data-key]');
    if (cell) openEditModal(cell.dataset.key);
  });
}

/* ========== 設定画面 ========== */
function renderSettings() {
  const count = Object.keys(State.entries).length;
  const el = document.getElementById('settings-content');
  el.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">一括登録</div>
      <label class="settings-row" id="csv-import-row">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        CSVをインポート
        <input type="file" accept=".csv,text/csv,text/plain" class="hidden-input" id="csv-file-input">
        <span class="settings-value">›</span>
      </label>
      <p class="settings-note">
        形式: 1列目=日付（yyyy-MM-dd など）、2列目=一言<br>
        先頭行に「日付」があればスキップします。
      </p>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">登録状況</div>
      <div class="settings-row" style="cursor:default">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        登録件数
        <span class="settings-value">${count} 件</span>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">このアプリについて</div>
      <div class="settings-row" style="cursor:default;font-size:14px;color:var(--text2);display:block;line-height:1.6">
        カレンダーの日付をタップすると、その日の一言と写真を登録できます。<br>
        ホーム画面から今日の写真を直接追加することもできます。
      </div>
    </div>`;

  document.getElementById('csv-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importCSV(file);
    e.target.value = '';
  });
}

/* ========== CSV インポート ========== */
function importCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const rows = parseCSV(text);
    let count  = 0;
    rows.forEach(([dateStr, message]) => {
      const date = parseDate(dateStr);
      if (!date) return;
      const key = toKey(date);
      State.entries[key] = {
        ...(State.entries[key] || {}),
        message: message.trim(),
        hasImage: State.entries[key]?.hasImage || false,
      };
      count++;
    });
    saveEntries(State.entries);
    showToast(`✓ ${count} 件をインポートしました`);
    renderCurrentView();
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    if (i === 0 && /日付|date/i.test(line)) return;
    const fields = splitCSVLine(line);
    if (fields.length >= 2) result.push([fields[0], fields[1]]);
  });
  return result;
}

function splitCSVLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields.map(f => f.trim().replace(/^"|"$/g, ''));
}

function parseDate(s) {
  const t = s.trim().replace(/[\/\.年]/g, '-').replace(/[月日]/g, '');
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]);
}

/* ========== 編集モーダル ========== */
function openEditModal(key) {
  State.editKey    = key;
  State.editBlob   = null;
  State.editRemove = false;

  const entry = State.entries[key];
  const [y, m, d] = key.split('-');
  const date = new Date(+y, +m-1, +d);

  // 日付ラベル
  document.getElementById('modal-title').textContent = formatDateJa(date);

  // テキスト
  document.getElementById('modal-message').value = entry?.message || '';

  // 写真プレビューをリセット
  const preview = document.getElementById('modal-photo-preview');
  const img     = document.getElementById('modal-photo-img');
  preview.classList.add('hidden');
  img.src = '';

  // 削除ボタン
  document.getElementById('modal-delete').classList.toggle('hidden', !entry);

  // 既存写真を読み込む
  if (entry?.hasImage) {
    idbGet(key).then(blob => {
      if (blob) {
        img.src = URL.createObjectURL(blob);
        preview.classList.remove('hidden');
      }
    });
  }

  // 表示
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-edit').classList.remove('hidden');
  requestAnimationFrame(() => {
    document.getElementById('modal-edit').classList.add('open');
  });
}

function closeEditModal() {
  const modal = document.getElementById('modal-edit');
  modal.classList.remove('open');
  setTimeout(() => {
    modal.classList.add('hidden');
    document.getElementById('modal-backdrop').classList.add('hidden');
  }, 300);
}

async function saveEntry() {
  const key     = State.editKey;
  const message = document.getElementById('modal-message').value.trim();

  // 写真の処理
  let hasImage = State.entries[key]?.hasImage || false;
  if (State.editRemove) {
    await idbDelete(key);
    hasImage = false;
  }
  if (State.editBlob) {
    await idbSet(key, State.editBlob);
    hasImage = true;
  }

  // エントリ保存
  if (!message && !hasImage) {
    delete State.entries[key];
  } else {
    State.entries[key] = { message, hasImage };
  }
  saveEntries(State.entries);
  closeEditModal();
  renderCurrentView();
  showToast('保存しました');
}

async function deleteEntry() {
  if (!confirm('この日の一言を削除しますか？')) return;
  const key = State.editKey;
  await idbDelete(key);
  delete State.entries[key];
  saveEntries(State.entries);
  closeEditModal();
  renderCurrentView();
  showToast('削除しました');
}

/* ========== 全画面写真ビュワー ========== */
async function openFullscreen(key) {
  const blob = await idbGet(key);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const img = document.getElementById('fullscreen-img');
  img.src = url;
  document.getElementById('fullscreen-viewer').classList.remove('hidden');
  resetZoom();
}

function closeFullscreen() {
  document.getElementById('fullscreen-viewer').classList.add('hidden');
  const img = document.getElementById('fullscreen-img');
  URL.revokeObjectURL(img.src);
  img.src = '';
}

/* === ピンチズーム（全画面） === */
let pinchState = { scale: 1, lastScale: 1, x: 0, y: 0, lastX: 0, lastY: 0 };

function resetZoom() {
  pinchState = { scale: 1, lastScale: 1, x: 0, y: 0, lastX: 0, lastY: 0 };
  applyZoom();
}

function applyZoom() {
  const img = document.getElementById('fullscreen-img');
  img.style.transform = `translate(${pinchState.x}px, ${pinchState.y}px) scale(${pinchState.scale})`;
}

/* ========== 画像リサイズ ========== */
function resizeImage(file, maxPx) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else       { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.85);
    };
    img.src = URL.createObjectURL(file);
  });
}

/* ========== HTML エスケープ ========== */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

/* ========== タブ切替 ========== */
function switchTab(tab) {
  State.tab = tab;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById(`view-${tab}`).classList.add('active');
  renderCurrentView();
}

function renderCurrentView() {
  if (State.tab === 'home')     renderHome();
  if (State.tab === 'calendar') renderCalendar();
  if (State.tab === 'settings') renderSettings();
}

/* ========== 全画面タッチ操作 ========== */
function setupFullscreenGestures() {
  const wrap = document.getElementById('fullscreen-img-wrap');
  let touches = [], startDist = 0, startScale = 1;
  let startX = 0, startY = 0, startPX = 0, startPY = 0;
  let lastTap = 0;

  wrap.addEventListener('touchstart', e => {
    touches = [...e.touches];
    if (touches.length === 2) {
      startDist  = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY);
      startScale = pinchState.scale;
    }
    if (touches.length === 1) {
      startX = touches[0].clientX;
      startY = touches[0].clientY;
      startPX = pinchState.x;
      startPY = pinchState.y;
    }
    // ダブルタップ
    const now = Date.now();
    if (now - lastTap < 300 && touches.length === 1) {
      if (pinchState.scale > 1) { resetZoom(); }
      else { pinchState.scale = 2.5; applyZoom(); }
    }
    lastTap = now;
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    e.preventDefault();
    const ts = [...e.touches];
    if (ts.length === 2) {
      const dist = Math.hypot(
        ts[0].clientX - ts[1].clientX,
        ts[0].clientY - ts[1].clientY);
      pinchState.scale = Math.max(1, Math.min(5, startScale * (dist / startDist)));
      applyZoom();
    } else if (ts.length === 1 && pinchState.scale > 1) {
      pinchState.x = startPX + ts[0].clientX - startX;
      pinchState.y = startPY + ts[0].clientY - startY;
      applyZoom();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', () => {
    pinchState.lastScale = pinchState.scale;
    if (pinchState.scale <= 1) resetZoom();
  });
}

/* ========== モーダル内写真イベント ========== */
function setupModalPhotoEvents() {
  ['photo-library', 'photo-camera'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      State.editBlob   = await resizeImage(file, 1200);
      State.editRemove = false;
      const preview = document.getElementById('modal-photo-preview');
      const img     = document.getElementById('modal-photo-img');
      img.src = URL.createObjectURL(State.editBlob);
      preview.classList.remove('hidden');
      e.target.value = '';
    });
  });

  document.getElementById('modal-photo-remove')?.addEventListener('click', () => {
    State.editBlob   = null;
    State.editRemove = true;
    document.getElementById('modal-photo-preview').classList.add('hidden');
    document.getElementById('modal-photo-img').src = '';
  });
}

/* ========== 初期化 ========== */
function init() {
  // サービスワーカー登録
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // タブ切替
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // モーダル: 保存 / キャンセル / 削除
  document.getElementById('modal-save').addEventListener('click', saveEntry);
  document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeEditModal);
  document.getElementById('modal-delete').addEventListener('click', deleteEntry);

  // 全画面を閉じる
  document.getElementById('fullscreen-close').addEventListener('click', closeFullscreen);

  // モーダル内写真入力
  setupModalPhotoEvents();

  // 全画面ジェスチャー
  setupFullscreenGestures();

  // 初期画面
  renderHome();
}

document.addEventListener('DOMContentLoaded', init);
