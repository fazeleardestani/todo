/* =========================================================
   همراه - دستیار هوشمند شخصی آفلاین‌محور (PWA)
   بدون وابستگی خارجی - قابل اجرا روی GitHub Pages
   ========================================================= */

const CATEGORY_META = {
  work: { label: 'کار و مدیریت', color: '#30411F' },
  project: { label: 'پروژه‌ها', color: '#5A7247' },
  personal: { label: 'شخصی و روزمره', color: '#8C7A5B' },
  self: { label: 'خودم، رشد و استراحت', color: '#3B6E4C' }
};

const PRIORITY_META = {
  high: 'فوری / مهم',
  medium: 'عادی',
  low: 'کم‌اولویت'
};

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const PERSIAN_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'
];

// ---------- ابزارهای تاریخ شمسی (۱۰۰٪ آفلاین) ----------
function toPersianDigits(input) {
  return String(input).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function toEnglishDigits(input) {
  return String(input)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function formatJalaliFromISO(isoDateStr) {
  if (!isoDateStr) return 'بدون تاریخ';
  const [y, m, d] = isoDateStr.split('-').map(Number);
  if (!y || !m || !d) return 'بدون تاریخ';
  const dateObj = new Date(y, m - 1, d);
  const { jy, jm, jd } = gregorianToJalali(y, m, d);
  const weekday = PERSIAN_WEEKDAYS[dateObj.getDay()];
  return `${weekday} ${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

function getTodayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isTaskOverdue(task) {
  if (task.done || !task.dueDate) return false;
  const now = new Date();
  const dueStr = `${task.dueDate}T${task.dueTime || '23:59'}:00`;
  return new Date(dueStr).getTime() < now.getTime();
}

// ---------- دیتابیس محلی IndexedDB ----------
class LocalDB {
  constructor() {
    this.dbName = 'HamrahAssistantDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// ---------- وضعیت برنامه ----------
const db = new LocalDB();
let state = {
  tasks: [],
  messages: [],
  filter: 'all',
  settings: {
    aiProvider: 'offline',
    aiApiKey: '',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gemini-2.5-flash',
    baleToken: '',
    baleChatId: ''
  }
};

let deferredInstallPrompt = null;
let recognition = null;
let isRecording = false;

// ---------- تنظیمات و ذخیره ----------
function loadSettings() {
  try {
    const saved = localStorage.getItem('hamrah_settings');
    if (saved) {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

function saveSettingsToStorage() {
  localStorage.setItem('hamrah_settings', JSON.stringify(state.settings));
}

// ---------- اعلان (Toast) و صدای آرام یادآور ----------
function showToast(text, urgent = false) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${urgent ? 'urgent' : ''}`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

// ---------- خروجی تقویم گوشی (.ics) برای ریمایندر ۱۰۰٪ آفلاین ----------
function downloadTaskICS(task) {
  const datePart = (task.dueDate || getTodayISO()).replace(/-/g, '');
  const timePart = (task.dueTime || '09:00').replace(':', '') + '00';
  const startStamp = `${datePart}T${timePart}`;
  const endDateObj = new Date(`${task.dueDate || getTodayISO()}T${task.dueTime || '09:00'}:00`);
  endDateObj.setMinutes(endDateObj.getMinutes() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  const endStamp =
    `${endDateObj.getFullYear()}${pad(endDateObj.getMonth() + 1)}${pad(endDateObj.getDate())}` +
    `T${pad(endDateObj.getHours())}${pad(endDateObj.getMinutes())}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hamrah Assistant//FA',
    'BEGIN:VEVENT',
    `UID:${task.id}@hamrah`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${task.title}`,
    `DESCRIPTION:${task.notes || 'یادآور ثبت‌شده در دستیار همراه'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:یادآور: ${task.title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reminder-${task.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('فایل تقویم دانلود شد؛ با باز کردن آن، یادآور روی گوشی ثبت می‌شود.');
}

// ---------- ارسال ریمایندر به پیام‌رسان بله ----------
async function sendBaleReminder(text) {
  const { baleToken, baleChatId } = state.settings;
  if (!baleToken || !baleChatId) return false;
  const url = `https://tapi.bale.ai/bot${encodeURIComponent(baleToken)}/sendMessage?chat_id=${encodeURIComponent(baleChatId)}&text=${encodeURIComponent(text)}`;
  try {
    await fetch(url, { mode: 'no-cors' });
    return true;
  } catch (err) {
    console.error('Bale reminder failed:', err);
    return false;
  }
}

// ---------- موتور بررسی ریمایندرها (هر ۳۰ ثانیه) ----------
async function checkReminders() {
  const now = new Date();
  let changed = false;

  for (const task of state.tasks) {
    if (task.done || task.reminded || !task.dueDate || !task.dueTime) continue;
    const dueTimeMs = new Date(`${task.dueDate}T${task.dueTime}:00`).getTime();
    if (now.getTime() >= dueTimeMs) {
      task.reminded = true;
      await db.put('tasks', task);
      changed = true;

      const msgText = `⏰ یادآور کار: ${task.title}\nبخش: ${CATEGORY_META[task.category]?.label || 'کار'}`;
      playGentleChime();
      showToast(msgText, true);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('یادآور همراه', {
          body: `${task.title} (${CATEGORY_META[task.category]?.label || ''})`,
          tag: task.id
        });
      }

      if (state.settings.baleToken && state.settings.baleChatId) {
        sendBaleReminder(msgText);
      }
    }
  }

  if (changed) renderAll();
}

// ---------- پارسر هوشمند فارسی (۱۰۰٪ آفلاین) ----------
function parsePersianTaskOffline(rawText) {
  const text = toEnglishDigits(rawText.trim());
  let cleanTitle = text;
  let dueDate = getTodayISO(0);
  let dueTime = '';
  let priority = 'medium';
  let category = 'work';

  // ۱. استخراج تاریخ
  if (/پس\s*فردا/.test(text)) {
    dueDate = getTodayISO(2);
    cleanTitle = cleanTitle.replace(/پس\s*فردا/g, '');
  } else if (/فردا/.test(text)) {
    dueDate = getTodayISO(1);
    cleanTitle = cleanTitle.replace(/فردا/g, '');
  } else if (/امروز/.test(text)) {
    dueDate = getTodayISO(0);
    cleanTitle = cleanTitle.replace(/امروز/g, '');
  } else {
    const daysMatch = text.match(/(\d+)\s*روز\s*(دیگه|دیگر|بعد)/);
    if (daysMatch) {
      dueDate = getTodayISO(parseInt(daysMatch[1], 10));
      cleanTitle = cleanTitle.replace(daysMatch[0], '');
    } else {
      const weekdayMap = {
        'یکشنبه': 0, 'یک‌شنبه': 0,
        'دوشنبه': 1,
        'سه‌شنبه': 2, 'سه شنبه': 2,
        'چهارشنبه': 3,
        'پنجشنبه': 4, 'پنج‌شنبه': 4,
        'جمعه': 5,
        'شنبه': 6
      };
      for (const [dayName, targetDay] of Object.entries(weekdayMap)) {
        if (text.includes(dayName)) {
          const todayDay = new Date().getDay();
          let diff = (targetDay - todayDay + 7) % 7;
          if (diff === 0) diff = 7;
          dueDate = getTodayISO(diff);
          cleanTitle = cleanTitle.replace(dayName, '');
          break;
        }
      }
    }
  }

  // ۲. استخراج ساعت
  const exactTimeMatch = text.match(/(?:ساعت\s*)?(\d{1,2})\s*[:و]\s*(\d{1,2}|نیم)/);
  if (exactTimeMatch) {
    let h = parseInt(exactTimeMatch[1], 10);
    const m = exactTimeMatch[2] === 'نیم' ? 30 : parseInt(exactTimeMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      cleanTitle = cleanTitle.replace(exactTimeMatch[0], '');
    }
  } else {
    const hourOnlyMatch = text.match(/ساعت\s*(\d{1,2})/);
    if (hourOnlyMatch) {
      let h = parseInt(hourOnlyMatch[1], 10);
      if (/عصر|شب|بعدازظهر/.test(text) && h < 12) h += 12;
      if (h >= 0 && h <= 23) {
        dueTime = `${String(h).padStart(2, '0')}:00`;
        cleanTitle = cleanTitle.replace(hourOnlyMatch[0], '');
      }
    } else if (/صبح/.test(text)) {
      dueTime = '09:00';
      cleanTitle = cleanTitle.replace(/صبح/g, '');
    } else if (/ظهر/.test(text)) {
      dueTime = '13:00';
      cleanTitle = cleanTitle.replace(/ظهر/g, '');
    } else if (/عصر/.test(text)) {
      dueTime = '17:00';
      cleanTitle = cleanTitle.replace(/عصر/g, '');
    } else if (/شب/.test(text)) {
      dueTime = '21:00';
      cleanTitle = cleanTitle.replace(/شب/g, '');
    }
  }

  // ۳. استخراج اولویت
  if (/(فوری|مهم|اضطراری|حتما|مدیر)/.test(text)) {
    priority = 'high';
    cleanTitle = cleanTitle.replace(/#?(فوری|اضطراری)/g, '');
  } else if (/(کم‌اولویت|بعدا|هروقت)/.test(text)) {
    priority = 'low';
  }

  // ۴. استخراج دسته‌بندی چندبعدی
  if (/#پروژه|پروژه|کد|سایت|طراحی/.test(text)) {
    category = 'project';
    cleanTitle = cleanTitle.replace(/#پروژه/g, '');
  } else if (/#شخصی|خرید|خونه|خانه|خانواده|بانک/.test(text)) {
    category = 'personal';
    cleanTitle = cleanTitle.replace(/#شخصی/g, '');
  } else if (/#خودم|استراحت|کتاب|ورزش|تفریح|فیلم|زبان/.test(text)) {
    category = 'self';
    cleanTitle = cleanTitle.replace(/#خودم/g, '');
  } else {
    category = 'work';
    cleanTitle = cleanTitle.replace(/#کار/g, '');
  }

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
  if (!cleanTitle) cleanTitle = rawText.trim();

  return {
    title: cleanTitle,
    dueDate,
    dueTime,
    priority,
    category
  };
}

// ---------- پاسخ‌دهی آفلاین دستیار ----------
async function handleOfflineAssistant(userText) {
  const normalized = userText.trim();

  if (/امروز چی دارم|کارهای امروز|برنامه امروز/.test(normalized)) {
    const today = getTodayISO(0);
    const todayTasks = state.tasks.filter((t) => !t.done && t.dueDate === today);
    if (todayTasks.length === 0) {
      return 'برای امروز کار باز ثبت نشده. اگر کاری توی ذهنته همین‌جا بگو تا برات ثبت کنم، یا امروز رو یکم برای خودت فضا باز کن.';
    }
    const list = todayTasks
      .map((t, i) => `${toPersianDigits(i + 1)}. ${t.title}${t.dueTime ? ` (ساعت ${toPersianDigits(t.dueTime)})` : ''} [${CATEGORY_META[t.category].label}]`)
      .join('\n');
    return `لیست کارهای امروزت (${toPersianDigits(todayTasks.length)} مورد):\n${list}`;
  }

  if (/عقب|فراموش|دیر شده/.test(normalized)) {
    const overdue = state.tasks.filter((t) => isTaskOverdue(t));
    if (overdue.length === 0) {
      return 'عالیه! هیچ کار عقب‌افتاده‌ای نداری.';
    }
    const list = overdue
      .map((t, i) => `${toPersianDigits(i + 1)}. ${t.title} (${formatJalaliFromISO(t.dueDate)})`)
      .join('\n');
    return `این ${toPersianDigits(overdue.length)} کار از زمانش گذشته و بهتره اول تکلیفشونو روشن کنی:\n${list}`;
  }

  if (/شلوغ|اولویت|کلافه|نمی‌رسم|نمیرسم/.test(normalized)) {
    const openTasks = state.tasks.filter((t) => !t.done);
    const highTasks = openTasks.filter((t) => t.priority === 'high' || isTaskOverdue(t));
    if (openTasks.length === 0) {
      return 'نفس عمیق بکش. الان هیچ کاری توی لیست ثبت نشده؛ هر چی توی سرته رو یکی‌یکی همین‌جا بنویس تا از ذهنت خالی بشه و با هم مرتبش کنیم.';
    }
    const top3 = (highTasks.length ? highTasks : openTasks).slice(0, 3);
    const list = top3.map((t, i) => `${toPersianDigits(i + 1)}. ${t.title}`).join('\n');
    return `مغزت پر شده چون همه‌چیز با هم داره صدا می‌زنه. بقیه رو فعلاً بذار کنار و فقط روی این ${toPersianDigits(top3.length)} مورد تمرکز کن:\n${list}\n\nبقیه کارها امن اینجاست و گم نمی‌شه.`;
  }

  const parsed = parsePersianTaskOffline(normalized);
  const newTask = {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: parsed.title,
    category: parsed.category,
    priority: parsed.priority,
    dueDate: parsed.dueDate,
    dueTime: parsed.dueTime,
    notes: '',
    done: false,
    reminded: false,
    createdAt: Date.now()
  };

  state.tasks.unshift(newTask);
  await db.put('tasks', newTask);
  renderAll();

  const timeInfo = newTask.dueTime ? ` ساعت ${toPersianDigits(newTask.dueTime)}` : '';
  return `ثبت شد و از ذهنت آزاد شد:\n• عنوان: ${newTask.title}\n• زمان: ${formatJalaliFromISO(newTask.dueDate)}${timeInfo}\n• بخش: ${CATEGORY_META[newTask.category].label} | اولویت: ${PRIORITY_META[newTask.priority]}`;
}

// ---------- اتصال به هوش مصنوعی آنلاین (Gemini / OpenAI) ----------
async function handleOnlineAI(userText) {
  const { aiProvider, aiApiKey, aiBaseUrl, aiModel } = state.settings;
  if (aiProvider === 'offline' || !aiApiKey || !navigator.onLine) {
    return handleOfflineAssistant(userText);
  }

  const todayISO = getTodayISO(0);
  const openTasksSummary = state.tasks
    .filter((t) => !t.done)
    .slice(0, 15)
    .map((t) => `- ${t.title} (${t.dueDate || 'بدون تاریخ'} ${t.dueTime || ''} | ${t.category} | ${t.priority})`)
    .join('\n');

  const systemPrompt = `تو یک دستیار شخصی هوشمند، گرم، صمیمی و ساختارمند به زبان فارسی هستی.
امروز (میلادی): ${todayISO} (${formatJalaliFromISO(todayISO)}).
کارهای باز فعلی کاربر:
${openTasksSummary || 'فعلاً کاری ثبت نشده است.'}

وظایف تو:
1. مثل یک دستیار واقعی و همراه با کاربر حرف بزن، از فشار ذهنیش کم کن و کمک کن کارهاش رو اولویت‌بندی کنه و تعادل بین کار و زندگی شخصیش حفظ بشه.
2. اگر کاربر در پیامش به یک یا چند کار جدید برای ثبت یا یادآوری اشاره کرد، در انتهای پاسخ خود دقیقاً یک بلوک JSON به این شکل قرار بده تا برنامه به صورت خودکار آنها را ثبت کند:
\`\`\`json
{"tasks":[{"title":"عنوان دقیق کار","dueDate":"YYYY-MM-DD","dueTime":"HH:MM","priority":"high|medium|low","category":"work|project|personal|self"}]}
\`\`\`
فقط اگر واقعاً کار جدیدی برای ثبت وجود داشت این بلوک JSON را اضافه کن.`;

  try {
    let replyText = '';

    if (aiProvider === 'gemini') {
      const model = aiModel || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(aiApiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }]
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (aiProvider === 'openai') {
      const base = (aiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const model = aiModel || 'gpt-4o-mini';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ]
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      replyText = data.choices?.[0]?.message?.content || '';
    }

    if (!replyText) throw new Error('پاسخ خالی از هوش مصنوعی');

    const jsonMatch = replyText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          for (const item of parsed.tasks) {
            const newTask = {
              id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              title: item.title || 'کار جدید',
              category: CATEGORY_META[item.category] ? item.category : 'work',
              priority: PRIORITY_META[item.priority] ? item.priority : 'medium',
              dueDate: item.dueDate || todayISO,
              dueTime: item.dueTime || '',
              notes: '',
              done: false,
              reminded: false,
              createdAt: Date.now()
            };
            state.tasks.unshift(newTask);
            await db.put('tasks', newTask);
          }
          renderAll();
          showToast(`${toPersianDigits(parsed.tasks.length)} کار توسط دستیار ثبت شد.`);
        }
      } catch (e) {
        console.warn('Could not parse AI tasks JSON:', e);
      }
      replyText = replyText.replace(jsonMatch[0], '').trim();
    }

    return replyText || 'انجام شد و در لیست کارها ثبت کردم.';
  } catch (err) {
    console.warn('Online AI failed, falling back to offline mode:', err);
    showToast('اتصال به هوش مصنوعی آنلاین برقرار نشد؛ روی حالت آفلاین پردازش شد.');
    return handleOfflineAssistant(userText);
  }
}

// ---------- پیام‌های چت ----------
async function addChatMessage(role, text) {
  const msg = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    role,
    text,
    timestamp: Date.now()
  };
  state.messages.push(msg);
  await db.put('messages', msg);
  renderChat();
}

function renderChat() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  const sorted = [...state.messages].sort((a, b) => a.timestamp - b.timestamp);
  for (const m of sorted) {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    div.textContent = m.text;

    const meta = document.createElement('span');
    meta.className = 'msg-meta';
    const d = new Date(m.timestamp);
    meta.textContent = toPersianDigits(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
    div.appendChild(meta);
    container.appendChild(div);
  }

  container.scrollTop = container.scrollHeight;
}

// ---------- رندر لیست کارها ----------
function renderTasks() {
  const listEl = document.getElementById('tasksList');
  const today = getTodayISO(0);

  let filtered = [...state.tasks];
  if (state.filter === 'today') {
    filtered = filtered.filter((t) => !t.done && t.dueDate === today);
  } else if (state.filter === 'overdue') {
    filtered = filtered.filter((t) => isTaskOverdue(t));
  } else if (state.filter === 'done') {
    filtered = filtered.filter((t) => t.done);
  } else if (CATEGORY_META[state.filter]) {
    filtered = filtered.filter((t) => !t.done && t.category === state.filter);
  } else {
    filtered = filtered.filter((t) => !t.done);
  }

  const prioOrder = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    const aOver = isTaskOverdue(a) ? 0 : 1;
    const bOver = isTaskOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    if (prioOrder[a.priority] !== prioOrder[b.priority]) {
      return prioOrder[a.priority] - prioOrder[b.priority];
    }
    return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">در این بخش کاری ثبت نشده است.</div>`;
    return;
  }

  listEl.innerHTML = '';
  for (const task of filtered) {
    const overdue = isTaskOverdue(task);
    const card = document.createElement('div');
    card.className = `task-card ${task.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-check';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', async () => {
      task.done = checkbox.checked;
      await db.put('tasks', task);
      renderAll();
    });

    const body = document.createElement('div');
    body.className = 'task-body';

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;
    body.appendChild(title);

    if (task.notes) {
      const notes = document.createElement('div');
      notes.className = 'task-notes';
      notes.textContent = task.notes;
      body.appendChild(notes);
    }

    const tags = document.createElement('div');
    tags.className = 'task-tags';

    const catTag = document.createElement('span');
    catTag.className = 'tag';
    catTag.textContent = CATEGORY_META[task.category]?.label || 'کار';
    tags.appendChild(catTag);

    if (task.priority === 'high') {
      const pTag = document.createElement('span');
      pTag.className = 'tag high';
      pTag.textContent = 'فوری';
      tags.appendChild(pTag);
    }

    if (task.dueDate) {
      const dTag = document.createElement('span');
      dTag.className = `tag ${overdue ? 'overdue-tag' : ''}`;
      const timeStr = task.dueTime ? ` - ${toPersianDigits(task.dueTime)}` : '';
      dTag.textContent = `${formatJalaliFromISO(task.dueDate)}${timeStr}`;
      tags.appendChild(dTag);
    }

    body.appendChild(tags);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const icsBtn = document.createElement('button');
    icsBtn.className = 'mini-btn';
    icsBtn.title = 'افزودن به تقویم گوشی (یادآور آفلاین)';
    icsBtn.textContent = 'تقویم';
    icsBtn.addEventListener('click', () => downloadTaskICS(task));

    const editBtn = document.createElement('button');
    editBtn.className = 'mini-btn';
    editBtn.textContent = 'ویرایش';
    editBtn.addEventListener('click', () => openTaskModal(task));

    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn danger';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', async () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      await db.delete('tasks', task.id);
      renderAll();
    });

    actions.append(icsBtn, editBtn, delBtn);
    card.append(checkbox, body, actions);
    listEl.appendChild(card);
  }
}

// ---------- رندر داشبورد تعادل ----------
function renderBalanceDashboard() {
  const today = getTodayISO(0);
  const openTasks = state.tasks.filter((t) => !t.done);
  const todayCount = openTasks.filter((t) => t.dueDate === today).length;
  const overdueCount = openTasks.filter((t) => isTaskOverdue(t)).length;
  const doneCount = state.tasks.filter((t) => t.done).length;

  document.getElementById('statTodayCount').textContent = toPersianDigits(todayCount);
  document.getElementById('statOverdueCount').textContent = toPersianDigits(overdueCount);
  document.getElementById('statDoneCount').textContent = toPersianDigits(doneCount);

  const badge = document.getElementById('navBadgeOverdue');
  if (overdueCount > 0) {
    badge.textContent = toPersianDigits(overdueCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const barsContainer = document.getElementById('balanceBars');
  barsContainer.innerHTML = '';
  const totalOpen = openTasks.length || 1;

  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    const count = openTasks.filter((t) => t.category === key).length;
    const pct = Math.round((count / totalOpen) * 100);

    const item = document.createElement('div');
    item.innerHTML = `
      <div class="balance-item-head">
        <span>${meta.label}</span>
        <span>${toPersianDigits(count)} کار (${toPersianDigits(pct)}٪)</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%; background:${meta.color}"></div>
      </div>
    `;
    barsContainer.appendChild(item);
  }

  const upcomingEl = document.getElementById('upcomingRemindersList');
  const nowMs = Date.now();
  const next24hMs = nowMs + 24 * 60 * 60 * 1000;
  const upcoming = openTasks
    .filter((t) => t.dueDate && t.dueTime)
    .map((t) => ({ ...t, ts: new Date(`${t.dueDate}T${t.dueTime}:00`).getTime() }))
    .filter((t) => t.ts >= nowMs && t.ts <= next24hMs)
    .sort((a, b) => a.ts - b.ts);

  if (upcoming.length === 0) {
    upcomingEl.innerHTML = '<div class="muted-text">یادآور ساعت‌داری برای ۲۴ ساعت آینده ثبت نشده است.</div>';
  } else {
    upcomingEl.innerHTML = '';
    for (const u of upcoming) {
      const row = document.createElement('div');
      row.className = 'upcoming-item';
      row.innerHTML = `
        <span>${u.title}</span>
        <strong>${toPersianDigits(u.dueTime)}</strong>
      `;
      upcomingEl.appendChild(row);
    }
  }
}

function renderAll() {
  renderChat();
  renderTasks();
  renderBalanceDashboard();
}

// ---------- مودال افزودن/ویرایش کار ----------
function openTaskModal(task = null) {
  const modal = document.getElementById('taskModal');
  document.getElementById('taskModalTitle').textContent = task ? 'ویرایش کار' : 'ثبت کار جدید';
  document.getElementById('taskIdInput').value = task ? task.id : '';
  document.getElementById('taskTitleInput').value = task ? task.title : '';
  document.getElementById('taskCategoryInput').value = task ? task.category : 'work';
  document.getElementById('taskPriorityInput').value = task ? task.priority : 'medium';
  document.getElementById('taskDateInput').value = task ? task.dueDate : getTodayISO(0);
  document.getElementById('taskTimeInput').value = task ? task.dueTime : '';
  document.getElementById('taskNotesInput').value = task ? task.notes : '';
  modal.classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.add('hidden');
}

// ---------- تشخیص صدا (Web Speech API) ----------
function setupVoiceInput() {
  const voiceBtn = document.getElementById('voiceBtn');
  const chatInput = document.getElementById('chatInput');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceBtn.addEventListener('click', () => {
      showToast('مرورگر از ضبط مستقیم پشتیبانی نمی‌کند؛ از میکروفون کیبورد گوشی (آفلاین) استفاده کن.');
    });
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'fa-IR';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isRecording = true;
    voiceBtn.classList.add('recording');
    showToast('گوش می‌دهم... صحبت کن.');
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    chatInput.value = (chatInput.value ? chatInput.value + ' ' : '') + transcript;
    chatInput.focus();
  };

  recognition.onerror = () => {
    showToast('تبدیل صوتی مرورگر نیاز به اینترنت دارد. در حالت آفلاین، از میکروفون کیبورد گوشی استفاده کن.');
  };

  recognition.onend = () => {
    isRecording = false;
    voiceBtn.classList.remove('recording');
  };

  voiceBtn.addEventListener('click', () => {
    if (!navigator.onLine) {
      showToast('اینترنت قطع است؛ برای تایپ صوتی آفلاین، روی کادر متن بزن و از میکروفون کیبورد گوشی استفاده کن.');
      chatInput.focus();
      return;
    }
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

// ---------- وضعیت اتصال ----------
function updateConnectionBadge() {
  const badge = document.getElementById('connectionBadge');
  if (navigator.onLine) {
    badge.textContent = state.settings.aiProvider !== 'offline' && state.settings.aiApiKey ? 'آنلاین (AI)' : 'آنلاین';
    badge.className = 'status-pill online';
  } else {
    badge.textContent = 'آفلاین (فعال)';
    badge.className = 'status-pill offline';
  }
}

// ---------- تنظیمات UI ----------
function syncSettingsUI() {
  document.getElementById('aiProvider').value = state.settings.aiProvider;
  document.getElementById('aiApiKey').value = state.settings.aiApiKey;
  document.getElementById('aiBaseUrl').value = state.settings.aiBaseUrl;
  document.getElementById('aiModel').value = state.settings.aiModel;
  document.getElementById('baleToken').value = state.settings.baleToken;
  document.getElementById('baleChatId').value = state.settings.baleChatId;
  toggleAIConfigFields();
}

function toggleAIConfigFields() {
  const provider = document.getElementById('aiProvider').value;
  const box = document.getElementById('aiConfigFields');
  const baseUrlGroup = document.getElementById('aiBaseUrlGroup');
  if (provider === 'offline') {
    box.classList.add('hidden');
  } else {
    box.classList.remove('hidden');
    baseUrlGroup.classList.toggle('hidden', provider !== 'openai');
  }
}

// ---------- شروع اپلیکیشن ----------
async function bootstrap() {
  loadSettings();
  await db.init();

  state.tasks = await db.getAll('tasks');
  state.messages = await db.getAll('messages');

  document.getElementById('jalaliDateDisplay').textContent = formatJalaliFromISO(getTodayISO(0));

  if (state.messages.length === 0) {
    await addChatMessage(
      'assistant',
      'سلام! من اینجام تا بار «یادم نره» رو از روی ذهنت بردارم.\nهر کاری یادت اومد خیلی راحت بنویس یا بگو (مثلاً: «فردا ساعت ۱۰ ارسال گزارش به مدیر #کار فوری»). حتی وقتی اینترنت قطع باشه هم همه‌چیز رو برات دسته‌بندی و ذخیره می‌کنم.'
    );
  }

  syncSettingsUI();
  updateConnectionBadge();
  renderAll();
  setupVoiceInput();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW error:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('installBtn').classList.remove('hidden');
  });

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('installBtn').classList.add('hidden');
  });

  window.addEventListener('online', updateConnectionBadge);
  window.addEventListener('offline', updateConnectionBadge);

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`view-${target}`).classList.add('active');
    });
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = document.getElementById('chatInput');
      input.value = chip.dataset.prompt;
      document.getElementById('chatForm').requestSubmit();
    });
  });

  document.getElementById('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    await addChatMessage('user', text);

    const reply = await handleOnlineAI(text);
    await addChatMessage('assistant', reply);
  });

  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chatForm').requestSubmit();
    }
  });

  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.filter = pill.dataset.filter;
      renderTasks();
    });
  });

  document.getElementById('openAddTaskModalBtn').addEventListener('click', () => openTaskModal());
  document.getElementById('closeTaskModalBtn').addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskModalBtn').addEventListener('click', closeTaskModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeTaskModal);

  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const existingId = document.getElementById('taskIdInput').value;
    const taskData = {
      id: existingId || 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: document.getElementById('taskTitleInput').value.trim(),
      category: document.getElementById('taskCategoryInput').value,
      priority: document.getElementById('taskPriorityInput').value,
      dueDate: document.getElementById('taskDateInput').value,
      dueTime: document.getElementById('taskTimeInput').value,
      notes: document.getElementById('taskNotesInput').value.trim(),
      done: false,
      reminded: false,
      createdAt: Date.now()
    };

    if (existingId) {
      const idx = state.tasks.findIndex((t) => t.id === existingId);
      if (idx !== -1) {
        taskData.done = state.tasks[idx].done;
        taskData.createdAt = state.tasks[idx].createdAt;
        state.tasks[idx] = taskData;
      }
    } else {
      state.tasks.unshift(taskData);
    }

    await db.put('tasks', taskData);
    closeTaskModal();
    renderAll();
    showToast('کار ذخیره شد.');
  });

  document.getElementById('aiProvider').addEventListener('change', toggleAIConfigFields);

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    state.settings = {
      aiProvider: document.getElementById('aiProvider').value,
      aiApiKey: document.getElementById('aiApiKey').value.trim(),
      aiBaseUrl: document.getElementById('aiBaseUrl').value.trim(),
      aiModel: document.getElementById('aiModel').value.trim(),
      baleToken: document.getElementById('baleToken').value.trim(),
      baleChatId: document.getElementById('baleChatId').value.trim()
    };
    saveSettingsToStorage();
    updateConnectionBadge();
    showToast('تنظیمات با موفقیت ذخیره شد.');
  });

  document.getElementById('enableNotifBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) {
      showToast('مرورگر از نوتیفیکیشن پشتیبانی نمی‌کند.');
      return;
    }
    const perm = await Notification.requestPermission();
    showToast(perm === 'granted' ? 'نوتیفیکیشن فعال شد.' : 'اجازه نوتیفیکیشن داده نشد.');
  });

  document.getElementById('testBaleBtn').addEventListener('click', async () => {
    state.settings.baleToken = document.getElementById('baleToken').value.trim();
    state.settings.baleChatId = document.getElementById('baleChatId').value.trim();
    if (!state.settings.baleToken || !state.settings.baleChatId) {
      showToast('لطفاً توکن ربات و Chat ID بله را وارد کن.', true);
      return;
    }
    await sendBaleReminder('✅ تست اتصال دستیار همراه با موفقیت انجام شد.');
    showToast('درخواست ارسال پیام تست به بله فرستاده شد.');
  });

  document.getElementById('exportDataBtn').addEventListener('click', () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      messages: state.messages
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hamrah-backup-${getTodayISO(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importDataInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.tasks)) {
        await db.clear('tasks');
        state.tasks = data.tasks;
        for (const t of state.tasks) await db.put('tasks', t);
      }
      if (Array.isArray(data.messages)) {
        await db.clear('messages');
        state.messages = data.messages;
        for (const m of state.messages) await db.put('messages', m);
      }
      renderAll();
      showToast('اطلاعات با موفقیت بازگردانی شد.');
    } catch (_) {
      showToast('فایل پشتیبان معتبر نیست.', true);
    }
  });

  setInterval(checkReminders, 30000);
  checkReminders();
}

bootstrap();
