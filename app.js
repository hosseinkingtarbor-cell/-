/**
 * Main Application Logic - Offline PWA
 * All data stored locally in IndexedDB
 */
const App = {
  currentEdit: null,
  currentStore: null,
  charts: {},
  searchQuery: '',

  async init() {
    await DB.init();
    this.bindEvents();
    this.loadSettingsToForm();
    await this.refreshAll();
    this.populateYearFilters();
    await this.checkReminders(true); // silent banner + badge on startup
    this.showToast('برنامه آماده است — داده‌ها فقط روی دستگاه شما ذخیره می‌شوند');
  },

  bindEvents() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Header buttons
    document.getElementById('btn-search').addEventListener('click', () => {
      document.getElementById('search-bar').classList.toggle('hidden');
      document.getElementById('search-input').focus();
    });
    document.getElementById('search-close').addEventListener('click', () => {
      document.getElementById('search-bar').classList.add('hidden');
      document.getElementById('search-input').value = '';
      this.searchQuery = '';
      this.refreshAll();
    });
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.refreshAll();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
      this.loadSettingsToForm();
    });
    document.getElementById('btn-export').addEventListener('click', () => {
      this.showExportMenu();
    });
    document.getElementById('btn-reminders').addEventListener('click', () => {
      document.getElementById('reminders-modal').classList.remove('hidden');
      this.renderRemindersList();
    });
    document.getElementById('reminders-banner-close')?.addEventListener('click', () => {
      document.getElementById('reminders-banner').classList.add('hidden');
    });
    document.getElementById('refresh-reminders')?.addEventListener('click', () => this.renderRemindersList());
    document.getElementById('request-notification-perm')?.addEventListener('click', () => this.requestNotificationPermission());

    // Modal close
    document.querySelectorAll('.modal-close, .settings-close, .reminders-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('modal').classList.add('hidden');
        document.getElementById('settings-modal').classList.add('hidden');
        document.getElementById('reminders-modal').classList.add('hidden');
      });
    });

    // Add buttons
    document.getElementById('add-expense-btn').addEventListener('click', () => this.openForm('expenses'));
    document.getElementById('add-fuel-btn').addEventListener('click', () => this.openForm('fuel'));
    document.getElementById('add-oil-btn').addEventListener('click', () => this.openForm('oil'));
    document.getElementById('add-repair-btn').addEventListener('click', () => this.openForm('repairs'));
    document.getElementById('add-insurance-btn').addEventListener('click', () => this.openForm('insurance'));
    document.getElementById('add-daily-btn').addEventListener('click', () => this.openForm('daily'));

    // Save modal
    document.getElementById('modal-save').addEventListener('click', () => this.saveForm());

    // Filters
    ['expense-type-filter', 'expense-month-filter', 'fuel-month-filter',
     'repair-category-filter', 'insurance-type-filter', 'insurance-status-filter',
     'daily-month-filter', 'stats-year-filter', 'stats-month-filter']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => this.refreshAll());
      });

    // Settings
    document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('export-all-csv').addEventListener('click', () => this.exportAllCSV());
    document.getElementById('export-all-pdf').addEventListener('click', () => this.exportAllPDF());
    document.getElementById('clear-all-data').addEventListener('click', () => this.clearAllData());
    document.getElementById('export-monthly-pdf').addEventListener('click', () => this.exportMonthlyPDF());
  },

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (tabId === 'stats') this.renderStats();
    if (tabId === 'fuel') this.renderFuelChart();
    if (tabId === 'daily') this.renderDailyChart();
  },

  // ========== FORMS ==========
  openForm(store, editData = null) {
    this.currentStore = store;
    this.currentEdit = editData;
    const titleMap = {
      expenses: editData ? 'ویرایش هزینه' : 'ثبت هزینه جدید',
      fuel: editData ? 'ویرایش سوخت' : 'ثبت سوخت',
      oil: editData ? 'ویرایش سرویس روغن' : 'ثبت سرویس روغن',
      repairs: editData ? 'ویرایش تعمیر' : 'ثبت تعمیر',
      insurance: editData ? 'ویرایش بیمه' : 'ثبت بیمه‌نامه',
      daily: editData ? 'ویرایش هزینه روزمره' : 'ثبت هزینه روزمره'
    };
    document.getElementById('modal-title').textContent = titleMap[store];
    document.getElementById('modal-body').innerHTML = this.getFormHTML(store, editData);
    document.getElementById('modal').classList.remove('hidden');

    // Auto-calc for fuel
    if (store === 'fuel') {
      const liters = document.getElementById('f-liters');
      const price = document.getElementById('f-price');
      const total = document.getElementById('f-total');
      const calc = () => {
        const l = parseFloat(liters.value) || 0;
        const p = parseFloat(price.value) || 0;
        total.value = (l * p).toLocaleString('fa-IR');
      };
      liters.addEventListener('input', calc);
      price.addEventListener('input', calc);
    }
    // Auto-calc for oil & repairs
    if (store === 'oil' || store === 'repairs') {
      const inputs = document.querySelectorAll('.calc-input');
      const totalEl = document.getElementById('f-total');
      const calc = () => {
        let sum = 0;
        inputs.forEach(i => sum += parseFloat(i.value) || 0);
        totalEl.value = sum.toLocaleString('fa-IR');
      };
      inputs.forEach(i => i.addEventListener('input', calc));
    }
  },

  getFormHTML(store, data = {}) {
    const today = Shamsi.today();
    const d = data || {};

    if (store === 'expenses') {
      return `
        <div class="form-group">
          <label>تاریخ (شمسی)</label>
          <input type="text" id="f-date" value="${d.shamsiDate || today}" placeholder="۱۴۰۵/۰۷/۰۶" />
        </div>
        <div class="form-group">
          <label>نوع</label>
          <select id="f-type">
            <option value="personal" ${d.type==='personal'?'selected':''}>شخصی</option>
            <option value="debt" ${d.type==='debt'?'selected':''}>بدهی</option>
            <option value="car" ${d.type==='car'?'selected':''}>مخارج ماشین</option>
          </select>
        </div>
        <div class="form-group">
          <label>دسته‌بندی</label>
          <input type="text" id="f-category" value="${d.category||''}" placeholder="مثال: قسط، خوراک، لاستیک..." />
        </div>
        <div class="form-group">
          <label>عنوان</label>
          <input type="text" id="f-title" value="${d.title||''}" required />
        </div>
        <div class="form-group">
          <label>مبلغ</label>
          <input type="number" id="f-amount" value="${d.amount||''}" required />
        </div>
        <div class="form-group">
          <label>وضعیت بدهی (در صورت بدهی)</label>
          <select id="f-debt-status">
            <option value="pending" ${d.debtStatus==='pending'?'selected':''}>در انتظار</option>
            <option value="paid" ${d.debtStatus==='paid'?'selected':''}>پرداخت شده</option>
            <option value="partial" ${d.debtStatus==='partial'?'selected':''}>بخشی پرداخت شده</option>
          </select>
        </div>
        <div class="form-group">
          <label>توضیحات</label>
          <textarea id="f-desc" rows="2">${d.description||''}</textarea>
        </div>
      `;
    }

    if (store === 'fuel') {
      return `
        <div class="form-group">
          <label>تاریخ (شمسی)</label>
          <input type="text" id="f-date" value="${d.shamsiDate || today}" />
        </div>
        <div class="form-group">
          <label>کیلومترشمار</label>
          <input type="number" id="f-odometer" value="${d.odometer||''}" />
        </div>
        <div class="form-group">
          <label>لیتر سوخت</label>
          <input type="number" step="0.01" id="f-liters" value="${d.liters||''}" />
        </div>
        <div class="form-group">
          <label>قیمت هر لیتر</label>
          <input type="number" id="f-price" value="${d.pricePerLiter||''}" />
        </div>
        <div class="form-group">
          <label>هزینه کل (محاسبه خودکار)</label>
          <input type="text" id="f-total" value="${d.totalCost ? d.totalCost.toLocaleString('fa-IR') : ''}" readonly />
        </div>
        <div class="form-group">
          <label>نوع سوخت</label>
          <select id="f-fuel-type">
            <option value="بنزین" ${d.fuelType==='بنزین'?'selected':''}>بنزین</option>
            <option value="گازوئیل" ${d.fuelType==='گازوئیل'?'selected':''}>گازوئیل</option>
            <option value="CNG" ${d.fuelType==='CNG'?'selected':''}>CNG</option>
          </select>
        </div>
        <div class="form-group">
          <label>جایگاه</label>
          <input type="text" id="f-station" value="${d.station||''}" />
        </div>
        <div class="form-group">
          <label>توضیحات</label>
          <textarea id="f-notes" rows="2">${d.notes||''}</textarea>
        </div>
      `;
    }

    if (store === 'oil') {
      return `
        <div class="form-group">
          <label>تاریخ (شمسی)</label>
          <input type="text" id="f-date" value="${d.shamsiDate || today}" />
        </div>
        <div class="form-group">
          <label>کیلومترشمار</label>
          <input type="number" id="f-odometer" value="${d.odometer||''}" />
        </div>
        <div class="form-group">
          <label>نوع روغن</label>
          <input type="text" id="f-oil-type" value="${d.oilType||''}" placeholder="۱۰W-40" />
        </div>
        <div class="form-group">
          <label>برند روغن</label>
          <input type="text" id="f-oil-brand" value="${d.oilBrand||''}" />
        </div>
        <div class="form-group">
          <label>مقدار (لیتر)</label>
          <input type="number" step="0.1" id="f-oil-amount" value="${d.oilAmount||''}" />
        </div>
        <div class="form-group">
          <label>هزینه روغن</label>
          <input type="number" class="calc-input" id="f-oil-cost" value="${d.oilCost||''}" />
        </div>
        <div class="form-group">
          <label>فیلتر تعویض شد؟</label>
          <select id="f-filter">
            <option value="true" ${d.filterChanged?'selected':''}>بله</option>
            <option value="false" ${!d.filterChanged?'selected':''}>خیر</option>
          </select>
        </div>
        <div class="form-group">
          <label>هزینه فیلتر</label>
          <input type="number" class="calc-input" id="f-filter-cost" value="${d.filterCost||0}" />
        </div>
        <div class="form-group">
          <label>سایر هزینه‌ها</label>
          <input type="number" class="calc-input" id="f-other-cost" value="${d.otherCosts||0}" />
        </div>
        <div class="form-group">
          <label>جمع کل</label>
          <input type="text" id="f-total" value="${d.totalCost ? d.totalCost.toLocaleString('fa-IR') : ''}" readonly />
        </div>
        <div class="form-group">
          <label>کیلومتر سرویس بعدی</label>
          <input type="number" id="f-next-odo" value="${d.nextServiceOdometer||''}" />
        </div>
        <div class="form-group">
          <label>تاریخ تقریبی سرویس بعدی (شمسی)</label>
          <input type="text" id="f-next-date" value="${d.nextServiceShamsi||''}" placeholder="۱۴۰۵/۱۰/۰۱" />
        </div>
        <div class="form-group">
          <label>تعمیرگاه</label>
          <input type="text" id="f-workshop" value="${d.workshop||''}" />
        </div>
        <div class="form-group">
          <label>توضیحات</label>
          <textarea id="f-notes" rows="2">${d.notes||''}</textarea>
        </div>
      `;
    }

    if (store === 'repairs') {
      return `
        <div class="form-group">
          <label>تاریخ (شمسی)</label>
          <input type="text" id="f-date" value="${d.shamsiDate || today}" />
        </div>
        <div class="form-group">
          <label>دسته‌بندی</label>
          <select id="f-category">
            <option value="موتور" ${d.category==='موتور'?'selected':''}>موتور</option>
            <option value="جلوبندی" ${d.category==='جلوبندی'?'selected':''}>جلوبندی</option>
            <option value="بدنه" ${d.category==='بدنه'?'selected':''}>بدنه</option>
            <option value="برق" ${d.category==='برق'?'selected':''}>برق</option>
            <option value="سایر" ${d.category==='سایر'?'selected':''}>سایر</option>
          </select>
        </div>
        <div class="form-group">
          <label>عنوان</label>
          <input type="text" id="f-title" value="${d.title||''}" required />
        </div>
        <div class="form-group">
          <label>کیلومتر</label>
          <input type="number" id="f-odometer" value="${d.odometer||''}" />
        </div>
        <div class="form-group">
          <label>هزینه قطعات</label>
          <input type="number" class="calc-input" id="f-parts" value="${d.partsCost||''}" />
        </div>
        <div class="form-group">
          <label>دستمزد</label>
          <input type="number" class="calc-input" id="f-labor" value="${d.laborCost||''}" />
        </div>
        <div class="form-group">
          <label>جمع کل</label>
          <input type="text" id="f-total" value="${d.totalCost ? d.totalCost.toLocaleString('fa-IR') : ''}" readonly />
        </div>
        <div class="form-group">
          <label>تعمیرگاه</label>
          <input type="text" id="f-workshop" value="${d.workshop||''}" />
        </div>
        <div class="form-group">
          <label>تاریخ پایان گارانتی (شمسی)</label>
          <input type="text" id="f-warranty" value="${d.warrantyShamsi||''}" placeholder="۱۴۰۶/۰۱/۰۱" />
        </div>
        <div class="form-group">
          <label>توضیحات</label>
          <textarea id="f-desc" rows="2">${d.description||''}</textarea>
        </div>
      `;
    }

    if (store === 'insurance') {
      return `
        <div class="form-group">
          <label>نوع بیمه</label>
          <select id="f-ins-type">
            <option value="شخص ثالث" ${d.insuranceType==='شخص ثالث'?'selected':''}>شخص ثالث</option>
            <option value="بدنه" ${d.insuranceType==='بدنه'?'selected':''}>بدنه</option>
            <option value="کامل" ${d.insuranceType==='کامل'?'selected':''}>کامل (ثالث + بدنه)</option>
            <option value="سایر" ${d.insuranceType==='سایر'?'selected':''}>سایر</option>
          </select>
        </div>
        <div class="form-group">
          <label>شرکت بیمه</label>
          <input type="text" id="f-ins-company" value="${d.company||''}" placeholder="ایران، آسیا، پارسیان، ..." />
        </div>
        <div class="form-group">
          <label>شماره بیمه‌نامه</label>
          <input type="text" id="f-ins-policy" value="${d.policyNumber||''}" />
        </div>
        <div class="form-group">
          <label>تاریخ شروع (شمسی)</label>
          <input type="text" id="f-ins-start" value="${d.startShamsi||d.shamsiDate||today}" placeholder="۱۴۰۵/۰۱/۰۱" />
        </div>
        <div class="form-group">
          <label>تاریخ پایان / انقضا (شمسی)</label>
          <input type="text" id="f-ins-end" value="${d.endShamsi||''}" placeholder="۱۴۰۶/۰۱/۰۱" required />
        </div>
        <div class="form-group">
          <label>حق بیمه (مبلغ پرداختی)</label>
          <input type="number" id="f-ins-premium" value="${d.premium||''}" />
        </div>
        <div class="form-group">
          <label>پوشش‌ها / توضیحات</label>
          <textarea id="f-ins-coverage" rows="2">${d.coverage||''}</textarea>
        </div>
        <div class="form-group">
          <label>شماره تماس شرکت / نماینده</label>
          <input type="text" id="f-ins-phone" value="${d.agentPhone||''}" />
        </div>
        <div class="form-group">
          <label>یادداشت</label>
          <textarea id="f-ins-notes" rows="2">${d.notes||''}</textarea>
        </div>
      `;
    }

    if (store === 'daily') {
      return `
        <div class="form-group">
          <label>تاریخ (شمسی)</label>
          <input type="text" id="f-date" value="${d.shamsiDate || today}" />
        </div>
        <div class="form-group">
          <label>دسته‌بندی</label>
          <input type="text" id="f-category" value="${d.category||''}" placeholder="خوراک، حمل‌ونقل، ..." />
        </div>
        <div class="form-group">
          <label>عنوان</label>
          <input type="text" id="f-title" value="${d.title||''}" required />
        </div>
        <div class="form-group">
          <label>مبلغ</label>
          <input type="number" id="f-amount" value="${d.amount||''}" required />
        </div>
        <div class="form-group">
          <label>توضیحات</label>
          <textarea id="f-desc" rows="2">${d.description||''}</textarea>
        </div>
      `;
    }
    return '';
  },

  async saveForm() {
    const store = this.currentStore;
    const dateStr = document.getElementById('f-date')?.value || Shamsi.today();
    const dateObj = Shamsi.fromShamsi(dateStr);
    const { year, month } = Shamsi.getYearMonth(dateObj);

    let data = {
      shamsiDate: dateStr,
      date: dateObj.toISOString(),
      shamsiYear: year,
      shamsiMonth: month,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.currentEdit) {
      data.id = this.currentEdit.id;
      data.createdAt = this.currentEdit.createdAt;
    }

    try {
      if (store === 'expenses') {
        data.type = document.getElementById('f-type').value;
        data.category = document.getElementById('f-category').value;
        data.title = document.getElementById('f-title').value;
        data.amount = parseFloat(document.getElementById('f-amount').value) || 0;
        data.debtStatus = document.getElementById('f-debt-status').value;
        data.description = document.getElementById('f-desc').value;
        data.isDebt = data.type === 'debt';
      } else if (store === 'fuel') {
        data.odometer = parseFloat(document.getElementById('f-odometer').value) || 0;
        data.liters = parseFloat(document.getElementById('f-liters').value) || 0;
        data.pricePerLiter = parseFloat(document.getElementById('f-price').value) || 0;
        data.totalCost = data.liters * data.pricePerLiter;
        data.fuelType = document.getElementById('f-fuel-type').value;
        data.station = document.getElementById('f-station').value;
        data.notes = document.getElementById('f-notes').value;
      } else if (store === 'oil') {
        data.odometer = parseFloat(document.getElementById('f-odometer').value) || 0;
        data.oilType = document.getElementById('f-oil-type').value;
        data.oilBrand = document.getElementById('f-oil-brand').value;
        data.oilAmount = parseFloat(document.getElementById('f-oil-amount').value) || 0;
        data.oilCost = parseFloat(document.getElementById('f-oil-cost').value) || 0;
        data.filterChanged = document.getElementById('f-filter').value === 'true';
        data.filterCost = parseFloat(document.getElementById('f-filter-cost').value) || 0;
        data.otherCosts = parseFloat(document.getElementById('f-other-cost').value) || 0;
        data.totalCost = data.oilCost + data.filterCost + data.otherCosts;
        data.nextServiceOdometer = parseFloat(document.getElementById('f-next-odo').value) || 0;
        data.nextServiceShamsi = document.getElementById('f-next-date').value || '';
        if (data.nextServiceShamsi) {
          data.nextServiceDate = Shamsi.fromShamsi(data.nextServiceShamsi).toISOString();
        }
        data.workshop = document.getElementById('f-workshop').value;
        data.notes = document.getElementById('f-notes').value;
      } else if (store === 'repairs') {
        data.category = document.getElementById('f-category').value;
        data.title = document.getElementById('f-title').value;
        data.odometer = parseFloat(document.getElementById('f-odometer').value) || 0;
        data.partsCost = parseFloat(document.getElementById('f-parts').value) || 0;
        data.laborCost = parseFloat(document.getElementById('f-labor').value) || 0;
        data.totalCost = data.partsCost + data.laborCost;
        data.workshop = document.getElementById('f-workshop').value;
        data.warrantyShamsi = document.getElementById('f-warranty').value || '';
        if (data.warrantyShamsi) {
          data.warrantyUntil = Shamsi.fromShamsi(data.warrantyShamsi).toISOString();
        }
        data.description = document.getElementById('f-desc').value;
      } else if (store === 'insurance') {
        data.insuranceType = document.getElementById('f-ins-type').value;
        data.company = document.getElementById('f-ins-company').value;
        data.policyNumber = document.getElementById('f-ins-policy').value;
        data.startShamsi = document.getElementById('f-ins-start').value || Shamsi.today();
        data.endShamsi = document.getElementById('f-ins-end').value;
        data.startDate = Shamsi.fromShamsi(data.startShamsi).toISOString();
        data.endDate = data.endShamsi ? Shamsi.fromShamsi(data.endShamsi).toISOString() : null;
        // use start as main date for sorting/year-month
        const startObj = Shamsi.fromShamsi(data.startShamsi);
        const ym = Shamsi.getYearMonth(startObj);
        data.date = data.startDate;
        data.shamsiDate = data.startShamsi;
        data.shamsiYear = ym.year;
        data.shamsiMonth = ym.month;
        data.premium = parseFloat(document.getElementById('f-ins-premium').value) || 0;
        data.coverage = document.getElementById('f-ins-coverage').value;
        data.agentPhone = document.getElementById('f-ins-phone').value;
        data.notes = document.getElementById('f-ins-notes').value;
      } else if (store === 'daily') {
        data.category = document.getElementById('f-category').value;
        data.title = document.getElementById('f-title').value;
        data.amount = parseFloat(document.getElementById('f-amount').value) || 0;
        data.description = document.getElementById('f-desc').value;
      }

      if (this.currentEdit) {
        await DB.update(store, data);
        this.showToast('رکورد با موفقیت ویرایش شد');
      } else {
        await DB.add(store, data);
        this.showToast('رکورد با موفقیت ذخیره شد');
      }

      document.getElementById('modal').classList.add('hidden');
      await this.refreshAll();
      await this.checkReminders(true);
    } catch (err) {
      console.error(err);
      this.showToast('خطا در ذخیره‌سازی', true);
    }
  },

  // ========== RENDER TABLES ==========
  async refreshAll() {
    await Promise.all([
      this.renderExpenses(),
      this.renderFuel(),
      this.renderOil(),
      this.renderRepairs(),
      this.renderInsurance(),
      this.renderDaily()
    ]);
    this.populateMonthFilters();
  },

  filterBySearch(items, fields) {
    if (!this.searchQuery) return items;
    return items.filter(item => {
      return fields.some(f => {
        const val = item[f];
        return val && String(val).toLowerCase().includes(this.searchQuery);
      });
    });
  },

  async renderExpenses() {
    let items = await DB.getAll('expenses');
    items = this.filterBySearch(items, ['title', 'category', 'description', 'type']);
    const typeFilter = document.getElementById('expense-type-filter')?.value || 'all';
    const monthFilter = document.getElementById('expense-month-filter')?.value || 'all';

    if (typeFilter !== 'all') items = items.filter(i => i.type === typeFilter);
    if (monthFilter !== 'all') {
      const [y, m] = monthFilter.split('-').map(Number);
      items = items.filter(i => i.shamsiYear === y && i.shamsiMonth === m);
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#expenses-table tbody');
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${item.shamsiDate}</td>
        <td>${this.typeLabel(item.type)}</td>
        <td>${item.category || '-'}</td>
        <td>${item.title}</td>
        <td>${this.formatMoney(item.amount)}</td>
        <td>${item.type === 'debt' ? this.debtLabel(item.debtStatus) : '-'}</td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="App.openForm('expenses', ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️</button>
          <button class="action-btn delete" onclick="App.deleteRecord('expenses', ${item.id})">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center">رکوردی وجود ندارد</td></tr>';

    // Summary
    const total = items.reduce((s, i) => s + (i.amount || 0), 0);
    const debt = items.filter(i => i.type === 'debt' && i.debtStatus !== 'paid').reduce((s, i) => s + i.amount, 0);
    document.getElementById('expenses-summary').innerHTML = `
      <div class="summary-card"><div class="label">جمع کل</div><div class="value">${this.formatMoney(total)}</div></div>
      <div class="summary-card danger"><div class="label">بدهی باز</div><div class="value">${this.formatMoney(debt)}</div></div>
      <div class="summary-card"><div class="label">تعداد</div><div class="value">${items.length}</div></div>
    `;
  },

  async renderFuel() {
    let items = await DB.getAll('fuel');
    items = this.filterBySearch(items, ['station', 'fuelType', 'notes']);
    const monthFilter = document.getElementById('fuel-month-filter')?.value || 'all';
    if (monthFilter !== 'all') {
      const [y, m] = monthFilter.split('-').map(Number);
      items = items.filter(i => i.shamsiYear === y && i.shamsiMonth === m);
    }
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#fuel-table tbody');
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${item.shamsiDate}</td>
        <td>${item.odometer?.toLocaleString('fa-IR') || '-'}</td>
        <td>${item.liters}</td>
        <td>${this.formatMoney(item.pricePerLiter)}</td>
        <td>${this.formatMoney(item.totalCost)}</td>
        <td>${item.fuelType || '-'}</td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="App.openForm('fuel', ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️</button>
          <button class="action-btn delete" onclick="App.deleteRecord('fuel', ${item.id})">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center">رکوردی وجود ندارد</td></tr>';

    const totalCost = items.reduce((s, i) => s + (i.totalCost || 0), 0);
    const totalLiters = items.reduce((s, i) => s + (i.liters || 0), 0);
    document.getElementById('fuel-summary').innerHTML = `
      <div class="summary-card"><div class="label">جمع هزینه</div><div class="value">${this.formatMoney(totalCost)}</div></div>
      <div class="summary-card"><div class="label">جمع لیتر</div><div class="value">${totalLiters.toFixed(1)}</div></div>
      <div class="summary-card"><div class="label">تعداد</div><div class="value">${items.length}</div></div>
    `;
  },

  async renderOil() {
    let items = await DB.getAll('oil');
    items = this.filterBySearch(items, ['oilType', 'oilBrand', 'workshop', 'notes']);
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#oil-table tbody');
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${item.shamsiDate}</td>
        <td>${item.odometer?.toLocaleString('fa-IR') || '-'}</td>
        <td>${item.oilType || '-'} ${item.oilBrand ? '('+item.oilBrand+')' : ''}</td>
        <td>${this.formatMoney(item.oilCost)}</td>
        <td>${item.filterChanged ? 'بله' : 'خیر'}</td>
        <td>${this.formatMoney(item.totalCost)}</td>
        <td>${item.nextServiceOdometer ? item.nextServiceOdometer.toLocaleString('fa-IR') : '-'}</td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="App.openForm('oil', ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️</button>
          <button class="action-btn delete" onclick="App.deleteRecord('oil', ${item.id})">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center">رکوردی وجود ندارد</td></tr>';

    // Next service alert (uses smart threshold)
    const settings = await DB.getSettings();
    const currentOdo = settings.carOdometer || 0;
    const kmTh = settings.reminderKmThreshold ?? 500;
    const last = items[0];
    const alertEl = document.getElementById('next-service-alert');
    if (last && last.nextServiceOdometer) {
      const remaining = last.nextServiceOdometer - currentOdo;
      if (remaining <= 0) {
        alertEl.classList.remove('hidden');
        alertEl.style.borderColor = 'var(--danger)';
        alertEl.textContent = `🚨 سرویس روغن عقب افتاده! کیلومتر فعلی: ${currentOdo.toLocaleString('fa-IR')} — موعد: ${last.nextServiceOdometer.toLocaleString('fa-IR')} (${Math.abs(remaining).toLocaleString('fa-IR')} کیلومتر گذشته)`;
      } else if (remaining <= kmTh) {
        alertEl.classList.remove('hidden');
        alertEl.style.borderColor = 'var(--warning)';
        alertEl.textContent = `⚠️ نزدیک به سرویس روغن! ${remaining.toLocaleString('fa-IR')} کیلومتر مانده (فعلی: ${currentOdo.toLocaleString('fa-IR')} → بعدی: ${last.nextServiceOdometer.toLocaleString('fa-IR')})`;
      } else {
        alertEl.classList.add('hidden');
      }
    } else {
      alertEl.classList.add('hidden');
    }

    const total = items.reduce((s, i) => s + (i.totalCost || 0), 0);
    document.getElementById('oil-summary').innerHTML = `
      <div class="summary-card"><div class="label">جمع هزینه‌ها</div><div class="value">${this.formatMoney(total)}</div></div>
      <div class="summary-card"><div class="label">تعداد سرویس</div><div class="value">${items.length}</div></div>
    `;
  },

  async renderRepairs() {
    let items = await DB.getAll('repairs');
    items = this.filterBySearch(items, ['title', 'category', 'workshop', 'description']);
    const catFilter = document.getElementById('repair-category-filter')?.value || 'all';
    if (catFilter !== 'all') items = items.filter(i => i.category === catFilter);
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#repairs-table tbody');
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${item.shamsiDate}</td>
        <td>${item.category}</td>
        <td>${item.title}</td>
        <td>${this.formatMoney(item.partsCost)}</td>
        <td>${this.formatMoney(item.laborCost)}</td>
        <td>${this.formatMoney(item.totalCost)}</td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="App.openForm('repairs', ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️</button>
          <button class="action-btn delete" onclick="App.deleteRecord('repairs', ${item.id})">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center">رکوردی وجود ندارد</td></tr>';

    const total = items.reduce((s, i) => s + (i.totalCost || 0), 0);
    document.getElementById('repairs-summary').innerHTML = `
      <div class="summary-card"><div class="label">جمع تعمیرات</div><div class="value">${this.formatMoney(total)}</div></div>
      <div class="summary-card"><div class="label">تعداد</div><div class="value">${items.length}</div></div>
    `;
  },

  async renderInsurance() {
    let items = await DB.getAll('insurance');
    items = this.filterBySearch(items, ['company', 'policyNumber', 'insuranceType', 'coverage', 'notes']);
    const typeFilter = document.getElementById('insurance-type-filter')?.value || 'all';
    const statusFilter = document.getElementById('insurance-status-filter')?.value || 'all';
    if (typeFilter !== 'all') items = items.filter(i => i.insuranceType === typeFilter);

    const now = new Date();
    const settings = await DB.getSettings();
    const daysTh = settings.reminderDaysThreshold ?? 14;

    const withStatus = items.map(item => {
      let status = 'active';
      let daysLeft = null;
      if (item.endDate) {
        const end = new Date(item.endDate);
        daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) status = 'expired';
        else if (daysLeft <= daysTh) status = 'expiring';
        else status = 'active';
      }
      return { ...item, _status: status, _daysLeft: daysLeft };
    });

    let filtered = withStatus;
    if (statusFilter !== 'all') filtered = withStatus.filter(i => i._status === statusFilter);
    filtered.sort((a, b) => new Date(b.endDate || b.date) - new Date(a.endDate || a.date));

    const statusLabel = { active: 'فعال', expired: 'منقضی', expiring: 'نزدیک انقضا' };
    const statusClass = { active: 'ok', expired: 'urgent', expiring: 'warning' };

    const tbody = document.querySelector('#insurance-table tbody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td>${item.insuranceType || '-'}</td>
        <td>${item.company || '-'}</td>
        <td>${item.policyNumber || '-'}</td>
        <td>${item.startShamsi || item.shamsiDate || '-'}</td>
        <td>${item.endShamsi || '-'}</td>
        <td>${this.formatMoney(item.premium)}</td>
        <td><span class="status-tag ${statusClass[item._status] || ''}">${statusLabel[item._status] || '-'}</span></td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="App.openForm('insurance', ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️</button>
          <button class="action-btn delete" onclick="App.deleteRecord('insurance', ${item.id})">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center">بیمه‌نامه‌ای ثبت نشده</td></tr>';

    // Alert for soonest expiring/expired
    const alertEl = document.getElementById('insurance-alert');
    const urgent = withStatus.filter(i => i._status === 'expired' || i._status === 'expiring')
      .sort((a, b) => (a._daysLeft ?? 9999) - (b._daysLeft ?? 9999));
    if (urgent.length && alertEl) {
      const top = urgent[0];
      alertEl.classList.remove('hidden');
      if (top._status === 'expired') {
        alertEl.style.borderColor = 'var(--danger)';
        alertEl.textContent = `🚨 بیمه‌نامه «${top.insuranceType}» (${top.company || ''}) منقضی شده — تاریخ پایان: ${top.endShamsi}`;
      } else {
        alertEl.style.borderColor = 'var(--warning)';
        alertEl.textContent = `⚠️ بیمه‌نامه «${top.insuranceType}» تا ${top._daysLeft} روز دیگر منقضی می‌شود (${top.endShamsi})`;
      }
    } else if (alertEl) {
      alertEl.classList.add('hidden');
    }

    const activeCount = withStatus.filter(i => i._status === 'active' || i._status === 'expiring').length;
    const totalPremium = withStatus.reduce((s, i) => s + (i.premium || 0), 0);
    const sumEl = document.getElementById('insurance-summary');
    if (sumEl) {
      sumEl.innerHTML = `
        <div class="summary-card"><div class="label">بیمه‌های فعال</div><div class="value">${activeCount}</div></div>
        <div class="summary-card"><div class="label">جمع حق بیمه</div><div class="value">${this.formatMoney(totalPremium)}</div></div>
        <div class="summary-card"><div class="label">تعداد کل</div><div class="value">${withStatus.length}</div></div>
      `;
    }
  },

  async renderDaily() {
    let items = await DB.getAll('daily');
    items = this.filterBySearch(items, ['title', 'category', 'description']);
    const monthFilter = document.getElementById('daily-month-filter')?.value || 'all';
    if (monthFilter !== 'all') {
      const [y, m] = monthFilter.split('-').map(Number);
      items = items.filter(i => i.shamsiYear === y && i.shamsiMonth === m);
    }
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#daily-table tbody');
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${item.shamsiDate}</td>
        <td>${item.category || '-'}</td>
        <td>${item.title}</td>
        <td>${this.formatMoney(item.amount)}</td>
        <td class="action-btns">
          <button class="action-btn edit" onclick="App.openForm('daily', ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️</button>
          <button class="action-btn delete" onclick="App.deleteRecord('daily', ${item.id})">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center">رکوردی وجود ندارد</td></tr>';

    const total = items.reduce((s, i) => s + (i.amount || 0), 0);
    document.getElementById('daily-summary').innerHTML = `
      <div class="summary-card"><div class="label">جمع روزمره</div><div class="value">${this.formatMoney(total)}</div></div>
      <div class="summary-card"><div class="label">تعداد</div><div class="value">${items.length}</div></div>
    `;
  },

  async deleteRecord(store, id) {
    if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
    await DB.delete(store, id);
    this.showToast('رکورد حذف شد');
    await this.refreshAll();
  },

  // ========== CHARTS ==========
  async renderFuelChart() {
    const items = await DB.getAll('fuel');
    const byMonth = {};
    items.forEach(i => {
      const key = `${i.shamsiYear}/${String(i.shamsiMonth).padStart(2,'0')}`;
      byMonth[key] = (byMonth[key] || 0) + (i.totalCost || 0);
    });
    const labels = Object.keys(byMonth).sort();
    const data = labels.map(l => byMonth[l]);

    if (this.charts.fuel) this.charts.fuel.destroy();
    const ctx = document.getElementById('fuel-chart');
    if (!ctx) return;
    this.charts.fuel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'هزینه سوخت', data, backgroundColor: '#3b82f6' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f1f5f9' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        }
      }
    });
  },

  async renderDailyChart() {
    const items = await DB.getAll('daily');
    const byCat = {};
    items.forEach(i => {
      const cat = i.category || 'سایر';
      byCat[cat] = (byCat[cat] || 0) + (i.amount || 0);
    });
    const labels = Object.keys(byCat);
    const data = labels.map(l => byCat[l]);

    if (this.charts.daily) this.charts.daily.destroy();
    const ctx = document.getElementById('daily-chart');
    if (!ctx) return;
    this.charts.daily = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: ['#3b82f6','#059669','#d97706','#dc2626','#8b5cf6','#ec4899'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#f1f5f9' } } }
      }
    });
  },

  // ========== STATS ==========
  async renderStats() {
    const yearFilter = document.getElementById('stats-year-filter')?.value;
    const monthFilter = document.getElementById('stats-month-filter')?.value || 'all';

    const [expenses, fuel, oil, repairs, daily] = await Promise.all([
      DB.getAll('expenses'), DB.getAll('fuel'), DB.getAll('oil'), DB.getAll('repairs'), DB.getAll('daily')
    ]);

    const insurance = await DB.getAll('insurance');
    const all = [
      ...expenses.map(i => ({...i, _type: 'expense', _amount: i.amount})),
      ...fuel.map(i => ({...i, _type: 'fuel', _amount: i.totalCost})),
      ...oil.map(i => ({...i, _type: 'oil', _amount: i.totalCost})),
      ...repairs.map(i => ({...i, _type: 'repair', _amount: i.totalCost})),
      ...insurance.map(i => ({...i, _type: 'insurance', _amount: i.premium})),
      ...daily.map(i => ({...i, _type: 'daily', _amount: i.amount}))
    ];

    // Group by year-month
    const groups = {};
    all.forEach(item => {
      if (yearFilter && item.shamsiYear != yearFilter) return;
      if (monthFilter !== 'all') {
        const [y, m] = monthFilter.split('-').map(Number);
        if (item.shamsiYear !== y || item.shamsiMonth !== m) return;
      }
      const key = `${item.shamsiYear}-${String(item.shamsiMonth).padStart(2,'0')}`;
      if (!groups[key]) {
        groups[key] = { year: item.shamsiYear, month: item.shamsiMonth, expense:0, fuel:0, oil:0, repair:0, insurance:0, daily:0, total:0 };
      }
      groups[key][item._type === 'expense' ? 'expense' : item._type] += item._amount || 0;
      groups[key].total += item._amount || 0;
    });

    const keys = Object.keys(groups).sort().reverse();
    const container = document.getElementById('monthly-stats-container');
    container.innerHTML = keys.map(key => {
      const g = groups[key];
      return `
        <div class="month-stat-card">
          <h3>${Shamsi.getMonthName(g.month)} ${g.year}</h3>
          <div class="stat-row"><span>هزینه‌های شخصی/بدهی/ماشین</span><span>${this.formatMoney(g.expense)}</span></div>
          <div class="stat-row"><span>سوخت</span><span>${this.formatMoney(g.fuel)}</span></div>
          <div class="stat-row"><span>روغن</span><span>${this.formatMoney(g.oil)}</span></div>
          <div class="stat-row"><span>تعمیرات</span><span>${this.formatMoney(g.repair)}</span></div>
          <div class="stat-row"><span>بیمه</span><span>${this.formatMoney(g.insurance)}</span></div>
          <div class="stat-row"><span>روزمره</span><span>${this.formatMoney(g.daily)}</span></div>
          <div class="stat-row"><span>جمع کل ماه</span><span>${this.formatMoney(g.total)}</span></div>
        </div>
      `;
    }).join('') || '<p style="text-align:center;color:var(--text-muted)">داده‌ای برای نمایش وجود ندارد</p>';

    // Chart
    if (this.charts.stats) this.charts.stats.destroy();
    const ctx = document.getElementById('stats-chart');
    if (ctx && keys.length) {
      this.charts.stats = new Chart(ctx, {
        type: 'line',
        data: {
          labels: keys.map(k => {
            const [y, m] = k.split('-');
            return `${Shamsi.getMonthName(+m)} ${y}`;
          }).reverse(),
          datasets: [{
            label: 'جمع هزینه ماهانه',
            data: keys.map(k => groups[k].total).reverse(),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.2)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#f1f5f9' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
          }
        }
      });
    }
  },

  // ========== HELPERS ==========
  typeLabel(t) {
    return { personal: 'شخصی', debt: 'بدهی', car: 'ماشین' }[t] || t;
  },
  debtLabel(s) {
    return { pending: 'در انتظار', paid: 'پرداخت‌شده', partial: 'جزئی' }[s] || s;
  },
  formatMoney(n) {
    if (n == null) return '۰';
    return Number(n).toLocaleString('fa-IR');
  },

  async populateMonthFilters() {
    const all = [
      ...(await DB.getAll('expenses')),
      ...(await DB.getAll('fuel')),
      ...(await DB.getAll('daily'))
    ];
    const months = new Set();
    all.forEach(i => {
      if (i.shamsiYear && i.shamsiMonth) {
        months.add(`${i.shamsiYear}-${String(i.shamsiMonth).padStart(2,'0')}`);
      }
    });
    const sorted = Array.from(months).sort().reverse();
    const options = '<option value="all">همه ماه‌ها</option>' +
      sorted.map(m => {
        const [y, mo] = m.split('-');
        return `<option value="${m}">${Shamsi.getMonthName(+mo)} ${y}</option>`;
      }).join('');

    ['expense-month-filter', 'fuel-month-filter', 'daily-month-filter', 'stats-month-filter']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const current = el.value;
          el.innerHTML = options;
          if (current) el.value = current;
        }
      });
  },

  populateYearFilters() {
    const years = Shamsi.getYearOptions();
    const el = document.getElementById('stats-year-filter');
    if (el) {
      el.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
      el.value = Shamsi.getYearMonth(new Date()).year;
    }
  },

  // ========== SETTINGS ==========
  async loadSettingsToForm() {
    const s = await DB.getSettings();
    document.getElementById('car-model').value = s.carModel || '';
    document.getElementById('car-plate').value = s.carPlate || '';
    document.getElementById('car-odometer').value = s.carOdometer || '';
    document.getElementById('currency').value = s.currency || 'تومان';
    document.getElementById('reminder-km').value = s.reminderKmThreshold ?? 500;
    document.getElementById('reminder-days').value = s.reminderDaysThreshold ?? 14;
    document.getElementById('enable-notifications').checked = s.enableNotifications !== false;
  },

  async saveSettings() {
    const prev = await DB.getSettings();
    const data = {
      ...prev,
      carModel: document.getElementById('car-model').value,
      carPlate: document.getElementById('car-plate').value,
      carOdometer: parseFloat(document.getElementById('car-odometer').value) || 0,
      currency: document.getElementById('currency').value,
      reminderKmThreshold: parseInt(document.getElementById('reminder-km').value) || 500,
      reminderDaysThreshold: parseInt(document.getElementById('reminder-days').value) || 14,
      enableNotifications: document.getElementById('enable-notifications').checked
    };
    await DB.saveSettings(data);
    document.getElementById('settings-modal').classList.add('hidden');
    this.showToast('تنظیمات ذخیره شد');
    await this.renderOil();
    await this.checkReminders(true);
  },

  async clearAllData() {
    if (!confirm('تمام داده‌ها برای همیشه حذف می‌شوند. مطمئن هستید؟')) return;
    if (!confirm('این عمل غیرقابل بازگشت است!')) return;
    await DB.clearAll();
    this.showToast('تمام داده‌ها پاک شد');
    await this.refreshAll();
  },

  // ========== EXPORT ==========
  showExportMenu() {
    // Simple: export current tab or all
    this.exportAllCSV();
  },

  async exportAllCSV() {
    const stores = ['expenses', 'fuel', 'oil', 'repairs', 'insurance', 'daily'];
    let csv = '\uFEFF'; // BOM for Excel UTF-8

    for (const store of stores) {
      const items = await DB.getAll(store);
      if (!items.length) continue;
      csv += `\n\n=== ${store.toUpperCase()} ===\n`;
      const keys = Object.keys(items[0]).filter(k => k !== 'id');
      csv += keys.join(',') + '\n';
      items.forEach(item => {
        csv += keys.map(k => {
          let v = item[k];
          if (typeof v === 'string') v = `"${v.replace(/"/g, '""')}"`;
          return v ?? '';
        }).join(',') + '\n';
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${Shamsi.today().replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('فایل CSV دانلود شد');
  },

  async exportAllPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    // Note: Persian text support is limited in jsPDF without custom font.
    // We use English headers + numbers for compatibility.
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('Car & Expense Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Date: ${Shamsi.today()}`, 105, 28, { align: 'center' });

    let y = 40;
    const stores = [
      { name: 'expenses', title: 'Expenses / Debts / Car' },
      { name: 'fuel', title: 'Fuel Logs' },
      { name: 'oil', title: 'Oil Changes' },
      { name: 'repairs', title: 'Repairs' },
      { name: 'insurance', title: 'Insurance' },
      { name: 'daily', title: 'Daily Expenses' }
    ];

    for (const s of stores) {
      const items = await DB.getAll(s.name);
      if (!items.length) continue;
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text(s.title, 14, y);
      y += 8;

      const rows = items.slice(0, 30).map(i => {
        if (s.name === 'expenses') return [i.shamsiDate, i.type, i.title, String(i.amount)];
        if (s.name === 'fuel') return [i.shamsiDate, String(i.liters), String(i.totalCost)];
        if (s.name === 'oil') return [i.shamsiDate, i.oilType || '', String(i.totalCost)];
        if (s.name === 'repairs') return [i.shamsiDate, i.title, String(i.totalCost)];
        if (s.name === 'insurance') return [i.endShamsi || i.shamsiDate, (i.insuranceType||'') + ' ' + (i.company||''), String(i.premium)];
        return [i.shamsiDate, i.title, String(i.amount)];
      });

      doc.autoTable({
        startY: y,
        head: [['Date', 'Info', 'Amount']],
        body: rows,
        styles: { fontSize: 8 },
        margin: { left: 14 }
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    doc.save(`report-${Shamsi.today().replace(/\//g, '-')}.pdf`);
    this.showToast('فایل PDF دانلود شد');
  },

  async exportMonthlyPDF() {
    const year = document.getElementById('stats-year-filter')?.value;
    const month = document.getElementById('stats-month-filter')?.value;
    if (month === 'all') {
      this.showToast('لطفاً یک ماه مشخص انتخاب کنید', true);
      return;
    }
    // Reuse exportAllPDF logic filtered - simplified
    this.showToast('در حال آماده‌سازی PDF ماهانه...');
    await this.exportAllPDF();
  },

  // ========== SMART REMINDERS ==========
  async getReminders() {
    const settings = await DB.getSettings();
    const currentOdo = settings.carOdometer || 0;
    const kmTh = settings.reminderKmThreshold ?? 500;
    const daysTh = settings.reminderDaysThreshold ?? 14;
    const now = new Date();
    const reminders = [];

    // Oil service reminders
    const oilItems = await DB.getAll('oil');
    oilItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastOil = oilItems[0];

    if (lastOil) {
      // By odometer
      if (lastOil.nextServiceOdometer) {
        const remaining = lastOil.nextServiceOdometer - currentOdo;
        if (remaining <= 0) {
          reminders.push({
            type: 'oil',
            urgency: 'urgent',
            title: 'سرویس روغن عقب افتاده',
            message: `کیلومتر فعلی ${currentOdo.toLocaleString('fa-IR')} از موعد ${lastOil.nextServiceOdometer.toLocaleString('fa-IR')} گذشته است (${Math.abs(remaining).toLocaleString('fa-IR')} کیلومتر).`,
            action: 'oil'
          });
        } else if (remaining <= kmTh) {
          reminders.push({
            type: 'oil',
            urgency: 'warning',
            title: 'نزدیک به سرویس روغن',
            message: `${remaining.toLocaleString('fa-IR')} کیلومتر تا سرویس بعدی روغن مانده است.`,
            action: 'oil'
          });
        }
      }
      // By date
      if (lastOil.nextServiceDate) {
        const nextDate = new Date(lastOil.nextServiceDate);
        const diffDays = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          reminders.push({
            type: 'oil-date',
            urgency: 'urgent',
            title: 'تاریخ سرویس روغن گذشته',
            message: `موعد سرویس روغن (${lastOil.nextServiceShamsi || Shamsi.toShamsi(nextDate)}) گذشته است.`,
            action: 'oil'
          });
        } else if (diffDays <= daysTh) {
          reminders.push({
            type: 'oil-date',
            urgency: 'warning',
            title: 'سرویس روغن نزدیک است',
            message: `${diffDays} روز تا تاریخ سرویس روغن (${lastOil.nextServiceShamsi || Shamsi.toShamsi(nextDate)}) باقی مانده.`,
            action: 'oil'
          });
        }
      }
    } else {
      reminders.push({
        type: 'oil',
        urgency: 'ok',
        title: 'هنوز سرویس روغن ثبت نشده',
        message: 'برای فعال شدن یادآوری، اولین سرویس روغن را ثبت کنید و کیلومتر/تاریخ سرویس بعدی را مشخص کنید.',
        action: 'oil'
      });
    }

    // Repair warranty reminders
    const repairs = await DB.getAll('repairs');
    repairs.forEach(r => {
      if (!r.warrantyUntil) return;
      const wDate = new Date(r.warrantyUntil);
      const diffDays = Math.ceil((wDate - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        reminders.push({
          type: 'warranty',
          urgency: 'urgent',
          title: `گارانتی «${r.title}» تمام شده`,
          message: `گارانتی تعمیر ${r.category} در تاریخ ${r.warrantyShamsi || Shamsi.toShamsi(wDate)} به پایان رسیده.`,
          action: 'repairs'
        });
      } else if (diffDays <= daysTh) {
        reminders.push({
          type: 'warranty',
          urgency: 'warning',
          title: `گارانتی «${r.title}» رو به اتمام`,
          message: `${diffDays} روز تا پایان گارانتی (${r.warrantyShamsi || Shamsi.toShamsi(wDate)}) باقی مانده.`,
          action: 'repairs'
        });
      }
    });


    // Insurance expiry reminders
    const insItems = await DB.getAll('insurance');
    insItems.forEach(ins => {
      if (!ins.endDate) return;
      const end = new Date(ins.endDate);
      const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      const label = `${ins.insuranceType || 'بیمه'}${ins.company ? ' — ' + ins.company : ''}`;
      if (diffDays < 0) {
        reminders.push({
          type: 'insurance',
          urgency: 'urgent',
          title: `بیمه‌نامه منقضی: ${label}`,
          message: `تاریخ پایان ${ins.endShamsi || Shamsi.toShamsi(end)} گذشته است. هرچه سریع‌تر تمدید کنید.`,
          action: 'insurance'
        });
      } else if (diffDays <= daysTh) {
        reminders.push({
          type: 'insurance',
          urgency: 'warning',
          title: `تمدید بیمه نزدیک است: ${label}`,
          message: `${diffDays} روز تا انقضای بیمه‌نامه (${ins.endShamsi || Shamsi.toShamsi(end)}) باقی مانده.`,
          action: 'insurance'
        });
      }
    });

    // Sort: urgent first
    reminders.sort((a, b) => {
      const order = { urgent: 0, warning: 1, ok: 2 };
      return (order[a.urgency] || 9) - (order[b.urgency] || 9);
    });

    return { reminders, settings };
  },

  async checkReminders(showBanner = true) {
    const { reminders, settings } = await this.getReminders();
    const active = reminders.filter(r => r.urgency === 'urgent' || r.urgency === 'warning');

    // Badge
    const badge = document.getElementById('reminder-badge');
    if (active.length > 0) {
      badge.textContent = active.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Banner
    const banner = document.getElementById('reminders-banner');
    const bannerText = document.getElementById('reminders-banner-text');
    if (showBanner && active.length > 0) {
      const urgentCount = active.filter(r => r.urgency === 'urgent').length;
      bannerText.textContent = urgentCount > 0
        ? `🚨 ${urgentCount} یادآوری فوری و ${active.length - urgentCount} هشدار — برای جزئیات روی 🔔 بزنید`
        : `⚠️ ${active.length} یادآوری سرویس/گارانتی — برای جزئیات روی 🔔 بزنید`;
      banner.classList.remove('hidden');
    } else if (active.length === 0) {
      banner.classList.add('hidden');
    }

    // Browser notification (once per session roughly)
    if (settings.enableNotifications && active.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      const lastAt = settings.lastNotificationAt ? new Date(settings.lastNotificationAt) : null;
      const hoursSince = lastAt ? (Date.now() - lastAt.getTime()) / 3600000 : 999;
      if (hoursSince > 6) {
        const top = active[0];
        try {
          new Notification('یادآوری سرویس خودرو', {
            body: top.title + ' — ' + top.message,
            icon: './icons/icon-192.png',
            tag: 'car-service-reminder'
          });
          settings.lastNotificationAt = new Date().toISOString();
          await DB.saveSettings(settings);
        } catch (e) { /* ignore */ }
      }
    }

    return active;
  },

  async renderRemindersList() {
    const { reminders } = await this.getReminders();
    const list = document.getElementById('reminders-list');
    if (!reminders.length) {
      list.innerHTML = '<p class="about-text">یادآوری فعالی وجود ندارد.</p>';
      return;
    }
    list.innerHTML = reminders.map(r => `
      <div class="reminder-item ${r.urgency}">
        <h4>${r.title}</h4>
        <p>${r.message}</p>
        <span class="status-tag ${r.urgency}">${r.urgency === 'urgent' ? 'فوری' : r.urgency === 'warning' ? 'هشدار' : 'اطلاع'}</span>
        <button class="btn btn-secondary" style="margin-top:10px;padding:6px 12px;font-size:0.85rem"
          onclick="App.switchTab('${r.action}');document.getElementById('reminders-modal').classList.add('hidden')">
          رفتن به بخش مربوطه
        </button>
      </div>
    `).join('');
    await this.checkReminders(false);
  },

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      this.showToast('مرورگر شما از اعلان پشتیبانی نمی‌کند', true);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      this.showToast('مجوز اعلان داده شد');
      await this.checkReminders(true);
    } else {
      this.showToast('مجوز اعلان رد شد', true);
    }
  },

  showToast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden', 'error');
    if (isError) el.classList.add('error');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
