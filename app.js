// TicTic Job - Time Tracking PWA

// ─── Storage keys ───
const STORAGE_KEYS = { RECORDS: 'tictac_records', SETTINGS: 'tictac_settings' };
const DEFAULT_SETTINGS = { dailyHours: 7, dailyMinutes: 30, weeklyHours: 41 };

// ─── State ───
let settings = loadSettings();
let editingRecordIndex = null;
let toastTimer = null;
let clockInterval = null;

// ─── DOM ───
const $ = id => document.getElementById(id);
const el = {
    currentDate: $('currentDate'), liveClock: $('liveClock'), clockHint: $('clockHint'),
    entryBtn: $('entryBtn'), exitBtn: $('exitBtn'),
    todayRecords: $('todayRecords'), todayTotal: $('todayTotal'),
    weeklyProgress: $('weeklyProgress'), weeklyTable: $('weeklyTable'),
    toast: $('toast'),
    timeModal: $('timeModal'), modalTitle: $('modalTitle'),
    timePicker: $('timePicker'), cancelTime: $('cancelTime'), confirmTime: $('confirmTime'),
    specialDayToggle: $('specialDayToggle'), specialDayOptions: $('specialDayOptions'),
    specialDayBar: $('specialDayBar'),
    vacationBtn: $('vacationBtn'), holidayBtn: $('holidayBtn'),
    vacationHoursModal: $('vacationHoursModal'), vacationCustom: $('vacationCustom'),
    vacHours: $('vacHours'), vacMinutes: $('vacMinutes'),
    vacationPreview: $('vacationPreview'), cancelVacation: $('cancelVacation'),
    confirmVacation: $('confirmVacation'),
    settingsBtn: $('settingsBtn'), settingsModal: $('settingsModal'),
    dailyHours: $('dailyHours'), dailyMinutes: $('dailyMinutes'),
    weeklyHours: $('weeklyHours'), cancelSettings: $('cancelSettings'),
    saveSettings: $('saveSettings'), exportExcel: $('exportExcel')
};

// ─── Utilities ───
function formatDate(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmt(h, m) { return `${h}h ${m}min`; }
function getDateKey(date = new Date()) { return date.toISOString().split('T')[0]; }
function getWeekStart(date = new Date()) {
    const d = new Date(date); const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0); return d;
}
function getWeekDays(ws) {
    const days = []; for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); days.push(d); } return days;
}
function getDayName(d) { return d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''); }
function getNow() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}
function t2m(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function m2t(m) { return { hours: Math.floor(m / 60), minutes: m % 60 }; }

// ─── Storage ───
function loadSettings() { const s = localStorage.getItem(STORAGE_KEYS.SETTINGS); return s ? JSON.parse(s) : { ...DEFAULT_SETTINGS }; }
function saveSettings2() { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }
function loadRecords() { const s = localStorage.getItem(STORAGE_KEYS.RECORDS); return s ? JSON.parse(s) : {}; }
function saveRecords(r) { localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(r)); }
function getDayRecords(dk) { const r = loadRecords(); return r[dk] || { entries: [], specialDay: null }; }
function saveDayRecords(dk, dr) { const r = loadRecords(); r[dk] = dr; saveRecords(r); }

// ─── Calculations ───
function calcWorkedEntries(entries) {
    let total = 0;
    const sorted = [...(entries || [])].sort((a, b) => t2m(a.time) - t2m(b.time));
    let i = 0;
    while (i < sorted.length) {
        if (sorted[i].type === 'entry') {
            const eTime = t2m(sorted[i].time); let xTime = null;
            for (let j = i + 1; j < sorted.length; j++) {
                if (sorted[j].type === 'exit') { xTime = t2m(sorted[j].time); i = j; break; }
            }
            if (xTime !== null) total += xTime - eTime;
        }
        i++;
    }
    return total;
}

function calcDay(dr) {
    let total = calcWorkedEntries(dr.entries);
    if (dr.specialDay === 'holiday') {
        total += settings.dailyHours * 60 + settings.dailyMinutes;
    } else if (dr.specialDay === 'vacation' && dr.vacationMinutes !== undefined) {
        total += dr.vacationMinutes;
    }
    return total;
}

