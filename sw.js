/* Service Worker — الجامع للمواقع
   غيّر رقم VERSION كلما عدّلت ملفات الموقع ليتحدّث الكاش عند المستخدمين. */
const VERSION = 'jame-v1';
const CORE = [
  './',
  './index.html',
  './student-assistor.html',
  './pdf-margins.html',
  './QuestionSolver-main/questions-solver.html',
  './offline.html',
  './manifest.json',
  './icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
/* مصادر خارجية تُخزَّن عند أول استخدام (مكتبات وخطوط) */
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'code.jquery.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u)))) // لا يفشل التثبيت لو ملف ناقص
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // لا نعترض POST (مثل طلبات Gemini)
  const url = new URL(req.url);

  /* صفحات الموقع: الشبكة أولاً ثم الكاش ثم صفحة بدون إنترنت */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(async () =>
        (await caches.match(req, { ignoreSearch: true })) ||
        (await caches.match('./offline.html'))
      )
    );
    return;
  }

  /* ملفات الموقع نفسه + مكتبات CDN: من الكاش فوراً وتحديث بالخلفية */
  if (url.origin === location.origin || CDN.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
  /* أي شيء آخر (مثل generativelanguage.googleapis.com) يمر مباشرة للشبكة */
});
