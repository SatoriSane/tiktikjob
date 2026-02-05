// TicTic Job - Time Tracking PWA

// Storage keys
const STORAGE_KEYS = {
    RECORDS: 'tictac_records',
    SETTINGS: 'tictac_settings'
};

// Default settings
const DEFAULT_SETTINGS = {
    dailyHours: 7,
    dailyMinutes: 30,
    weeklyHours: 41
};

// State
let currentAction = null;
let settings = loadSettings();

// DOM Elements
const elements = {
    currentDate: document.getElementById('currentDate'),
    entryBtn: document.getElementById('entryBtn'),
    exitBtn: document.getElementById('exitBtn'),
    specialDayBtn: document.getElementById('specialDayBtn'),
    todayRecords: document.getElementById('todayRecords'),
    todayTotal: document.getElementById('todayTotal'),
    weeklySummary: document.getElementById('weeklySummary'),
    weeklyTable: document.getElementById('weeklyTable'),
    
    // Time Modal
    timeModal: document.getElementById('timeModal'),
    modalTitle: document.getElementById('modalTitle'),
    timePicker: document.getElementById('timePicker'),
    cancelTime: document.getElementById('cancelTime'),
    confirmTime: document.getElementById('confirmTime'),
    
    // Special Day Modal
    specialDayModal: document.getElementById('specialDayModal'),
    vacationBtn: document.getElementById('vacationBtn'),
    holidayBtn: document.getElementById('holidayBtn'),
    cancelSpecial: document.getElementById('cancelSpecial'),
    
    // Settings Modal
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    dailyHours: document.getElementById('dailyHours'),
    dailyMinutes: document.getElementById('dailyMinutes'),
    weeklyHours: document.getElementById('weeklyHours'),
    cancelSettings: document.getElementById('cancelSettings'),
    saveSettings: document.getElementById('saveSettings'),
    exportExcel: document.getElementById('exportExcel')
};

// Utility Functions
function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

function formatTime(hours, minutes) {
    return `${hours}h ${minutes}min`;
}

function getDateKey(date = new Date()) {
    return date.toISOString().split('T')[0];
}

function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekDays(weekStart) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    return days;
}

function getDayName(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
}

function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
}

// Storage Functions
function loadSettings() {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return stored ? JSON.parse(stored) : { ...DEFAULT_SETTINGS };
}

function saveSettingsToStorage() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

function loadRecords() {
    const stored = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return stored ? JSON.parse(stored) : {};
}

function saveRecords(records) {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
}

function getDayRecords(dateKey) {
    const records = loadRecords();
    return records[dateKey] || { entries: [], specialDay: null };
}

function saveDayRecords(dateKey, dayRecords) {
    const records = loadRecords();
    records[dateKey] = dayRecords;
    saveRecords(records);
}

// Calculate worked time for a day
function calculateDayWorked(dayRecords) {
    if (dayRecords.specialDay) {
        return settings.dailyHours * 60 + settings.dailyMinutes;
    }
    
    const entries = dayRecords.entries || [];
    let totalMinutes = 0;
    
    // Sort entries by time
    const sorted = [...entries].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    
    // Pair entries (entry -> exit)
    let i = 0;
    while (i < sorted.length) {
        if (sorted[i].type === 'entry') {
            const entryTime = timeToMinutes(sorted[i].time);
            // Find next exit
            let exitTime = null;
            for (let j = i + 1; j < sorted.length; j++) {
                if (sorted[j].type === 'exit') {
                    exitTime = timeToMinutes(sorted[j].time);
                    i = j;
                    break;
                }
            }
            if (exitTime !== null) {
                totalMinutes += exitTime - entryTime;
            }
        }
        i++;
    }
    
    return totalMinutes;
}

// Calculate weekly summary
function calculateWeeklySummary() {
    const weekStart = getWeekStart();
    const weekDays = getWeekDays(weekStart);
    const dailyTarget = settings.dailyHours * 60 + settings.dailyMinutes;
    const weeklyTarget = settings.weeklyHours * 60;
    
    let totalWorked = 0;
    const dailyData = [];
    
    weekDays.forEach(day => {
        const dateKey = getDateKey(day);
        const dayRecords = getDayRecords(dateKey);
        const worked = calculateDayWorked(dayRecords);
        totalWorked += worked;
        
        dailyData.push({
            date: day,
            dateKey,
            dayName: getDayName(day),
            worked,
            specialDay: dayRecords.specialDay,
            isToday: dateKey === getDateKey()
        });
    });
    
    const extraMinutes = totalWorked - weeklyTarget;
    
    return {
        totalWorked,
        weeklyTarget,
        extraMinutes,
        dailyTarget,
        dailyData
    };
}

