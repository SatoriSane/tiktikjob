// ─── Constants ───────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
    RECORDS:  'tictac_records',
    SETTINGS: 'tictac_settings',
};

export const DEFAULT_SETTINGS = {
    dailyHours: 7,
    dailyMinutes: 30,
    weeklyHours: 41,
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
/** "HH:MM" → total minutes */
export const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** total minutes → { hours, minutes } */
export const m2t = m => ({ hours: Math.floor(m / 60), minutes: m % 60 });

/** { hours, minutes } → "Xh Ymin" */
export const fmt = (h, m) => `${h}h ${m}min`;

/** Current time as "HH:MM" */
export const getNow = () => {
    const n = new Date();
    return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

/** Daily target in minutes from a settings object */
export const dailyTarget = s => s.dailyHours * 60 + s.dailyMinutes;

// ─── Date helpers ─────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DD" */
export const getDateKey = (date = new Date()) => date.toISOString().split('T')[0];

/** Date → Monday of that week (00:00:00) */
export const getWeekStart = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d;
};

/** weekStart Date → array of 7 Dates (Mon–Sun) */
export const getWeekDays = ws =>
    Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        return d;
    });

/** Date → short day name ("lun", "mar"…) */
export const getDayName = d =>
    d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');

/** "date" string → localized long date */
export const formatDate = date =>
    date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/** Capitalize first letter */
export const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

/** Date → "DD/MM/YYYY" */
export const shortDate = d =>
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Date → full weekday name */
export const fullDay = d => d.toLocaleDateString('es-ES', { weekday: 'long' });

/** ISO week number label */
export const weekNum = d => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    dd.setDate(dd.getDate() + 4 - (dd.getDay() || 7));
    const ys = new Date(dd.getFullYear(), 0, 1);
    return `Semana ${Math.ceil((((dd - ys) / 864e5) + 1) / 7)}`;
};

// ─── Storage layer ────────────────────────────────────────────────────────────
export const loadSettings = () => {
    const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return s ? JSON.parse(s) : { ...DEFAULT_SETTINGS };
};

export const persistSettings = settings =>
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

export const loadRecords = () => {
    const s = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return s ? JSON.parse(s) : {};
};

const saveRecords = r =>
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(r));

export const getDayRecords = dk => {
    const r = loadRecords();
    return r[dk] || { entries: [], specialDay: null };
};

export const saveDayRecords = (dk, dr) => {
    const r = loadRecords();
    r[dk] = dr;
    saveRecords(r);
};

// ─── Shared SVG icons ─────────────────────────────────────────────────────────
export const ICON_CLOSE =
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`;