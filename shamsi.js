/**
 * Shamsi (Jalali) date utilities using jalaali-js
 */
const Shamsi = {
  // Convert Date to Shamsi string YYYY/MM/DD
  toShamsi(date) {
    if (!date) date = new Date();
    if (typeof date === 'string') date = new Date(date);
    const j = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const y = j.jy;
    const m = String(j.jm).padStart(2, '0');
    const d = String(j.jd).padStart(2, '0');
    return `${y}/${m}/${d}`;
  },

  // Get year and month numbers
  getYearMonth(date) {
    if (!date) date = new Date();
    if (typeof date === 'string') date = new Date(date);
    const j = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return { year: j.jy, month: j.jm };
  },

  // Parse Shamsi string YYYY/MM/DD to Date
  fromShamsi(shamsiStr) {
    if (!shamsiStr) return new Date();
    const parts = shamsiStr.split(/[\/\-\.]/).map(Number);
    if (parts.length < 3) return new Date();
    const g = jalaali.toGregorian(parts[0], parts[1], parts[2]);
    return new Date(g.gy, g.gm - 1, g.gd);
  },

  // Month names
  monthNames: [
    '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ],

  getMonthName(month) {
    return this.monthNames[month] || '';
  },

  // Today as Shamsi
  today() {
    return this.toShamsi(new Date());
  },

  // Format for display
  format(date) {
    const s = this.toShamsi(date);
    const { year, month } = this.getYearMonth(date);
    return `${s} (${this.getMonthName(month)})`;
  },

  // Get list of years from data or current ±2
  getYearOptions(extraYears = []) {
    const current = this.getYearMonth(new Date()).year;
    const years = new Set([current - 2, current - 1, current, current + 1, ...extraYears]);
    return Array.from(years).sort((a, b) => b - a);
  }
};