// UI Functions
function updateCurrentDate() {
    elements.currentDate.textContent = formatDate(new Date());
}

function renderTodayRecords() {
    const dateKey = getDateKey();
    const dayRecords = getDayRecords(dateKey);
    
    if (dayRecords.specialDay) {
        elements.todayRecords.innerHTML = `
            <div class="record-item">
                <div class="record-icon special">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${dayRecords.specialDay === 'vacation' 
                            ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
                            : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
                        }
                    </svg>
                </div>
                <div class="record-info">
                    <div class="record-type">${dayRecords.specialDay === 'vacation' ? 'Vacación' : 'Feriado'}</div>
                    <div class="record-time">${formatTime(settings.dailyHours, settings.dailyMinutes)} acreditadas</div>
                </div>
                <button class="record-delete" onclick="removeSpecialDay()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    } else if (dayRecords.entries.length === 0) {
        elements.todayRecords.innerHTML = `
            <div class="empty-state">
                No hay registros hoy
            </div>
        `;
    } else {
        const sorted = [...dayRecords.entries].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        elements.todayRecords.innerHTML = sorted.map((record, index) => `
            <div class="record-item">
                <div class="record-icon ${record.type}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${record.type === 'entry' 
                            ? '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line>'
                            : '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>'
                        }
                    </svg>
                </div>
                <div class="record-info">
                    <div class="record-type">${record.type === 'entry' ? 'Entrada' : 'Salida'}</div>
                    <div class="record-time">${record.time}</div>
                </div>
                <button class="record-delete" onclick="deleteRecord(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `).join('');
    }
    
    // Update today's total
    const worked = calculateDayWorked(dayRecords);
    const { hours, minutes } = minutesToTime(worked);
    if (worked > 0) {
        elements.todayTotal.innerHTML = `Trabajado hoy: <strong>${formatTime(hours, minutes)}</strong>`;
        elements.todayTotal.style.display = 'block';
    } else {
        elements.todayTotal.style.display = 'none';
    }
}

function renderWeeklySummary() {
    const summary = calculateWeeklySummary();
    const { hours: workedH, minutes: workedM } = minutesToTime(summary.totalWorked);
    const { hours: targetH, minutes: targetM } = minutesToTime(summary.weeklyTarget);
    const extraAbs = Math.abs(summary.extraMinutes);
    const { hours: extraH, minutes: extraM } = minutesToTime(extraAbs);
    
    const extraClass = summary.extraMinutes > 0 ? 'positive' : summary.extraMinutes < 0 ? 'negative' : 'neutral';
    const extraSign = summary.extraMinutes > 0 ? '+' : summary.extraMinutes < 0 ? '-' : '';
    
    elements.weeklySummary.innerHTML = `
        <div class="summary-row">
            <span class="summary-label">Trabajado</span>
            <span class="summary-value neutral">${formatTime(workedH, workedM)}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Objetivo semanal</span>
            <span class="summary-value neutral">${formatTime(targetH, targetM)}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Horas extra</span>
            <span class="summary-value ${extraClass}">${extraSign}${formatTime(extraH, extraM)}</span>
        </div>
    `;
}

