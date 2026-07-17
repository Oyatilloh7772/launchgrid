/* =========================================================================
   app.js — общая логика для всех страниц
   ========================================================================= */

const PLAN_META = {
  free: { label: 'Free', badge: 'badge-info' },
  business: { label: 'Business', badge: 'badge-ok' },
};

const CHANNEL_META = {
  instagram: { label: 'Instagram', badge: 'badge-danger' },
  telegram: { label: 'Telegram', badge: 'badge-info' },
  direct: { label: 'Напрямую', badge: 'badge-ok' },
  other: { label: 'Другое', badge: 'badge-warn' },
};

function initials(name = '?') { return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(); }
function thumbStyle(seed = '') {
  const colors = ['#33613F', '#C1442C', '#C98A1E', '#34557A', '#7A4F8C'];
  let h = 0; for (const c of seed) h += c.charCodeAt(0);
  const bg = colors[h % colors.length];
  return `background:${bg}1F; color:${bg}; border:1px solid ${bg}55;`;
}
function formatMoney(n) { return `${Math.round(Number(n || 0)).toLocaleString('ru-RU')} сум`; }
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? 'только что' : `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}
function stockBadge(p) {
  if (p.quantity <= 0) return `<span class="badge badge-danger"><span class="badge-dot"></span>Нет в наличии</span>`;
  if (p.quantity <= p.lowStockThreshold) return `<span class="badge badge-warn"><span class="badge-dot"></span>Мало на складе</span>`;
  return `<span class="badge badge-ok"><span class="badge-dot"></span>В наличии</span>`;
}
function stockBarColor(p) {
  if (p.quantity <= 0) return 'var(--red)';
  if (p.quantity <= p.lowStockThreshold) return 'var(--amber)';
  return 'var(--green)';
}

/* ---------------- Toasts ---------------- */
function ensureToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
  return stack;
}
function showToast(message, type = 'default') {
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 200); }, 3200);
}

/* ---------------- Nav ---------------- */
async function renderNav(activePage = '') {
  const mount = document.getElementById('nav-mount');
  if (!mount) return null;
  const user = await getCurrentUser();

  const links = user ? [
    { href: 'dashboard.html', label: 'Дашборд', key: 'dashboard' },
    { href: 'inventory.html', label: 'Склад', key: 'inventory' },
    { href: 'sales.html', label: 'Продажи', key: 'sales' },
    { href: 'telegram.html', label: 'Telegram-бот', key: 'telegram' },
    { href: 'settings.html', label: 'Настройки', key: 'settings' },
  ] : [];

  const linksHTML = links.map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`).join('');

  const actionsHTML = user
    ? `<span class="chip">${user.businessName}</span>
       <span class="badge ${PLAN_META[user.plan].badge}"><span class="badge-dot"></span>${PLAN_META[user.plan].label}</span>
       <button class="btn btn-ghost btn-sm" id="logout-btn">Выйти</button>`
    : `<a href="auth.html" class="btn btn-ghost btn-sm">Войти</a>
       <a href="auth.html?mode=signup" class="btn btn-primary btn-sm">Начать бесплатно</a>`;

  mount.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <a href="${user ? 'dashboard.html' : 'index.html'}" class="brand"><span class="brand-mark">L</span>LaunchGrid</a>
        <div class="nav-links" id="nav-links">${linksHTML}</div>
        <div class="nav-actions">${actionsHTML}</div>
        <button class="nav-toggle" id="nav-toggle" aria-label="Меню">☰</button>
      </div>
    </nav>`;

  document.getElementById('nav-toggle')?.addEventListener('click', () => document.getElementById('nav-links').classList.toggle('open'));
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await signOut();
    showToast('Вы вышли из аккаунта');
    setTimeout(() => (window.location.href = 'index.html'), 400);
  });

  return user;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'auth.html'; return null; }
  return user;
}

/** Рендерит панель вкладок (используется на нескольких страницах). */
function tabbarHTML(tabs) {
  return `<div class="tabbar">${tabs.map((t, i) => `<button class="tabbtn ${i === 0 ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}</div>`;
}
function wireTabs(root) {
  root.querySelectorAll('.tabbtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tabbtn').forEach((b) => b.classList.remove('active'));
      root.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      root.querySelector(`.tabpanel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
    });
  });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