function calcWeek() {
    const ws = getWeekStart(), days = getWeekDays(ws);
    const wTarget = settings.weeklyHours * 60;
    let totalW = 0; const data = [];
    days.forEach(day => {
        const dk = getDateKey(day), dr = getDayRecords(dk), w = calcDay(dr);
        totalW += w;
        data.push({ date: day, dateKey: dk, dayName: getDayName(day), worked: w, specialDay: dr.specialDay, isToday: dk === getDateKey() });
    });
    return { totalWorked: totalW, weeklyTarget: wTarget, extra: totalW - wTarget, dailyData: data };
}

function getNextAction() {
    const dr = getDayRecords(getDateKey());
    const entries = dr.entries || [];
    if (entries.length === 0) return 'entry';
    const sorted = [...entries].sort((a, b) => t2m(a.time) - t2m(b.time));
    return sorted[sorted.length - 1].type === 'entry' ? 'exit' : 'entry';
}

// ─── Toast ───
function showToast(msg, type) {
    clearTimeout(toastTimer);
    el.toast.textContent = msg;
    el.toast.className = 'toast ' + type;
    requestAnimationFrame(() => el.toast.classList.add('show'));
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

// ─── Live Clock ───
function startClock() {
    function tick() {
        const n = new Date();
        el.liveClock.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
    }
    tick();
    clockInterval = setInterval(tick, 1000);
}

// ─── Render ───
function updateSuggested() {
    const next = getNextAction();
    el.entryBtn.classList.toggle('suggested', next === 'entry');
    el.exitBtn.classList.toggle('suggested', next === 'exit');
}

function renderDate() {
    el.currentDate.textContent = formatDate(new Date());
}

function renderToday() {
    const dk = getDateKey(), dr = getDayRecords(dk);
    let html = '';

    // Render entry/exit records
    if (dr.entries && dr.entries.length > 0) {
        const sorted = [...dr.entries].sort((a, b) => t2m(a.time) - t2m(b.time));
        html += sorted.map((rec, i) => `
            <div class="record-item" onclick="editRecord(${i})">
                <div class="record-dot ${rec.type}"></div>
                <div class="record-info">
                    <div class="record-type">${rec.type === 'entry' ? 'Entrada' : 'Salida'}</div>
                    <div class="record-time">${rec.time}</div>
                </div>
                <div class="record-actions">
                    <button class="record-action-btn delete" onclick="event.stopPropagation(); deleteRecord(${i})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>`).join('');
    }

    // Render special day badge (vacation/holiday)
    if (dr.specialDay) {
        const label = dr.specialDay === 'vacation' ? 'Vacaci\u00f3n' : 'Feriado';
        const vacW = dr.specialDay === 'vacation' && dr.vacationMinutes !== undefined
            ? dr.vacationMinutes : settings.dailyHours * 60 + settings.dailyMinutes;
        const { hours, minutes } = m2t(vacW);
        html += `
            <div class="record-item">
                <div class="record-dot special"></div>
                <div class="record-info">
                    <div class="record-type">${label}</div>
                    <div class="record-time">${fmt(hours, minutes)} acreditadas</div>
                </div>
                <div class="record-actions">
                    <button class="record-action-btn delete" onclick="removeSpecialDay()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>`;
    }

    el.todayRecords.innerHTML = html;

    // Total with breakdown
    const workedMin = calcWorkedEntries(dr.entries);
    const totalMin = calcDay(dr);
    if (totalMin > 0) {
        const { hours: tH, minutes: tM } = m2t(totalMin);
        if (dr.specialDay && workedMin > 0) {
            const { hours: wH, minutes: wM } = m2t(workedMin);
            const vacMin = totalMin - workedMin;
            const { hours: vH, minutes: vM } = m2t(vacMin);
            const vacLabel = dr.specialDay === 'vacation' ? 'vac' : 'fer';
            el.todayTotal.textContent = `${fmt(wH, wM)} + ${fmt(vH, vM)} ${vacLabel} = ${fmt(tH, tM)}`;
        } else {
            el.todayTotal.textContent = fmt(tH, tM);
        }
    } else {
        el.todayTotal.textContent = '';
    }

    // Show/hide special day bar in bottom bar
    if (dr.specialDay) {
        el.specialDayBar.classList.add('hidden');
    } else {
        el.specialDayBar.classList.remove('hidden');
        el.specialDayToggle.classList.remove('hidden');
        el.specialDayOptions.classList.add('hidden');
    }
    updateSuggested();
}

function renderWeekProgress() {
    const s = calcWeek();
    const { hours: wH, minutes: wM } = m2t(s.totalWorked);
    const { hours: tH, minutes: tM } = m2t(s.weeklyTarget);
    const pct = s.weeklyTarget > 0 ? Math.min((s.totalWorked / s.weeklyTarget) * 100, 120) : 0;
    const isOver = s.extra > 0;
    const absExtra = Math.abs(s.extra);
    const { hours: eH, minutes: eM } = m2t(absExtra);
    const sign = s.extra > 0 ? '+' : s.extra < 0 ? '-' : '';
    const cls = s.extra > 0 ? 'positive' : s.extra < 0 ? 'negative' : 'neutral';

    el.weeklyProgress.innerHTML = `
        <div class="progress-header">
            <span class="progress-worked">${fmt(wH, wM)}</span>
            <span class="progress-target">de ${fmt(tH, tM)}</span>
        </div>
        <div class="progress-bar-track">
            <div class="progress-bar-fill${isOver ? ' over' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="progress-extra">
            <span class="progress-extra-label">${isOver ? 'Horas extra' : 'Restante'}</span>
            <span class="progress-extra-value ${cls}">${sign}${fmt(eH, eM)}</span>
        </div>`;
}

function renderWeekTable() {
    const s = calcWeek();
    const rows = s.dailyData.map(d => {
        if (d.worked <= 0) {
            return `<tr class="${d.isToday ? 'today-row' : ''}">
                <td class="day-name">${d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1)}</td>
                <td>${d.date.getDate()}/${d.date.getMonth()+1}</td>
                <td>-</td></tr>`;
        }
        const dr = getDayRecords(d.dateKey);
        const workedMin = calcWorkedEntries(dr.entries);
        const { hours, minutes } = m2t(d.worked);
        let detail = `${hours}h ${minutes}m`;
        if (d.specialDay && workedMin > 0) {
            const vacMin = d.worked - workedMin;
            const { hours: wH, minutes: wM } = m2t(workedMin);
            const { hours: vH, minutes: vM } = m2t(vacMin);
            const tag = d.specialDay === 'vacation' ? 'vac' : 'fer';
            detail = `${wH}h${wM ? wM + 'm' : ''} + <span class="special-badge ${tag}">${vH}h${vM ? vM + 'm' : ''} ${tag.toUpperCase()}</span>`;
        } else if (d.specialDay && workedMin === 0) {
            const tag = d.specialDay === 'vacation' ? 'vac' : 'fer';
            detail = `<span class="special-badge ${tag}">${hours}h ${minutes}m ${tag.toUpperCase()}</span>`;
        }
        return `<tr class="${d.isToday ? 'today-row' : ''}">
            <td class="day-name">${d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1)}</td>
            <td>${d.date.getDate()}/${d.date.getMonth()+1}</td>
            <td>${detail}</td></tr>`;
    }).join('');
    el.weeklyTable.innerHTML = `<table class="weekly-table"><thead><tr><th>D\u00eda</th><th>Fecha</th><th>Trabajado</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function refreshUI() { renderDate(); renderToday(); renderWeekProgress(); renderWeekTable(); }

// ─── Actions ───
function quickRegister(type) {
    const time = getNow();
    const dk = getDateKey(), dr = getDayRecords(dk);
    dr.entries.push({ type, time });
    saveDayRecords(dk, dr);
    refreshUI();
    showToast(`${type === 'entry' ? 'Entrada' : 'Salida'} registrada \u2022 ${time}`, type);
}

function editRecord(index) {
    const dk = getDateKey(), dr = getDayRecords(dk);
    const sorted = [...dr.entries].sort((a, b) => t2m(a.time) - t2m(b.time));
    const rec = sorted[index];
    editingRecordIndex = index;
    el.modalTitle.textContent = `Editar ${rec.type === 'entry' ? 'Entrada' : 'Salida'}`;
    el.timePicker.value = rec.time;
    el.timeModal.classList.add('active');
}

function saveEditedRecord() {
    if (editingRecordIndex === null) return;
    const dk = getDateKey(), dr = getDayRecords(dk);
    const sorted = [...dr.entries].sort((a, b) => t2m(a.time) - t2m(b.time));
    const target = sorted[editingRecordIndex];
    const origIdx = dr.entries.findIndex(r => r.type === target.type && r.time === target.time);
    if (origIdx !== -1) {
        dr.entries[origIdx].time = el.timePicker.value;
        saveDayRecords(dk, dr);
        refreshUI();
        showToast('Hora actualizada', 'entry');
    }
    el.timeModal.classList.remove('active');
    editingRecordIndex = null;
}

function deleteRecord(index) {
    const dk = getDateKey(), dr = getDayRecords(dk);
    const sorted = [...dr.entries].sort((a, b) => t2m(a.time) - t2m(b.time));
    const target = sorted[index];
    const origIdx = dr.entries.findIndex(r => r.type === target.type && r.time === target.time);
    if (origIdx !== -1) { dr.entries.splice(origIdx, 1); saveDayRecords(dk, dr); refreshUI(); showToast('Registro eliminado', 'exit'); }
}

function setSpecialDay(type, vacMin) {
    const dk = getDateKey(), dr = getDayRecords(dk);
    dr.specialDay = type;
    if (type === 'vacation' && vacMin !== undefined) dr.vacationMinutes = vacMin;
    else delete dr.vacationMinutes;
    saveDayRecords(dk, dr);
    closeModal(el.vacationHoursModal);
    refreshUI();
    showToast(type === 'vacation' ? 'Vacaci\u00f3n registrada' : 'Feriado registrado', 'entry');
}

function removeSpecialDay() {
    const dk = getDateKey(), dr = getDayRecords(dk);
    dr.specialDay = null; delete dr.vacationMinutes;
    saveDayRecords(dk, dr);
    refreshUI(); showToast('D\u00eda especial eliminado', 'exit');
}

function saveSettingsFromModal() {
    settings.dailyHours = parseInt(el.dailyHours.value) || 7;
    settings.dailyMinutes = parseInt(el.dailyMinutes.value) || 30;
    settings.weeklyHours = parseInt(el.weeklyHours.value) || 41;
    saveSettings2(); closeModal(el.settingsModal); refreshUI();
    showToast('Configuraci\u00f3n guardada', 'entry');
}

// ─── Modals ───
function closeModal(m) { m.classList.remove('active'); }

function openVacationHoursModal() {
    const max = settings.dailyHours * 60 + settings.dailyMinutes;
    const half = Math.round(max / 2);
    const presets = el.vacationHoursModal.querySelectorAll('.preset-btn');
    presets[0].dataset.minutes = max; presets[1].dataset.minutes = half;
    presets.forEach(b => b.classList.remove('active')); presets[0].classList.add('active');
    el.vacationCustom.classList.add('hidden');
    el.vacHours.value = settings.dailyHours; el.vacMinutes.value = settings.dailyMinutes;
    updateVacPreview(max);
    el.vacationHoursModal.classList.add('active');
}

function updateVacPreview(m) { const t = m2t(m); el.vacationPreview.textContent = fmt(t.hours, t.minutes); }

function getVacMinutes() {
    const active = el.vacationHoursModal.querySelector('.preset-btn.active');
    if (active && active.dataset.minutes !== '0') return parseInt(active.dataset.minutes);
    const h = parseInt(el.vacHours.value) || 0, m = parseInt(el.vacMinutes.value) || 0;
    return Math.min(h * 60 + m, settings.dailyHours * 60 + settings.dailyMinutes);
}

// ─── Excel Export ───
function getAllWeeks() {
    const records = loadRecords(), dateKeys = Object.keys(records).sort();
    if (!dateKeys.length) return [];
    const weeks = new Map();
    dateKeys.forEach(dk => {
        const d = new Date(dk), ws = getWeekStart(d), wk = getDateKey(ws);
        if (!weeks.has(wk)) weeks.set(wk, { weekStart: ws, days: [] });
        weeks.get(wk).days.push({ date: new Date(dk), dateKey: dk, records: records[dk] });
    });
    return Array.from(weeks.values()).sort((a, b) => a.weekStart - b.weekStart);
}
function escCSV(v) { if (v == null) return ''; const s = String(v); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function weekNum(d) { const dd = new Date(d); dd.setHours(0,0,0,0); dd.setDate(dd.getDate()+4-(dd.getDay()||7)); const ys = new Date(dd.getFullYear(),0,1); return `Semana ${Math.ceil((((dd-ys)/864e5)+1)/7)}`; }
function shortDate(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function fullDay(d) { return d.toLocaleDateString('es-ES', { weekday: 'long' }); }

function generateCSV() {
    const records = loadRecords(), weeks = getAllWeeks();
    const dTarget = settings.dailyHours * 60 + settings.dailyMinutes, wTarget = settings.weeklyHours * 60;
    let csv = '\uFEFF';
    csv += 'REPORTE DE HORAS TRABAJADAS - TicTic Job\n';
    csv += `Generado el:,${formatDate(new Date())}\n`;
    csv += `Objetivo diario:,${settings.dailyHours}h ${settings.dailyMinutes}min\nObjetivo semanal:,${settings.weeklyHours}h\n\n`;
    csv += 'RESUMEN POR SEMANA\nSemana,Fecha Inicio,Fecha Fin,Horas Trabajadas,Objetivo,Horas Extra,Estado\n';
    let totW = 0, totE = 0;
    weeks.forEach(wk => {
        const wDays = getWeekDays(wk.weekStart); let wW = 0;
        wDays.forEach(d => { wW += calcDay(getDayRecords(getDateKey(d))); });
        const wE = wW - wTarget; totW += wW; totE += wE;
        const { hours: wH, minutes: wM } = m2t(wW), { hours: eH, minutes: eM } = m2t(Math.abs(wE));
        const wEnd = new Date(wk.weekStart); wEnd.setDate(wEnd.getDate() + 6);
        csv += `${escCSV(weekNum(wk.weekStart))},${shortDate(wk.weekStart)},${shortDate(wEnd)},${wH}h ${wM}min,${settings.weeklyHours}h,${wE>=0?'+':'-'}${eH}h ${eM}min,${wE>0?'Horas extra':wE<0?'Faltan horas':'Completo'}\n`;
    });
    const { hours: tH, minutes: tM } = m2t(totW), { hours: teH, minutes: teM } = m2t(Math.abs(totE));
    csv += `\nTOTAL GENERAL,,,"${tH}h ${tM}min",,"${totE>=0?'+':'-'}${teH}h ${teM}min"\n\n`;
    csv += 'DETALLE DIARIO\nFecha,D\u00eda,Tipo,Entradas,Salidas,Horas Presenciales,Horas Vac/Fer,Total D\u00eda,Objetivo,Diferencia\n';
    Object.keys(records).sort().forEach(dk => {
        const d = new Date(dk), dr = records[dk];
        const workedMin = calcWorkedEntries(dr.entries);
        let vacFerMin = 0;
        if (dr.specialDay === 'holiday') vacFerMin = dTarget;
        else if (dr.specialDay === 'vacation' && dr.vacationMinutes !== undefined) vacFerMin = dr.vacationMinutes;
        const totalMin = workedMin + vacFerMin;
        const diff = totalMin - dTarget;
        const { hours: wH, minutes: wM } = m2t(workedMin);
        const { hours: vH, minutes: vM } = m2t(vacFerMin);
        const { hours: tH2, minutes: tM2 } = m2t(totalMin);
        const { hours: dH, minutes: dM } = m2t(Math.abs(diff));
        let tipo = 'Normal', ent = '', sal = '';
        const hasEntries = dr.entries && dr.entries.length > 0;
        if (dr.specialDay && hasEntries) {
            tipo = `Normal + ${dr.specialDay === 'vacation' ? 'Vacaci\u00f3n' : 'Feriado'}`;
        } else if (dr.specialDay) {
            tipo = dr.specialDay === 'vacation' ? 'Vacaci\u00f3n' : 'Feriado';
        }
        if (hasEntries) {
            const s = [...dr.entries].sort((a,b) => t2m(a.time)-t2m(b.time));
            ent = s.filter(e=>e.type==='entry').map(e=>e.time).join(' / ');
            sal = s.filter(e=>e.type==='exit').map(e=>e.time).join(' / ');
        }
        const workedStr = workedMin > 0 ? `${wH}h ${wM}min` : '-';
        const vacStr = vacFerMin > 0 ? `${vH}h ${vM}min` : '-';
        csv += `${shortDate(d)},${escCSV(fullDay(d))},${tipo},${escCSV(ent||'-')},${escCSV(sal||'-')},${workedStr},${vacStr},${tH2}h ${tM2}min,${settings.dailyHours}h ${settings.dailyMinutes}min,${diff>=0?'+':'-'}${dH}h ${dM}min\n`;
    });
    return csv;
}

function exportToExcel() {
    const records = loadRecords();
    if (!Object.keys(records).length) { showToast('No hay registros', 'exit'); return; }
    const blob = new Blob([generateCSV()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `TicTic_Job_${shortDate(new Date()).replace(/\//g,'-')}.csv`;
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    closeModal(el.settingsModal);
}

// ─── Event Listeners ───

// Main actions — instant register
el.entryBtn.addEventListener('click', () => quickRegister('entry'));
el.exitBtn.addEventListener('click', () => quickRegister('exit'));

// Special day — subtle toggle in bottom bar
el.specialDayToggle.addEventListener('click', () => {
    el.specialDayToggle.classList.add('hidden');
    el.specialDayOptions.classList.remove('hidden');
});
el.vacationBtn.addEventListener('click', () => openVacationHoursModal());
el.holidayBtn.addEventListener('click', () => setSpecialDay('holiday'));

// Vacation hours
el.cancelVacation.addEventListener('click', () => closeModal(el.vacationHoursModal));
el.confirmVacation.addEventListener('click', () => setSpecialDay('vacation', getVacMinutes()));

el.vacationHoursModal.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        el.vacationHoursModal.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = parseInt(btn.dataset.minutes);
        if (mins === 0) { el.vacationCustom.classList.remove('hidden'); updateVacPreview((parseInt(el.vacHours.value)||0)*60+(parseInt(el.vacMinutes.value)||0)); }
        else { el.vacationCustom.classList.add('hidden'); updateVacPreview(mins); }
    });
});

