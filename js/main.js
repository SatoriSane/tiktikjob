import {
    loadSettings, persistSettings, loadRecords,
    getDayRecords, saveDayRecords,
    getDateKey, getWeekStart, dailyTarget,
    getNow, formatDate, fmt, m2t, t2m, shortDate,
    getWeekDays, weekNum, fullDay,
} from './utils.js';

import { calcWorkedEntries, calcDay, calcWeek, getSortedEntries, setCalcSettings, escCSV } from './calc.js';

import {
    el, showToast, startClock, stopClock,
    renderDateHero, renderDay, renderWeekProgress,
    renderWeekTable, renderWeekNav, setRenderState,
    openModal, closeModal,
} from './render.js';

// ─── App State ────────────────────────────────────────────────────────────────
let settings          = loadSettings();
let editingDate       = null;   // dateKey string or null
let editingRecordIdx  = null;   // index in sorted entries or null
let pendingQuickType  = null;   // 'entry'|'exit' for edit-mode quick register
let viewingWeekOffset = 0;      // 0 = current week, negative = past

// Push settings into calc module on every change
const syncSettings = () => setCalcSettings(settings);
syncSettings();

// ─── Derived helpers ──────────────────────────────────────────────────────────
const todayKey       = () => getDateKey();
const activeDate     = () => editingDate || todayKey();
const viewingWeekStart = () => {
    const d = new Date();
    d.setDate(d.getDate() + viewingWeekOffset * 7);
    return getWeekStart(d);
};

// ─── Full UI refresh ──────────────────────────────────────────────────────────
function refresh() {
    const ws = viewingWeekStart();
    renderWeekNav(ws, viewingWeekOffset);
    renderDateHero(editingDate);
    renderDay(activeDate(), settings);
    renderWeekProgress(ws);
    renderWeekTable(ws, editingDate, viewingWeekOffset);
}

