import { t2m, m2t, fmt, getDateKey, getWeekDays, getDayName, getDayRecords, dailyTarget } from './utils.js';

// settings reference — injected by main.js after init
let _settings = null;
export const setCalcSettings = s => { _settings = s; };

// ─── Day calculations ─────────────────────────────────────────────────────────

/**
 * Sum of all complete entry→exit pairs (ignores unpaired entries).
 * @param {Array} entries
 * @returns {number} minutes
 */
export function calcWorkedEntries(entries = []) {
    let total = 0;
    const sorted = [...entries].sort((a, b) => t2m(a.time) - t2m(b.time));
    let i = 0;
    while (i < sorted.length) {
        if (sorted[i].type === 'entry') {
            const eTime = t2m(sorted[i].time);
            let xTime = null;
            for (let j = i + 1; j < sorted.length; j++) {
                if (sorted[j].type === 'exit') { xTime = t2m(sorted[j].time); i = j; break; }
            }
            if (xTime !== null) total += xTime - eTime;
        }
        i++;
    }
    return total;
}

/**
 * Total credited minutes for a day (worked + special day bonus).
 * @param {object} dr  day record
 * @returns {number} minutes
 */
export function calcDay(dr) {
    let total = calcWorkedEntries(dr.entries);
    if (dr.specialDay === 'holiday') {
        total += dailyTarget(_settings);
    } else if (dr.specialDay === 'vacation' && dr.vacationMinutes !== undefined) {
        total += dr.vacationMinutes;
    }
    return total;
}

// ─── Week calculations ────────────────────────────────────────────────────────

/**
 * Full week summary for the given week-start date.
 * @param {Date} ws   Monday of the week to calculate
 * @returns {{ totalWorked, weeklyTarget, extra, dailyData }}
 */
export function calcWeek(ws) {
    const days = getWeekDays(ws);
    const wTarget = _settings.weeklyHours * 60;
    const todayKey = getDateKey();
    let totalW = 0;

    const dailyData = days.map(day => {
        const dk = getDateKey(day);
        const dr = getDayRecords(dk);
        const worked = calcDay(dr);
        totalW += worked;
        return {
            date:       day,
            dateKey:    dk,
            dayName:    getDayName(day),
            worked,
            specialDay: dr.specialDay,
            isToday:    dk === todayKey,
        };
    });

    return {
        totalWorked:  totalW,
        weeklyTarget: wTarget,
        extra:        totalW - wTarget,
        dailyData,
    };
}

// ─── Entry helpers ────────────────────────────────────────────────────────────

/**
 * Entries for a day sorted chronologically.
 * @param {string} dk  date key
 * @returns {Array}
 */
export function getSortedEntries(dk) {
    const dr = getDayRecords(dk);
    return [...(dr.entries || [])].sort((a, b) => t2m(a.time) - t2m(b.time));
}

/**
 * What should the next button action be for a date?
 * @param {string} dk
 * @returns {'entry'|'exit'}
 */
export function getNextAction(dk) {
    const sorted = getSortedEntries(dk);
    if (!sorted.length) return 'entry';
    return sorted[sorted.length - 1].type === 'entry' ? 'exit' : 'entry';
}

// ─── CSV export helpers ───────────────────────────────────────────────────────
export const escCSV = v => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
};