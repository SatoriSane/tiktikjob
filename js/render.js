import {
    fmt, m2t, t2m, formatDate, getDayName, capitalize, getDateKey,
    getDayRecords, ICON_CLOSE,
} from './utils.js';
import { calcWorkedEntries, calcDay, calcWeek, getNextAction } from './calc.js';

// ─── State reference (set by main.js) ────────────────────────────────────────
let _state = null;
export const setRenderState = s => { _state = s; };

// ─── Element cache ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
export const el = {
    // Clock / header
    currentDate:       $('currentDate'),
    liveClock:         $('liveClock'),
    clockHint:         $('clockHint'),
    // Action buttons
    entryBtn:          $('entryBtn'),
    exitBtn:           $('exitBtn'),
    // Today section
    todayRecords:      $('todayRecords'),
    todayTotal:        $('todayTotal'),
    todaySectionTitle: $('todaySectionTitle'),
    // Edit banner
    editBanner:        $('editBanner'),
    editBannerDate:    $('editBannerDate'),
    editBannerClose:   $('editBannerClose'),
    // Week section
    weeklyProgress:    $('weeklyProgress'),
    weeklyTable:       $('weeklyTable'),
    weekNavTitle:      $('weekNavTitle'),
    weekNavLabel:      $('weekNavLabel'),
    prevWeekBtn:       $('prevWeekBtn'),
    nextWeekBtn:       $('nextWeekBtn'),
    weekSwipeArea:     $('weekSwipeArea'),
    // Toast
    toast:             $('toast'),
    // Time modal
    timeModal:         $('timeModal'),
    modalTitle:        $('modalTitle'),
    timePicker:        $('timePicker'),
    cancelTime:        $('cancelTime'),
    confirmTime:       $('confirmTime'),
    // Vacation modal
    vacationHoursModal: $('vacationHoursModal'),
    vacationCustom:    $('vacationCustom'),
    vacHours:          $('vacHours'),
    vacMinutes:        $('vacMinutes'),
    vacationPreview:   $('vacationPreview'),
    cancelVacation:    $('cancelVacation'),
    confirmVacation:   $('confirmVacation'),
    // Settings modal
    settingsBtn:       $('settingsBtn'),
    settingsModal:     $('settingsModal'),
    dailyHours:        $('dailyHours'),
    dailyMinutes:      $('dailyMinutes'),
    weeklyHours:       $('weeklyHours'),
    cancelSettings:    $('cancelSettings'),
    saveSettings:      $('saveSettings'),
    exportExcel:       $('exportExcel'),
    // Export modal
    exportModal:       $('exportModal'),
    exportFrom:        $('exportFrom'),
    exportTo:          $('exportTo'),
    cancelExport:      $('cancelExport'),
    confirmExport:     $('confirmExport'),
    exportRangeInfo:   $('exportRangeInfo'),
};

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
export function showToast(msg, type) {
    clearTimeout(_toastTimer);
    el.toast.textContent = msg;
    el.toast.className = `toast ${type}`;
    requestAnimationFrame(() => el.toast.classList.add('show'));
    _toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

// ─── Clock ────────────────────────────────────────────────────────────────────
let _clockInterval = null;

export function startClock() {
    clearInterval(_clockInterval);
    const tick = () => {
        const n = new Date();
        el.liveClock.textContent =
            `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    _clockInterval = setInterval(tick, 1000);
}

export function stopClock() { clearInterval(_clockInterval); }

// ─── Week nav bar ─────────────────────────────────────────────────────────────
export function renderWeekNav(weekStart, offset) {
    // Title
    if (offset === 0)        el.weekNavTitle.textContent = 'Esta semana';
    else if (offset === -1)  el.weekNavTitle.textContent = 'Semana pasada';
    else                     el.weekNavTitle.textContent = `Hace ${Math.abs(offset)} semanas`;

    // Date range label
    const we = new Date(weekStart);
    we.setDate(we.getDate() + 6);
    const sm = weekStart.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    const em = we.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    el.weekNavLabel.textContent = weekStart.getMonth() === we.getMonth()
        ? `${weekStart.getDate()}–${we.getDate()} ${em}`
        : `${weekStart.getDate()} ${sm} – ${we.getDate()} ${em}`;

    // Next button disabled when on current week
    const onCurrent = offset >= 0;
    el.nextWeekBtn.disabled = onCurrent;
    el.nextWeekBtn.classList.toggle('nav-btn-disabled', onCurrent);

    document.body.classList.toggle('past-week-view', offset !== 0);
}

// ─── Date / clock hero ────────────────────────────────────────────────────────
export function renderDateHero(editingDate) {
    if (editingDate) {
        const d = new Date(editingDate + 'T12:00:00');
        el.currentDate.textContent = formatDate(d);
        el.liveClock.textContent =
            d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        el.clockHint.textContent       = 'Editando este día';
        el.todaySectionTitle.textContent = capitalize(getDayName(d));
    } else {
        el.currentDate.textContent       = formatDate(new Date());
        el.todaySectionTitle.textContent = 'Hoy';
        el.clockHint.textContent         = 'Toca un botón para registrar esta hora';
    }
}

// ─── Today / active day records ───────────────────────────────────────────────

/** Renders the list of records and the total badge for the active day */
export function renderDay(activeDate, settings) {
    const dr = getDayRecords(activeDate);
    const hasEntries = dr.entries?.length > 0;
    const hasSpecial = !!dr.specialDay;

    el.todayRecords.innerHTML =
        _recordsHTML(dr, hasEntries, hasSpecial) +
        _specialBadgeHTML(dr, hasSpecial, settings) +
        _dayTypePickerHTML(hasEntries, hasSpecial);

    _renderDayTotal(dr, hasEntries, hasSpecial);
    _updateSuggestedBtn(activeDate);
}

function _recordsHTML(dr, hasEntries) {
    if (!hasEntries) return '';
    return [...dr.entries]
        .sort((a, b) => t2m(a.time) - t2m(b.time))
        .map((rec, i) => `
            <div class="record-item" onclick="App.editRecord(${i})">
                <div class="record-dot ${rec.type}"></div>
                <div class="record-info">
                    <div class="record-type">${rec.type === 'entry' ? 'Entrada' : 'Salida'}</div>
                    <div class="record-time">${rec.time}</div>
                </div>
                <div class="record-actions">
                    <button class="record-action-btn delete"
                            onclick="event.stopPropagation(); App.deleteRecord(${i})">
                        ${ICON_CLOSE}
                    </button>
                </div>
            </div>`)
        .join('');
}

function _specialBadgeHTML(dr, hasSpecial, settings) {
    if (!hasSpecial) return '';
    const label = dr.specialDay === 'vacation' ? 'Vacación' : 'Feriado';
    const mins  = dr.specialDay === 'vacation' && dr.vacationMinutes !== undefined
        ? dr.vacationMinutes
        : settings.dailyHours * 60 + settings.dailyMinutes;
    const { hours, minutes } = m2t(mins);
    return `
        <div class="record-item">
            <div class="record-dot special"></div>
            <div class="record-info">
                <div class="record-type">${label}</div>
                <div class="record-time">${fmt(hours, minutes)} acreditadas</div>
            </div>
            <div class="record-actions">
                <button class="record-action-btn delete" onclick="App.removeSpecialDay()">
                    ${ICON_CLOSE}
                </button>
            </div>
        </div>`;
}

function _dayTypePickerHTML(hasEntries, hasSpecial) {
    if (hasSpecial) return '';
    if (!hasEntries) return `
        <div class="day-type-picker">
            <button class="day-type-card vacation" onclick="App.handleVacation()">
                <span class="card-icon">☀️</span> Vacación
            </button>
            <button class="day-type-card holiday" onclick="App.handleHoliday()">
                <span class="card-icon">⭐</span> Feriado
            </button>
        </div>`;
    return `<button class="add-vacation-link" onclick="App.handleVacation()">
        + Añadir horas de vacación
    </button>`;
}

function _renderDayTotal(dr, hasEntries, hasSpecial) {
    const workedMin = calcWorkedEntries(dr.entries);
    const totalMin  = calcDay(dr);

    if (!totalMin) { el.todayTotal.textContent = ''; return; }

    const { hours: tH, minutes: tM } = m2t(totalMin);
    if (hasSpecial && workedMin > 0) {
        const { hours: wH, minutes: wM } = m2t(workedMin);
        const { hours: vH, minutes: vM } = m2t(totalMin - workedMin);
        const tag = dr.specialDay === 'vacation' ? 'vac' : 'fer';
        el.todayTotal.textContent =
            `${fmt(wH, wM)} + ${fmt(vH, vM)} ${tag} = ${fmt(tH, tM)}`;
    } else {
        el.todayTotal.textContent = fmt(tH, tM);
    }
}

function _updateSuggestedBtn(activeDate) {
    const next = getNextAction(activeDate);
    el.entryBtn.classList.toggle('suggested', next === 'entry');
    el.exitBtn.classList.toggle('suggested', next === 'exit');
}

// ─── Week progress card ───────────────────────────────────────────────────────
export function renderWeekProgress(weekStart) {
    const s = calcWeek(weekStart);
    const { hours: wH, minutes: wM } = m2t(s.totalWorked);
    const { hours: tH, minutes: tM } = m2t(s.weeklyTarget);
    const pct   = s.weeklyTarget > 0
        ? Math.min((s.totalWorked / s.weeklyTarget) * 100, 120) : 0;
    const isOver   = s.extra > 0;
    const { hours: eH, minutes: eM } = m2t(Math.abs(s.extra));
    const sign = s.extra > 0 ? '+' : s.extra < 0 ? '-' : '';
    const cls  = s.extra > 0 ? 'positive' : s.extra < 0 ? 'negative' : 'neutral';

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

// ─── Week detail table ────────────────────────────────────────────────────────
export function renderWeekTable(weekStart, editingDate, offset) {
    const { dailyData } = calcWeek(weekStart);

    const rows = dailyData.map(d => {
        const isEditing = editingDate === d.dateKey;
        const isFuture  = d.date > new Date() && !d.isToday;

        const rowClass = [
            d.isToday && offset === 0 ? 'today-row' : '',
            isEditing ? 'editing-row' : '',
            isFuture  ? 'future-row'  : '',
            'tappable-row',
        ].filter(Boolean).join(' ');

        const dayLabel = capitalize(d.dayName);
        const dateLabel = `${d.date.getDate()}/${d.date.getMonth() + 1}`;

        if (!d.worked) {
            return `<tr class="${rowClass}" onclick="App.enterEditMode('${d.dateKey}')">
                <td class="day-name">${dayLabel}</td>
                <td>${dateLabel}</td>
                <td class="empty-cell">–</td>
            </tr>`;
        }

        return `<tr class="${rowClass}" onclick="App.enterEditMode('${d.dateKey}')">
            <td class="day-name">${dayLabel}</td>
            <td>${dateLabel}</td>
            <td>${_workedDetail(d)}</td>
        </tr>`;
    }).join('');

    el.weeklyTable.innerHTML = `
        <table class="weekly-table">
            <thead>
                <tr><th>Día</th><th>Fecha</th><th>Trabajado</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function _workedDetail(d) {
    const { hours, minutes } = m2t(d.worked);
    if (!d.specialDay) return `${hours}h ${minutes}m`;

    const dr        = getDayRecords(d.dateKey);
    const workedMin = calcWorkedEntries(dr.entries);
    const tag       = d.specialDay === 'vacation' ? 'vac' : 'fer';

    if (workedMin > 0) {
        const { hours: wH, minutes: wM } = m2t(workedMin);
        const { hours: vH, minutes: vM } = m2t(d.worked - workedMin);
        return `${wH}h${wM ? wM + 'm' : ''} + <span class="special-badge ${tag}">${vH}h${vM ? vM + 'm' : ''} ${tag.toUpperCase()}</span>`;
    }
    return `<span class="special-badge ${tag}">${hours}h ${minutes}m ${tag.toUpperCase()}</span>`;
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
export const openModal  = m => m.classList.add('active');
export const closeModal = m => m.classList.remove('active');