// ─── Edit mode ────────────────────────────────────────────────────────────────
function enterEditMode(dateKey) {
    // Tapping today always returns to normal mode
    if (dateKey === todayKey()) { exitEditMode(); return; }

    editingDate = dateKey;
    const d = new Date(dateKey + 'T12:00:00');
    el.editBannerDate.textContent = formatDate(d);
    el.editBanner.classList.remove('hidden');
    document.body.classList.add('edit-mode');
    stopClock();
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEditMode() {
    editingDate       = null;
    pendingQuickType  = null;
    viewingWeekOffset = 0;          // snap back to current week
    el.editBanner.classList.add('hidden');
    document.body.classList.remove('edit-mode');
    startClock();
    refresh();
}

// ─── Week navigation ──────────────────────────────────────────────────────────
function navigateWeek(dir) {
    const next = viewingWeekOffset + dir;
    if (next > 0) return;           // can't go into the future
    viewingWeekOffset = next;

    // Leaving a week clears any active edit for a date in the old week
    if (editingDate) {
        editingDate      = null;
        pendingQuickType = null;
        el.editBanner.classList.add('hidden');
        document.body.classList.remove('edit-mode');
        startClock();
    }

    // CSS animation (button-triggered; swipe uses inline transform)
    const area = el.weekSwipeArea;
    if (area) {
        const cls = dir < 0 ? 'slide-left' : 'slide-right';
        area.classList.add(cls);
        setTimeout(() => area.classList.remove(cls), 300);
    }

    refresh();
}

// ─── Record actions ───────────────────────────────────────────────────────────

/** Register an entry or exit right now (or open time picker in edit mode) */
function quickRegister(type) {
    if (editingDate) {
        pendingQuickType     = type;
        el.modalTitle.textContent =
            `${type === 'entry' ? 'Entrada' : 'Salida'} — ${formatDate(new Date(editingDate + 'T12:00:00'))}`;
        el.timePicker.value  = '09:00';
        openModal(el.timeModal);
        return;
    }
    const time = getNow();
    const dk   = todayKey();
    const dr   = getDayRecords(dk);
    dr.entries.push({ type, time });
    saveDayRecords(dk, dr);
    refresh();
    showToast(`${type === 'entry' ? 'Entrada' : 'Salida'} registrada • ${time}`, type);
}

/** Open time picker to edit an existing record */
function editRecord(index) {
    const sorted = getSortedEntries(activeDate());
    const rec    = sorted[index];
    editingRecordIdx         = index;
    el.modalTitle.textContent = `Editar ${rec.type === 'entry' ? 'Entrada' : 'Salida'}`;
    el.timePicker.value       = rec.time;
    openModal(el.timeModal);
}

/** Save from time picker modal (handles both new quick-register and edit) */
function saveTimeModal() {
    // Case 1: adding a new record in edit mode
    if (pendingQuickType) {
        const type = pendingQuickType;
        const time = el.timePicker.value;
        pendingQuickType = null;
        const dk = activeDate();
        const dr = getDayRecords(dk);
        dr.entries.push({ type, time });
        saveDayRecords(dk, dr);
        closeModal(el.timeModal);
        refresh();
        showToast(`${type === 'entry' ? 'Entrada' : 'Salida'} registrada • ${time}`, type);
        return;
    }

    // Case 2: editing an existing record
    if (editingRecordIdx === null) return;
    const dk     = activeDate();
    const dr     = getDayRecords(dk);
    const target = getSortedEntries(dk)[editingRecordIdx];
    const origIdx = dr.entries.findIndex(r => r.type === target.type && r.time === target.time);

    if (origIdx !== -1) {
        dr.entries[origIdx].time = el.timePicker.value;
        saveDayRecords(dk, dr);
        refresh();
        showToast('Hora actualizada', 'entry');
    }
    closeModal(el.timeModal);
    editingRecordIdx = null;
}

function cancelTimeModal() {
    closeModal(el.timeModal);
    editingRecordIdx = null;
    pendingQuickType = null;
}

function deleteRecord(index) {
    const dk     = activeDate();
    const dr     = getDayRecords(dk);
    const target = getSortedEntries(dk)[index];
    const origIdx = dr.entries.findIndex(r => r.type === target.type && r.time === target.time);
    if (origIdx !== -1) {
        dr.entries.splice(origIdx, 1);
        saveDayRecords(dk, dr);
        refresh();
        showToast('Registro eliminado', 'exit');
    }
}

// ─── Special days ─────────────────────────────────────────────────────────────
function setSpecialDay(type, vacMin) {
    const dk = activeDate();
    const dr = getDayRecords(dk);
    dr.specialDay = type;
    if (type === 'vacation' && vacMin !== undefined) dr.vacationMinutes = vacMin;
    else delete dr.vacationMinutes;
    saveDayRecords(dk, dr);
    closeModal(el.vacationHoursModal);
    refresh();
    showToast(type === 'vacation' ? 'Vacación registrada' : 'Feriado registrado', 'entry');
}

function removeSpecialDay() {
    const dk = activeDate();
    const dr = getDayRecords(dk);
    dr.specialDay = null;
    delete dr.vacationMinutes;
    saveDayRecords(dk, dr);
    refresh();
    showToast('Día especial eliminado', 'exit');
}

// ─── Vacation modal ───────────────────────────────────────────────────────────
function openVacationModal() {
    const max  = dailyTarget(settings);
    const half = Math.round(max / 2);
    const presets = el.vacationHoursModal.querySelectorAll('.preset-btn');
    presets[0].dataset.minutes = max;
    presets[1].dataset.minutes = half;
    presets.forEach(b => b.classList.remove('active'));
    presets[0].classList.add('active');
    el.vacationCustom.classList.add('hidden');
    el.vacHours.value   = settings.dailyHours;
    el.vacMinutes.value = settings.dailyMinutes;
    _updateVacPreview(max);
    openModal(el.vacationHoursModal);
}

function _getVacMinutes() {
    const active = el.vacationHoursModal.querySelector('.preset-btn.active');
    if (active && active.dataset.minutes !== '0') return parseInt(active.dataset.minutes);
    const h = parseInt(el.vacHours.value) || 0;
    const m = parseInt(el.vacMinutes.value) || 0;
    return Math.min(h * 60 + m, dailyTarget(settings));
}

function _updateVacPreview(mins) {
    const { hours, minutes } = m2t(mins);
    el.vacationPreview.textContent = fmt(hours, minutes);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function openSettings() {
    el.dailyHours.value   = settings.dailyHours;
    el.dailyMinutes.value = settings.dailyMinutes;
    el.weeklyHours.value  = settings.weeklyHours;
    openModal(el.settingsModal);
}

function saveSettings() {
    settings.dailyHours   = parseInt(el.dailyHours.value)   || 7;
    settings.dailyMinutes = parseInt(el.dailyMinutes.value) || 30;
    settings.weeklyHours  = parseInt(el.weeklyHours.value)  || 41;
    persistSettings(settings);
    syncSettings();
    closeModal(el.settingsModal);
    refresh();
    showToast('Configuración guardada', 'entry');
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportToCSV() {
    const records = loadRecords();
    if (!Object.keys(records).length) { showToast('No hay registros', 'exit'); return; }

    const dTarget = dailyTarget(settings);
    const wTarget = settings.weeklyHours * 60;

    // Build week list
    const weeks = new Map();
    Object.keys(records).sort().forEach(dk => {
        const ws = getWeekStart(new Date(dk));
        const wk = getDateKey(ws);
        if (!weeks.has(wk)) weeks.set(wk, { weekStart: ws });
    });
    const sortedWeeks = [...weeks.values()].sort((a, b) => a.weekStart - b.weekStart);

    let csv = '\uFEFF';
    csv += 'REPORTE DE HORAS TRABAJADAS - TicTic Job\n';
    csv += `Generado el:,${formatDate(new Date())}\n`;
    csv += `Objetivo diario:,${settings.dailyHours}h ${settings.dailyMinutes}min\n`;
    csv += `Objetivo semanal:,${settings.weeklyHours}h\n\n`;

    // Weekly summary
    csv += 'RESUMEN POR SEMANA\nSemana,Fecha Inicio,Fecha Fin,Horas Trabajadas,Objetivo,Horas Extra,Estado\n';
    let totW = 0, totE = 0;
    sortedWeeks.forEach(({ weekStart: ws }) => {
        let wW = 0;
        getWeekDays(ws).forEach(d => { wW += calcDay(getDayRecords(getDateKey(d))); });
        const wE = wW - wTarget;
        totW += wW; totE += wE;
        const { hours: wH, minutes: wM } = m2t(wW);
        const { hours: eH, minutes: eM } = m2t(Math.abs(wE));
        const we = new Date(ws); we.setDate(we.getDate() + 6);
        csv += `${escCSV(weekNum(ws))},${shortDate(ws)},${shortDate(we)},` +
               `${wH}h ${wM}min,${settings.weeklyHours}h,` +
               `${wE >= 0 ? '+' : '-'}${eH}h ${eM}min,` +
               `${wE > 0 ? 'Horas extra' : wE < 0 ? 'Faltan horas' : 'Completo'}\n`;
    });
    const { hours: tH, minutes: tM }   = m2t(totW);
    const { hours: teH, minutes: teM } = m2t(Math.abs(totE));
    csv += `\nTOTAL GENERAL,,,"${tH}h ${tM}min",,"${totE >= 0 ? '+' : '-'}${teH}h ${teM}min"\n\n`;

    // Daily detail
    csv += 'DETALLE DIARIO\nFecha,Día,Tipo,Entradas,Salidas,Horas Presenciales,Horas Vac/Fer,Total Día,Objetivo,Diferencia\n';
    Object.keys(records).sort().forEach(dk => {
        const d   = new Date(dk);
        const dr  = records[dk];
        const workedMin = calcWorkedEntries(dr.entries);
        let vacFerMin = 0;
        if (dr.specialDay === 'holiday') vacFerMin = dTarget;
        else if (dr.specialDay === 'vacation' && dr.vacationMinutes !== undefined) vacFerMin = dr.vacationMinutes;

        const totalMin = workedMin + vacFerMin;
        const diff     = totalMin - dTarget;
        const { hours: wH, minutes: wM }   = m2t(workedMin);
        const { hours: vH, minutes: vM }   = m2t(vacFerMin);
        const { hours: tH2, minutes: tM2 } = m2t(totalMin);
        const { hours: dH, minutes: dM }   = m2t(Math.abs(diff));

        const hasEntries = dr.entries?.length > 0;
        let tipo = 'Normal';
        if (dr.specialDay && hasEntries) tipo = `Normal + ${dr.specialDay === 'vacation' ? 'Vacación' : 'Feriado'}`;
        else if (dr.specialDay)          tipo = dr.specialDay === 'vacation' ? 'Vacación' : 'Feriado';

        let ent = '-', sal = '-';
        if (hasEntries) {
            const sorted = [...dr.entries].sort((a, b) => t2m(a.time) - t2m(b.time));
            ent = sorted.filter(e => e.type === 'entry').map(e => e.time).join(' / ') || '-';
            sal = sorted.filter(e => e.type === 'exit').map(e => e.time).join(' / ')  || '-';
        }

        csv += `${shortDate(d)},${escCSV(fullDay(d))},${tipo},${escCSV(ent)},${escCSV(sal)},` +
               `${workedMin > 0 ? `${wH}h ${wM}min` : '-'},` +
               `${vacFerMin > 0 ? `${vH}h ${vM}min` : '-'},` +
               `${tH2}h ${tM2}min,${settings.dailyHours}h ${settings.dailyMinutes}min,` +
               `${diff >= 0 ? '+' : '-'}${dH}h ${dM}min\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `TicTic_Job_${shortDate(new Date()).replace(/\//g, '-')}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeModal(el.settingsModal);
}

// ─── Swipe gesture ────────────────────────────────────────────────────────────
function initSwipe() {
    const area = el.weekSwipeArea;
    if (!area) return;

    let startX = 0, startY = 0, currentX = 0;
    let tracking = false, maybeSwipe = false;
    const THRESHOLD = 50, MAX_DRAG = 140;

    const setTranslate = (x, animated) => {
        area.style.transition = animated
            ? 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.28s ease'
            : 'none';
        area.style.transform = `translateX(${x}px)`;
        area.style.opacity   = 1 - Math.min(Math.abs(x) / MAX_DRAG, 1) * 0.25;
    };

    const resetTransform = (animated) => {
        setTranslate(0, animated);
        tracking = maybeSwipe = false;
        if (animated) setTimeout(() => {
            area.style.transform = area.style.opacity = area.style.transition = '';
        }, 300);
    };

    area.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = 0; tracking = false; maybeSwipe = true;
        area.style.transition = 'none';
    }, { passive: true });

    area.addEventListener('touchmove', e => {
        if (!maybeSwipe) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        if (!tracking) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            if (Math.abs(dy) > Math.abs(dx)) { maybeSwipe = false; return; }
            tracking = true;
        }
        // Block left drag when already on current week
        if (dx < 0 && viewingWeekOffset >= 0) return;
        currentX = Math.sign(dx) * Math.min(Math.abs(dx), MAX_DRAG);
        setTranslate(currentX, false);
    }, { passive: true });

    area.addEventListener('touchend', () => {
        if (!tracking) { maybeSwipe = false; return; }

        if (Math.abs(currentX) > THRESHOLD) {
            // right swipe → past (dir -1), left swipe → present (dir +1)
            const dir = currentX > 0 ? -1 : 1;
            setTranslate(Math.sign(currentX) * area.offsetWidth * 0.45, true);
            setTimeout(() => {
                area.style.transition = 'none';
                area.style.transform = area.style.opacity = '';
                navigateWeek(dir);
            }, 200);
        } else {
            resetTransform(true);
        }
        tracking = maybeSwipe = false;
    }, { passive: true });

    area.addEventListener('touchcancel', () => resetTransform(true), { passive: true });
}

// ─── Event listeners ──────────────────────────────────────────────────────────
function bindEvents() {
    // Bottom bar
    el.entryBtn.addEventListener('click', () => quickRegister('entry'));
    el.exitBtn.addEventListener('click',  () => quickRegister('exit'));

    // Week navigation buttons
    el.prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
    el.nextWeekBtn.addEventListener('click', () => navigateWeek(1));

    // Edit banner
    el.editBannerClose.addEventListener('click', exitEditMode);

    // Time modal
    el.confirmTime.addEventListener('click', saveTimeModal);
    el.cancelTime.addEventListener('click',  cancelTimeModal);

    // Vacation modal
    el.confirmVacation.addEventListener('click', () => setSpecialDay('vacation', _getVacMinutes()));
    el.cancelVacation.addEventListener('click',  () => closeModal(el.vacationHoursModal));

    el.vacationHoursModal.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            el.vacationHoursModal.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mins = parseInt(btn.dataset.minutes);
            el.vacationCustom.classList.toggle('hidden', mins !== 0);
            _updateVacPreview(mins || (parseInt(el.vacHours.value) || 0) * 60 + (parseInt(el.vacMinutes.value) || 0));
        });
    });

    [el.vacHours, el.vacMinutes].forEach(inp => inp.addEventListener('input', () => {
        const max = dailyTarget(settings);
        let h = parseInt(el.vacHours.value) || 0;
        let m = parseInt(el.vacMinutes.value) || 0;
        if (h * 60 + m > max) {
            h = settings.dailyHours; m = settings.dailyMinutes;
            el.vacHours.value = h; el.vacMinutes.value = m;
        }
        _updateVacPreview(h * 60 + m);
    }));

    // Settings modal
    el.settingsBtn.addEventListener('click',    openSettings);
    el.saveSettings.addEventListener('click',   saveSettings);
    el.cancelSettings.addEventListener('click', () => closeModal(el.settingsModal));
    el.exportExcel.addEventListener('click',    exportToCSV);

    // Close modals on backdrop tap
    [el.timeModal, el.settingsModal, el.vacationHoursModal].forEach(m => {
        m.addEventListener('click', e => {
            if (e.target === m) { closeModal(m); pendingQuickType = null; }
        });
    });
}

// ─── Global API (for inline onclick in rendered HTML) ─────────────────────────
window.App = {
    editRecord,
    deleteRecord,
    removeSpecialDay,
    handleVacation: openVacationModal,
    handleHoliday:  () => setSpecialDay('holiday'),
    enterEditMode,
};

// ─── Init ─────────────────────────────────────────────────────────────────────
startClock();
bindEvents();
initSwipe();
refresh();

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
    navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SW_UPDATED') window.location.reload();
    });
}