function renderWeeklyTable() {
    const summary = calculateWeeklySummary();
    
    const rows = summary.dailyData.map(day => {
        const { hours, minutes } = minutesToTime(day.worked);
        const workedStr = day.worked > 0 ? `${hours}h ${minutes}m` : '-';
        const specialBadge = day.specialDay 
            ? `<span class="special-badge">${day.specialDay === 'vacation' ? 'VAC' : 'FER'}</span>` 
            : '';
        
        return `
            <tr class="${day.isToday ? 'today-row' : ''}">
                <td class="day-name">${day.dayName.charAt(0).toUpperCase() + day.dayName.slice(1)}</td>
                <td>${day.date.getDate()}/${day.date.getMonth() + 1}</td>
                <td>${workedStr} ${specialBadge}</td>
            </tr>
        `;
    }).join('');
    
    elements.weeklyTable.innerHTML = `
        <table class="weekly-table">
            <thead>
                <tr>
                    <th>Día</th>
                    <th>Fecha</th>
                    <th>Trabajado</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function refreshUI() {
    updateCurrentDate();
    renderTodayRecords();
    renderWeeklySummary();
    renderWeeklyTable();
}

// Modal Functions
function openTimeModal(action) {
    currentAction = action;
    elements.modalTitle.textContent = action === 'entry' ? 'Registrar Entrada' : 'Registrar Salida';
    elements.timePicker.value = getCurrentTime();
    elements.timeModal.classList.add('active');
}

function closeTimeModal() {
    elements.timeModal.classList.remove('active');
    currentAction = null;
}

function openSpecialDayModal() {
    elements.specialDayModal.classList.add('active');
}

function closeSpecialDayModal() {
    elements.specialDayModal.classList.remove('active');
}

function openSettingsModal() {
    elements.dailyHours.value = settings.dailyHours;
    elements.dailyMinutes.value = settings.dailyMinutes;
    elements.weeklyHours.value = settings.weeklyHours;
    elements.settingsModal.classList.add('active');
}

function closeSettingsModal() {
    elements.settingsModal.classList.remove('active');
}

// Action Functions
function addRecord(type, time) {
    const dateKey = getDateKey();
    const dayRecords = getDayRecords(dateKey);
    
    // Remove special day if adding regular records
    if (dayRecords.specialDay) {
        dayRecords.specialDay = null;
    }
    
    dayRecords.entries.push({ type, time });
    saveDayRecords(dateKey, dayRecords);
    refreshUI();
}

function deleteRecord(index) {
    const dateKey = getDateKey();
    const dayRecords = getDayRecords(dateKey);
    
    // Sort to get correct index
    const sorted = [...dayRecords.entries].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const recordToDelete = sorted[index];
    
    // Find and remove from original array
    const originalIndex = dayRecords.entries.findIndex(
        r => r.type === recordToDelete.type && r.time === recordToDelete.time
    );
    
    if (originalIndex !== -1) {
        dayRecords.entries.splice(originalIndex, 1);
        saveDayRecords(dateKey, dayRecords);
        refreshUI();
    }
}

function setSpecialDay(type) {
    const dateKey = getDateKey();
    const dayRecords = { entries: [], specialDay: type };
    saveDayRecords(dateKey, dayRecords);
    closeSpecialDayModal();
    refreshUI();
}

function removeSpecialDay() {
    const dateKey = getDateKey();
    const dayRecords = { entries: [], specialDay: null };
    saveDayRecords(dateKey, dayRecords);
    refreshUI();
}

function saveSettingsFromModal() {
    settings.dailyHours = parseInt(elements.dailyHours.value) || 7;
    settings.dailyMinutes = parseInt(elements.dailyMinutes.value) || 30;
    settings.weeklyHours = parseInt(elements.weeklyHours.value) || 41;
    saveSettingsToStorage();
    closeSettingsModal();
    refreshUI();
}

// Excel Export Functions
function getAllWeeks() {
    const records = loadRecords();
    const dateKeys = Object.keys(records).sort();
    
    if (dateKeys.length === 0) return [];
    
    const weeks = new Map();
    
    dateKeys.forEach(dateKey => {
        const date = new Date(dateKey);
        const weekStart = getWeekStart(date);
        const weekKey = getDateKey(weekStart);
        
        if (!weeks.has(weekKey)) {
            weeks.set(weekKey, {
                weekStart,
                days: []
            });
        }
        
        weeks.get(weekKey).days.push({
            date: new Date(dateKey),
            dateKey,
            records: records[dateKey]
        });
    });
    
    return Array.from(weeks.values()).sort((a, b) => a.weekStart - b.weekStart);
}

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function generateExcelContent() {
    const records = loadRecords();
    const allWeeks = getAllWeeks();
    const dailyTarget = settings.dailyHours * 60 + settings.dailyMinutes;
    const weeklyTarget = settings.weeklyHours * 60;
    
    let csv = '\uFEFF'; // BOM for Excel UTF-8
    
    // Header info
    csv += 'REPORTE DE HORAS TRABAJADAS - TicTic Job\n';
    csv += `Generado el:,${formatDate(new Date())}\n`;
    csv += `Objetivo diario:,${settings.dailyHours}h ${settings.dailyMinutes}min\n`;
    csv += `Objetivo semanal:,${settings.weeklyHours}h\n`;
    csv += '\n';
    
    // Summary section
    csv += 'RESUMEN POR SEMANA\n';
    csv += 'Semana,Fecha Inicio,Fecha Fin,Horas Trabajadas,Objetivo,Horas Extra,Estado\n';
    
    let totalWorkedAll = 0;
    let totalExtraAll = 0;
    
    allWeeks.forEach(week => {
        const weekDays = getWeekDays(week.weekStart);
        let weekWorked = 0;
        
        weekDays.forEach(day => {
            const dateKey = getDateKey(day);
            const dayRecords = getDayRecords(dateKey);
            weekWorked += calculateDayWorked(dayRecords);
        });
        
        const weekExtra = weekWorked - weeklyTarget;
        totalWorkedAll += weekWorked;
        totalExtraAll += weekExtra;
        
        const { hours: wH, minutes: wM } = minutesToTime(weekWorked);
        const { hours: eH, minutes: eM } = minutesToTime(Math.abs(weekExtra));
        const extraSign = weekExtra >= 0 ? '+' : '-';
        const status = weekExtra > 0 ? 'Horas extra' : weekExtra < 0 ? 'Faltan horas' : 'Completo';
        
        const weekEnd = new Date(week.weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        csv += `${escapeCSV(getWeekNumber(week.weekStart))},`;
        csv += `${formatShortDate(week.weekStart)},`;
        csv += `${formatShortDate(weekEnd)},`;
        csv += `${wH}h ${wM}min,`;
        csv += `${settings.weeklyHours}h,`;
        csv += `${extraSign}${eH}h ${eM}min,`;
        csv += `${status}\n`;
    });
    
    // Totals
    const { hours: totalH, minutes: totalM } = minutesToTime(totalWorkedAll);
    const { hours: extraTotalH, minutes: extraTotalM } = minutesToTime(Math.abs(totalExtraAll));
    csv += '\n';
    csv += `TOTAL GENERAL,,,"${totalH}h ${totalM}min",,"${totalExtraAll >= 0 ? '+' : '-'}${extraTotalH}h ${extraTotalM}min"\n`;
    csv += '\n\n';
    
    // Detailed records section
    csv += 'DETALLE DIARIO\n';
    csv += 'Fecha,Día,Tipo,Entradas,Salidas,Horas Trabajadas,Objetivo,Diferencia\n';
    
    const sortedDates = Object.keys(records).sort();
    
    sortedDates.forEach(dateKey => {
        const date = new Date(dateKey);
        const dayRecords = records[dateKey];
        const worked = calculateDayWorked(dayRecords);
        const diff = worked - dailyTarget;
        const { hours: wH, minutes: wM } = minutesToTime(worked);
        const { hours: dH, minutes: dM } = minutesToTime(Math.abs(diff));
        const diffSign = diff >= 0 ? '+' : '-';
        
        let tipo = 'Normal';
        let entradas = '';
        let salidas = '';
        
        if (dayRecords.specialDay) {
            tipo = dayRecords.specialDay === 'vacation' ? 'Vacación' : 'Feriado';
            entradas = '-';
            salidas = '-';
        } else if (dayRecords.entries && dayRecords.entries.length > 0) {
            const sorted = [...dayRecords.entries].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
            entradas = sorted.filter(e => e.type === 'entry').map(e => e.time).join(' / ');
            salidas = sorted.filter(e => e.type === 'exit').map(e => e.time).join(' / ');
        }
        
        csv += `${formatShortDate(date)},`;
        csv += `${escapeCSV(getDayNameFull(date))},`;
        csv += `${tipo},`;
        csv += `${escapeCSV(entradas || '-')},`;
        csv += `${escapeCSV(salidas || '-')},`;
        csv += `${wH}h ${wM}min,`;
        csv += `${settings.dailyHours}h ${settings.dailyMinutes}min,`;
        csv += `${diffSign}${dH}h ${dM}min\n`;
    });
    
    return csv;
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `Semana ${weekNo}`;
}

function formatShortDate(date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getDayNameFull(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'long' });
}

function exportToExcel() {
    const records = loadRecords();
    
    if (Object.keys(records).length === 0) {
        alert('No hay registros para exportar');
        return;
    }
    
    const csvContent = generateExcelContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const fileName = `TicTic_Job_${formatShortDate(new Date()).replace(/\//g, '-')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    closeSettingsModal();
}

// Event Listeners
elements.entryBtn.addEventListener('click', () => openTimeModal('entry'));
elements.exitBtn.addEventListener('click', () => openTimeModal('exit'));
elements.specialDayBtn.addEventListener('click', openSpecialDayModal);

elements.cancelTime.addEventListener('click', closeTimeModal);
elements.confirmTime.addEventListener('click', () => {
    const time = elements.timePicker.value;
    if (time && currentAction) {
        addRecord(currentAction, time);
        closeTimeModal();
    }
});

elements.vacationBtn.addEventListener('click', () => setSpecialDay('vacation'));
elements.holidayBtn.addEventListener('click', () => setSpecialDay('holiday'));
elements.cancelSpecial.addEventListener('click', closeSpecialDayModal);

elements.settingsBtn.addEventListener('click', openSettingsModal);
elements.cancelSettings.addEventListener('click', closeSettingsModal);
elements.saveSettings.addEventListener('click', saveSettingsFromModal);
elements.exportExcel.addEventListener('click', exportToExcel);

// Close modals on backdrop click
[elements.timeModal, elements.specialDayModal, elements.settingsModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Make functions available globally for onclick handlers
window.deleteRecord = deleteRecord;
window.removeSpecialDay = removeSpecialDay;

// Initialize
refreshUI();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}
