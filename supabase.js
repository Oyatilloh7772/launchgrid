/* =========================================================================
   supabase.js
   Подключение к Supabase + описание backend-функций для LaunchGrid
   (учёт остатков и продаж). USE_MOCKS = true — всё работает через
   localStorage (js/mock-data.js). Для реального бэкенда:
     1) Подключите <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     2) Впишите SUPABASE_URL / SUPABASE_ANON_KEY.
     3) USE_MOCKS = false.
     4) Выполните SQL-схему внизу файла в SQL Editor проекта.
   ========================================================================= */

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY';
const USE_MOCKS = true;

let supabaseClient = null;
if (!USE_MOCKS && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* -------------------------------------------------------------------------
   AUTH
   ------------------------------------------------------------------------- */

/** Регистрация владельца бизнеса. */
async function signUp({ email, password, businessName }) {
  if (USE_MOCKS) return MockDB.signUp({ email, password, businessName });

  const { data: authData, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;

  const { error: profileError } = await supabaseClient.from('profiles').insert({
    id: authData.user.id,
    business_name: businessName,
    plan: 'free',
  });
  if (profileError) throw profileError;
  return authData;
}

async function signIn({ email, password }) {
  if (USE_MOCKS) return MockDB.signIn({ email, password });
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  if (USE_MOCKS) return MockDB.signOut();
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  if (USE_MOCKS) return MockDB.getCurrentUser();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------
   ТОВАРЫ (products)
   ------------------------------------------------------------------------- */

async function getProducts(ownerId) {
  if (USE_MOCKS) return MockDB.getProducts(ownerId);
  const { data, error } = await supabaseClient.from('products').select('*').eq('owner_id', ownerId).order('name');
  if (error) throw error;
  return data;
}

/** Добавить товар: { ownerId, name, category, price, cost, quantity, lowStockThreshold } */
async function addProduct(product) {
  if (USE_MOCKS) return MockDB.addProduct(product);
  const { data, error } = await supabaseClient.from('products').insert(product).select().single();
  if (error) throw error;
  return data;
}

async function updateProduct(productId, patch) {
  if (USE_MOCKS) return MockDB.updateProduct(productId, patch);
  const { error } = await supabaseClient.from('products').update(patch).eq('id', productId);
  if (error) throw error;
}

/** Ручная корректировка остатка (+/- delta), например пересчёт после инвентаризации. */
async function adjustStock(productId, delta) {
  if (USE_MOCKS) return MockDB.adjustStock(productId, delta);
  const { error } = await supabaseClient.rpc('adjust_stock', { p_product_id: productId, p_delta: delta });
  if (error) throw error;
}

async function deleteProduct(productId) {
  if (USE_MOCKS) return MockDB.deleteProduct(productId);
  const { error } = await supabaseClient.from('products').delete().eq('id', productId);
  if (error) throw error;
}

/* -------------------------------------------------------------------------
   ПРОДАЖИ (sales) — списывают остаток автоматически
   ------------------------------------------------------------------------- */

/** Зафиксировать продажу: { ownerId, productId, quantity, unitPrice, channel } */
async function recordSale(sale) {
  if (USE_MOCKS) return MockDB.recordSale(sale);
  // На реальном бэкенде уменьшение остатка и запись продажи стоит завернуть
  // в Postgres-функцию (RPC), чтобы это было атомарно:
  const { data, error } = await supabaseClient.rpc('record_sale', {
    p_owner_id: sale.ownerId,
    p_product_id: sale.productId,
    p_quantity: sale.quantity,
    p_unit_price: sale.unitPrice,
    p_channel: sale.channel,
  });
  if (error) throw error;
  return data;
}

async function getSales(ownerId) {
  if (USE_MOCKS) return MockDB.getSales(ownerId);
  const { data, error } = await supabaseClient
    .from('sales').select('*, products(name)').eq('owner_id', ownerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------
   СТАТИСТИКА ДЛЯ ДАШБОРДА
   ------------------------------------------------------------------------- */

async function getDashboardStats(ownerId) {
  if (USE_MOCKS) return MockDB.getDashboardStats(ownerId);
  // На реальном бэкенде — Postgres view или несколько агрегирующих запросов.
  const { data, error } = await supabaseClient.rpc('get_dashboard_stats', { p_owner_id: ownerId });
  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------
   TELEGRAM-БОТ
   ------------------------------------------------------------------------- */

/** Сохранить токен бота и chat_id владельца (для уведомлений и команд). */
async function saveTelegramSettings(ownerId, { botToken, chatId }) {
  if (USE_MOCKS) return MockDB.saveTelegramSettings(ownerId, { botToken, chatId });
  const { error } = await supabaseClient.from('profiles').update({ telegram_bot_token: botToken, telegram_chat_id: chatId }).eq('id', ownerId);
  if (error) throw error;
}

/** Обновить профиль бизнеса (например, название). */
async function updateBusinessProfile(ownerId, patch) {
  if (USE_MOCKS) return MockDB.updateProfile(ownerId, patch);
  const { error } = await supabaseClient.from('profiles').update(patch).eq('id', ownerId);
  if (error) throw error;
}

/* -------------------------------------------------------------------------
   ПОДПИСКА
   ------------------------------------------------------------------------- */

async function updatePlan(ownerId, plan) {
  if (USE_MOCKS) return MockDB.updatePlan(ownerId, plan);
  const { error } = await supabaseClient.from('profiles').update({ plan }).eq('id', ownerId);
  if (error) throw error;
}

/* =========================================================================
   SQL-СХЕМА ДЛЯ SUPABASE (SQL Editor)
   -------------------------------------------------------------------------
   create table profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     business_name text,
     plan text default 'free', -- free | business
     telegram_bot_token text,
     telegram_chat_id text,
     created_at timestamp default now()
   );

   create table products (
     id uuid primary key default gen_random_uuid(),
     owner_id uuid references profiles(id) on delete cascade,
     name text not null,
     category text,
     price numeric default 0,
     cost numeric default 0,
     quantity integer default 0,
     low_stock_threshold integer default 5,
     created_at timestamp default now()
   );

   create table sales (
     id uuid primary key default gen_random_uuid(),
     owner_id uuid references profiles(id) on delete cascade,
     product_id uuid references products(id),
     quantity integer not null,
     unit_price numeric not null,
     channel text default 'direct', -- instagram | telegram | direct | other
     created_at timestamp default now()
   );

   -- Атомарная запись продажи + списание остатка
   create or replace function record_sale(
     p_owner_id uuid, p_product_id uuid, p_quantity int, p_unit_price numeric, p_channel text
   ) returns sales as $$
   declare v_sale sales;
   begin
     update products set quantity = quantity - p_quantity
       where id = p_product_id and owner_id = p_owner_id;
     insert into sales(owner_id, product_id, quantity, unit_price, channel)
       values (p_owner_id, p_product_id, p_quantity, p_unit_price, p_channel)
       returning * into v_sale;
     return v_sale;
   end; $$ language plpgsql security definer;

   create or replace function adjust_stock(p_product_id uuid, p_delta int) returns void as $$
   begin
     update products set quantity = quantity + p_delta where id = p_product_id;
   end; $$ language plpgsql security definer;

   alter table profiles enable row level security;
   alter table products enable row level security;
   alter table sales enable row level security;
   create policy "own profile" on profiles for all using (auth.uid() = id);
   create policy "own products" on products for all using (auth.uid() = owner_id);
   create policy "own sales" on sales for all using (auth.uid() = owner_id);
   ========================================================================= */

/* =========================================================================
   TELEGRAM-БОТ: пример webhook-обработчика (Supabase Edge Function, Deno)
   Разверните это отдельно как Edge Function и укажите её URL как webhook
   бота через Telegram Bot API (setWebhook). Показывает, как бот читает/
   пишет в те же таблицы, что и веб-интерфейс — данные синхронны везде.
   -------------------------------------------------------------------------
   // supabase/functions/telegram-webhook/index.ts
   import { serve } from "https://deno.land/std/http/server.ts";
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

   const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

   serve(async (req) => {
     const update = await req.json();
     const text = update.message?.text ?? "";
     const chatId = update.message?.chat.id;

     if (text === "/stock") {
       const { data: profile } = await supabase.from("profiles").select("id").eq("telegram_chat_id", chatId).single();
       const { data: products } = await supabase.from("products").select("name, quantity").eq("owner_id", profile.id);
       const reply = products.map(p => `${p.name}: ${p.quantity} шт.`).join("\n");
       await sendMessage(chatId, reply || "Товаров пока нет.");
     }
     // /sale <товар> <кол-во> <цена> — записывает продажу так же, как форма на sales.html
     return new Response("ok");
   });

   async function sendMessage(chatId, text) {
     const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
     await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
       method: "POST", headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ chat_id: chatId, text }),
     });
   }
   ========================================================================= */
