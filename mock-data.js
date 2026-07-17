/* =========================================================================
   mock-data.js — локальная "БД" на localStorage (см. USE_MOCKS в supabase.js)
   ========================================================================= */

const LS_KEY = 'launchgrid_inv_db_v1';
const LS_SESSION = 'launchgrid_inv_session_v1';

function uid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }
function todayISO(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() - offsetDays);
  return d.toISOString();
}

const SEED = {
  users: [
    { id: 'u_demo', email: 'demo@shop.uz', password: '123456', businessName: 'Cactus Home Decor', plan: 'free', telegramBotToken: '', telegramChatId: '', createdAt: todayISO(60) },
  ],
  products: [
    { id: 'p1', ownerId: 'u_demo', name: 'Керамическая ваза S', category: 'Декор', price: 129000, cost: 60000, quantity: 14, lowStockThreshold: 5, createdAt: todayISO(50) },
    { id: 'p2', ownerId: 'u_demo', name: 'Керамическая ваза L', category: 'Декор', price: 219000, cost: 110000, quantity: 3, lowStockThreshold: 5, createdAt: todayISO(50) },
    { id: 'p3', ownerId: 'u_demo', name: 'Свеча соевая "Уют"', category: 'Свечи', price: 65000, cost: 25000, quantity: 42, lowStockThreshold: 10, createdAt: todayISO(40) },
    { id: 'p4', ownerId: 'u_demo', name: 'Плед вязаный', category: 'Текстиль', price: 349000, cost: 180000, quantity: 6, lowStockThreshold: 4, createdAt: todayISO(30) },
    { id: 'p5', ownerId: 'u_demo', name: 'Постер в раме A3', category: 'Декор', price: 149000, cost: 70000, quantity: 2, lowStockThreshold: 5, createdAt: todayISO(20) },
    { id: 'p6', ownerId: 'u_demo', name: 'Ароматический саше', category: 'Свечи', price: 39000, cost: 12000, quantity: 58, lowStockThreshold: 15, createdAt: todayISO(15) },
  ],
  sales: [
    { id: 's1', ownerId: 'u_demo', productId: 'p1', quantity: 1, unitPrice: 129000, channel: 'instagram', createdAt: todayISO(0) },
    { id: 's2', ownerId: 'u_demo', productId: 'p3', quantity: 3, unitPrice: 65000, channel: 'telegram', createdAt: todayISO(0) },
    { id: 's3', ownerId: 'u_demo', productId: 'p4', quantity: 1, unitPrice: 349000, channel: 'direct', createdAt: todayISO(1) },
    { id: 's4', ownerId: 'u_demo', productId: 'p6', quantity: 5, unitPrice: 39000, channel: 'instagram', createdAt: todayISO(1) },
    { id: 's5', ownerId: 'u_demo', productId: 'p2', quantity: 1, unitPrice: 219000, channel: 'telegram', createdAt: todayISO(3) },
    { id: 's6', ownerId: 'u_demo', productId: 'p5', quantity: 2, unitPrice: 149000, channel: 'instagram', createdAt: todayISO(5) },
  ],
};

