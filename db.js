/**
 * IndexedDB wrapper - Local only storage
 * Stores: expenses, fuel, oil, repairs, daily, insurance, settings
 */
const DB = {
  name: 'CarExpenseDB',
  version: 2,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = ['expenses', 'fuel', 'oil', 'repairs', 'daily', 'insurance', 'settings'];
        stores.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
            if (name !== 'settings') {
              store.createIndex('date', 'date', { unique: false });
              store.createIndex('shamsiYear', 'shamsiYear', { unique: false });
              store.createIndex('shamsiMonth', 'shamsiMonth', { unique: false });
            }
          }
        });
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  },

  async add(storeName, data) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async update(storeName, data) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clearAll() {
    const stores = ['expenses', 'fuel', 'oil', 'repairs', 'daily', 'insurance'];
    for (const s of stores) {
      await this.clear(s);
    }
  },

  // Settings helpers (single record with id=1)
  async getSettings() {
    const all = await this.getAll('settings');
    if (all.length === 0) {
      const defaults = {
        id: 1,
        carModel: '',
        carPlate: '',
        carOdometer: 0,
        currency: 'تومان',
        // Smart reminder settings
        reminderKmThreshold: 500,      // هشدار چند کیلومتر قبل از سرویس
        reminderDaysThreshold: 14,     // هشدار چند روز قبل از تاریخ سرویس
        enableNotifications: true,
        lastNotificationAt: null
      };
      await this.add('settings', defaults);
      return defaults;
    }
    // ensure new fields exist for older installs
    const s = all[0];
    if (s.reminderKmThreshold == null) s.reminderKmThreshold = 500;
    if (s.reminderDaysThreshold == null) s.reminderDaysThreshold = 14;
    if (s.enableNotifications == null) s.enableNotifications = true;
    return s;
  },

  async saveSettings(data) {
    data.id = 1;
    return this.update('settings', data);
  }
};