[el.vacHours, el.vacMinutes].forEach(input => {
    input.addEventListener('input', () => {
        const max = settings.dailyHours * 60 + settings.dailyMinutes;
        let h = parseInt(el.vacHours.value) || 0, m = parseInt(el.vacMinutes.value) || 0;
        if (h * 60 + m > max) { h = settings.dailyHours; m = settings.dailyMinutes; el.vacHours.value = h; el.vacMinutes.value = m; }
        updateVacPreview(h * 60 + m);
    });
});

// Edit time modal
el.cancelTime.addEventListener('click', () => { closeModal(el.timeModal); editingRecordIndex = null; });
el.confirmTime.addEventListener('click', saveEditedRecord);

// Settings
el.settingsBtn.addEventListener('click', () => {
    el.dailyHours.value = settings.dailyHours; el.dailyMinutes.value = settings.dailyMinutes;
    el.weeklyHours.value = settings.weeklyHours; el.settingsModal.classList.add('active');
});
el.cancelSettings.addEventListener('click', () => closeModal(el.settingsModal));
el.saveSettings.addEventListener('click', saveSettingsFromModal);
el.exportExcel.addEventListener('click', exportToExcel);

// Close modals on backdrop
[el.timeModal, el.settingsModal, el.vacationHoursModal].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
});

// Globals for inline onclick
window.deleteRecord = deleteRecord;
window.removeSpecialDay = removeSpecialDay;
window.editRecord = editRecord;

// ─── Init ───
startClock();
refreshUI();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}