function loadDB() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) { localStorage.setItem(LS_KEY, JSON.stringify(SEED)); return JSON.parse(JSON.stringify(SEED)); }
  return JSON.parse(raw);
}
function saveDB(db) { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
function delay(ms = 220) { return new Promise((res) => setTimeout(res, ms)); }

const MockDB = {
  /* ---------------- AUTH ---------------- */
  async signUp({ email, password, businessName }) {
    await delay();
    const db = loadDB();
    if (db.users.some((u) => u.email === email)) throw new Error('Аккаунт с таким email уже существует.');
    const user = {
      id: uid('u'), email, password, businessName, plan: 'free',
      telegramBotToken: '', telegramChatId: '', createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    saveDB(db);
    localStorage.setItem(LS_SESSION, user.id);
    return { user };
  },
  async signIn({ email, password }) {
    await delay();
    const db = loadDB();
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) throw new Error('Неверный email или пароль.');
    localStorage.setItem(LS_SESSION, user.id);
    return { user };
  },
  async signOut() { await delay(100); localStorage.removeItem(LS_SESSION); },
  async getCurrentUser() {
    const id = localStorage.getItem(LS_SESSION);
    if (!id) return null;
    return loadDB().users.find((u) => u.id === id) || null;
  },

  /* ---------------- PRODUCTS ---------------- */
  async getProducts(ownerId) {
    await delay();
    return loadDB().products.filter((p) => p.ownerId === ownerId).sort((a, b) => a.name.localeCompare(b.name));
  },
  async addProduct(product) {
    await delay();
    const db = loadDB();
    const p = { id: uid('p'), createdAt: new Date().toISOString(), ...product };
    db.products.push(p);
    saveDB(db);
    return p;
  },
  async updateProduct(productId, patch) {
    await delay();
    const db = loadDB();
    const p = db.products.find((x) => x.id === productId);
    if (p) Object.assign(p, patch);
    saveDB(db);
    return p;
  },
  async adjustStock(productId, delta) {
    await delay();
    const db = loadDB();
    const p = db.products.find((x) => x.id === productId);
    if (p) p.quantity = Math.max(0, p.quantity + delta);
    saveDB(db);
    return p;
  },
  async deleteProduct(productId) {
    await delay();
    const db = loadDB();
    db.products = db.products.filter((p) => p.id !== productId);
    saveDB(db);
  },

  /* ---------------- SALES ---------------- */
  async recordSale({ ownerId, productId, quantity, unitPrice, channel }) {
    await delay();
    const db = loadDB();
    const product = db.products.find((p) => p.id === productId);
    if (!product) throw new Error('Товар не найден.');
    if (product.quantity < quantity) throw new Error(`На складе только ${product.quantity} шт.`);
    product.quantity -= quantity;
    const sale = { id: uid('s'), ownerId, productId, quantity, unitPrice, channel, createdAt: new Date().toISOString() };
    db.sales.push(sale);
    saveDB(db);
    return sale;
  },
  async getSales(ownerId) {
    await delay();
    const db = loadDB();
    return db.sales
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((s) => ({ ...s, product: db.products.find((p) => p.id === s.productId) }));
  },

  /* ---------------- DASHBOARD ---------------- */
  async getDashboardStats(ownerId) {
    await delay();
    const db = loadDB();
    const products = db.products.filter((p) => p.ownerId === ownerId);
    const sales = db.sales.filter((s) => s.ownerId === ownerId);
    const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
    const todaySales = sales.filter((s) => isToday(s.createdAt));
    const revenueToday = todaySales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
    const revenueTotal = sales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
    const lowStock = products.filter((p) => p.quantity <= p.lowStockThreshold);
    const stockValue = products.reduce((sum, p) => sum + p.quantity * p.cost, 0);
    return {
      revenueToday, ordersToday: todaySales.length, revenueTotal,
      productsCount: products.length, lowStock, stockValue,
      recentSales: sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
        .map((s) => ({ ...s, product: products.find((p) => p.id === s.productId) })),
    };
  },

  /* ---------------- TELEGRAM / PLAN ---------------- */
  async updateProfile(ownerId, patch) {
    await delay();
    const db = loadDB();
    const u = db.users.find((x) => x.id === ownerId);
    if (u) Object.assign(u, patch);
    saveDB(db);
    return u;
  },
  async saveTelegramSettings(ownerId, { botToken, chatId }) {
    await delay();
    const db = loadDB();
    const u = db.users.find((x) => x.id === ownerId);
    if (u) { u.telegramBotToken = botToken; u.telegramChatId = chatId; }
    saveDB(db);
    return u;
  },
  async updatePlan(ownerId, plan) {
    await delay();
    const db = loadDB();
    const u = db.users.find((x) => x.id === ownerId);
    if (u) u.plan = plan;
    saveDB(db);
    return u;
  },
};

const DEMO_ACCOUNT = { email: 'demo@shop.uz', password: '123456' };
