// DB: optager-app til Dagbog. Sort skærm med et ur og en lille prik i toppen:
// grå = optager ikke, blå = optager. Optagelsen starter, når appen åbnes,
// og stopper ved et tryk på skærmen eller når appen forlades.
//
// Teksten vises aldrig. Den krypteres med Dagbogs offentlige nøgle og lægges i
// Dagbogs indbakke (samme IndexedDB, da begge ligger på pbo-dot.github.io).
// Formatet skal passe med src/lib/inbox.ts og src/lib/crypto.ts i Dagbog.

const SAVE_EVERY_MS = 3000;

// ---------- Dagbogs database (samme navn, version og opbygning som db.ts) ----------

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('dagbog', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault');
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function vault(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction('vault', mode).objectStore('vault'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Kryptering (samme format som sealForInbox i crypto.ts) ----------

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

async function sealForInbox(publicJwk, value) {
  const pub = await crypto.subtle.importKey('jwk', publicJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(value)));
  const raw = await crypto.subtle.exportKey('raw', aes);
  return { key: toB64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw)), iv: toB64(iv), ct: toB64(ct) };
}

// ---------- Talegenkendelse (som startLongDictation i device.ts) ----------

/** Chrome på Android sender ofte hver ny version af sætningen som et nyt resultat. */
function joinResults(parts) {
  const out = [];
  for (const raw of parts) {
    const t = raw.trim();
    if (!t) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined && t.toLowerCase().startsWith(prev.toLowerCase())) out[out.length - 1] = t;
    else if (prev !== undefined && prev.toLowerCase().startsWith(t.toLowerCase())) continue;
    else out.push(t);
  }
  return out.join(' ');
}

const SpeechCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

/** Talegenkendelsen stopper efter en pause, så den startes igen, til der trykkes stop. */
function startLongDictation(onText, onEnd) {
  let stopped = false;
  let done = '';
  let failures = 0;
  let rec = null;
  const finish = (err) => {
    if (stopped) return;
    stopped = true;
    rec = null;
    onEnd(err);
  };
  const run = () => {
    if (stopped) return;
    const r = new SpeechCtor();
    rec = r;
    r.lang = 'da-DK';
    r.continuous = true;
    r.interimResults = true;
    let session = '';
    r.onresult = (e) => {
      const finals = [];
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) finals.push(e.results[i][0].transcript);
      session = joinResults(finals);
      failures = 0;
      onText([done, session].filter(Boolean).join(' '));
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') finish('not-allowed');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') failures++;
    };
    r.onend = () => {
      done = [done, session].filter(Boolean).join(' ');
      if (stopped) return;
      if (failures >= 5) return finish('offline');
      setTimeout(run, 250);
    };
    try {
      r.start();
    } catch {
      setTimeout(run, 500);
    }
  };
  run();
  return () => {
    const r = rec;
    finish();
    r?.stop();
  };
}

// ---------- Appen ----------

const dot = document.getElementById('dot');
const msg = document.getElementById('msg');

let publicKey = null;
let item = null;
let stop = null;
let wake = null;
let saveTimer;
let saving = Promise.resolve();

function show(on) {
  document.body.classList.toggle('on', on);
  dot.setAttribute('aria-label', on ? 'Optager' : 'Optager ikke');
}

/** Gemmer i rækkefølge, så en ældre udgave aldrig overskriver en nyere. */
function save(it) {
  const copy = { ...it, updatedAt: Date.now() };
  saving = saving.then(async () => {
    const sealed = await sealForInbox(publicKey, copy);
    await vault('readwrite', (s) => s.put(sealed, `inbox:${copy.id}`));
  }).catch(() => {
    msg.textContent = 'Kunne ikke gemme.';
  });
  return saving;
}

async function start() {
  if (stop || !publicKey) return;
  msg.textContent = '';
  item = { id: crypto.randomUUID(), startedAt: Date.now(), updatedAt: Date.now(), text: '', done: false };
  show(true);
  try {
    wake = await navigator.wakeLock?.request('screen');
  } catch {
    wake = null;
  }
  stop = startLongDictation(
    (text) => {
      if (!item) return;
      item.text = text;
      saveTimer ??= setTimeout(() => {
        saveTimer = undefined;
        if (item) save(item);
      }, SAVE_EVERY_MS);
    },
    async (err) => {
      const it = item;
      item = null;
      stop = null;
      clearTimeout(saveTimer);
      saveTimer = undefined;
      wake?.release().catch(() => {});
      wake = null;
      show(false);
      if (it && it.text.trim()) {
        await save({ ...it, done: true });
        msg.textContent = '✓';
      } else if (err === 'not-allowed') {
        msg.textContent = 'Giv adgang til mikrofonen, og tryk på skærmen.';
      } else if (err === 'offline') {
        msg.textContent = 'Ingen forbindelse.';
      } else {
        msg.textContent = '';
      }
    },
  );
}

document.body.addEventListener('click', () => {
  if (stop) stop();
  else start();
});

// Forlades appen, stoppes og gemmes. Åbnes den igen (tryk på ikonet), startes en ny optagelse.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop?.();
  else start();
});

// Uret: klokkeslæt og dato, så skærmen ligner et ur på bordet.
const time = document.getElementById('time');
const date = document.getElementById('date');
function tick() {
  const now = new Date();
  time.textContent = now.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  date.textContent = now.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
}
tick();
setInterval(tick, 10_000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

(async () => {
  if (!SpeechCtor) {
    msg.textContent = 'Virker kun i Chrome.';
    return;
  }
  try {
    publicKey = await vault('readonly', (s) => s.get('inboxPub'));
  } catch {
    publicKey = null;
  }
  if (!publicKey) {
    msg.textContent = 'Ikke klar endnu: åbn hovedappen og lås den op én gang.';
    return;
  }
  start();
})();
