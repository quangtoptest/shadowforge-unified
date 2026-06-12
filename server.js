// ╔══════════════════════════════════════════════════════════════╗
// ║     ShadowForge Unified Server                              ║
// ║     License API + Telegram Bot + Admin Panel + Mini App     ║
// ║     Deploy-ready for Render.com free tier                   ║
// ╚══════════════════════════════════════════════════════════════╝

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ═══════════════════════════════════════════════════════════════
// CONFIG (from env or defaults)
// ═══════════════════════════════════════════════════════════════
const PORT        = process.env.PORT        || 3000;
const HOST        = process.env.HOST        || '0.0.0.0';
const BOT_TOKEN   = process.env.BOT_TOKEN   || '8748609846:AAFS9n154QJZvvKIfW3zJlcdDo07OE16Z-o';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const PUBLIC_URL  = process.env.PUBLIC_URL  || `http://localhost:${PORT}`;
const KEEPALIVE_URL = process.env.KEEPALIVE_URL || ''; // URL của chính nó trên Render để ping

// Payment config — sửa lại cho đúng thông tin anh
const PAYMENT_CONFIG = {
  bankName: process.env.BANK_NAME    || 'MB Bank',
  accountNumber: process.env.BANK_ACC || '0123456789',
  accountName: process.env.BANK_OWNER || 'NGUYEN MINH QUANG',
  momoNumber: process.env.MOMO_NUM   || '0123456789',
  momoName: process.env.MOMO_NAME    || 'NGUYEN MINH QUANG',
};

// Products
const PRODUCTS = {
  basic:    { name: '⚡ ShadowForge Basic',     desc: '1 máy, key vĩnh viễn',              price: 50000,  maxActivations: 1,  expiresDays: null },
  pro:      { name: '🔥 ShadowForge Pro',       desc: '3 máy, key vĩnh viễn',              price: 120000, maxActivations: 3,  expiresDays: null },
  ultimate: { name: '👑 ShadowForge Ultimate',  desc: 'Không giới hạn máy, key vĩnh viễn', price: 300000, maxActivations: 99, expiresDays: null },
  monthly:  { name: '📅 ShadowForge Monthly',    desc: '1 máy, 30 ngày',                    price: 25000,  maxActivations: 1,  expiresDays: 30 },
};

// ═══════════════════════════════════════════════════════════════
// DATABASE (sql.js)
// ═══════════════════════════════════════════════════════════════
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'shadowforge.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Opened existing database');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new in-memory database');
  }

  db.run(`CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    hwid TEXT,
    customer_name TEXT,
    email TEXT,
    max_activations INTEGER DEFAULT 1,
    activation_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    is_banned INTEGER DEFAULT 0,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL,
    hwid TEXT NOT NULL,
    machine_name TEXT,
    ip_address TEXT,
    vscode_version TEXT,
    activated_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (license_key) REFERENCES licenses(license_key)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  const defaultAdminHash = crypto.createHash('sha256').update('shadowforge2024').digest('hex');
  db.run(`INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES ('admin', '${defaultAdminHash}')`);

  saveDB();
  console.log('[DB] Initialized');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// SQL helpers
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function generateKey(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `SHADOW-${result.slice(0,5)}-${result.slice(5,10)}-${result.slice(10,15)}-${result.slice(15,20)}`;
}

function generateHWID(vscodeMachineId, username, hostname) {
  return crypto.createHash('sha256').update(`${vscodeMachineId}:${username}:${hostname}`).digest('hex').slice(0, 32);
}

function generateOrderId() {
  return 'SF-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function log(level, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}]`, ...args);
}

// ═══════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized - No token' });

  const [username, hash] = token.split(':');
  const row = dbGet('SELECT password_hash FROM admin_users WHERE username = ?', [username]);
  if (!row) return res.status(401).json({ error: 'Unauthorized - Invalid credentials' });

  const expectedHash = crypto.createHash('sha256').update(`${username}:${row.password_hash}:shadowforge`).digest('hex');
  if (hash !== expectedHash) return res.status(401).json({ error: 'Unauthorized - Invalid token' });

  next();
}

// ═══════════════════════════════════════════════════════════════
// === LICENSE SERVER API ===
// ═══════════════════════════════════════════════════════════════

// Admin: Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const row = dbGet('SELECT * FROM admin_users WHERE username = ?', [username]);
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== row.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

  const tokenHash = crypto.createHash('sha256').update(`${username}:${row.password_hash}:shadowforge`).digest('hex');
  log('INFO', `Admin login: ${username}`);
  res.json({ success: true, token: `${username}:${tokenHash}` });
});

// Admin: Generate Keys
app.post('/api/admin/genkeys', authMiddleware, (req, res) => {
  const { count = 1, customer_name, email, max_activations = 1, expires_days, notes } = req.body;
  if (count < 1 || count > 100) return res.status(400).json({ error: 'Count must be between 1 and 100' });

  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 86400000).toISOString().split('T')[0]
    : null;

  const keys = [];
  for (let i = 0; i < count; i++) {
    const key = generateKey();
    dbRun(
      'INSERT INTO licenses (license_key, customer_name, email, max_activations, expires_at, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [key, customer_name || null, email || null, max_activations, expires_at, notes || null]
    );
    keys.push(key);
  }

  log('INFO', `Generated ${count} key(s) for ${customer_name || 'unknown'}`);
  res.json({ success: true, keys });
});

// Admin: List Keys
app.get('/api/admin/keys', authMiddleware, (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query;
  const offset = (page - 1) * limit;

  let rows;
  if (search) {
    rows = dbAll(
      `SELECT l.*, (SELECT COUNT(*) FROM activations a WHERE a.license_key = l.license_key AND a.is_active = 1) as active_activations
       FROM licenses l WHERE l.license_key LIKE ? OR l.customer_name LIKE ? OR l.email LIKE ?
       ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset]
    );
  } else {
    rows = dbAll(
      `SELECT l.*, (SELECT COUNT(*) FROM activations a WHERE a.license_key = l.license_key AND a.is_active = 1) as active_activations
       FROM licenses l ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  const total = dbGet('SELECT COUNT(*) as count FROM licenses').count;
  res.json({ success: true, keys: rows, total, page: Number(page), totalPages: Math.ceil(total / limit) });
});

// Admin: Delete Key
app.delete('/api/admin/keys/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const before = dbGet('SELECT * FROM licenses WHERE license_key = ?', [key]);
  if (!before) return res.status(404).json({ error: 'Key not found' });

  dbRun('DELETE FROM licenses WHERE license_key = ?', [key]);
  dbRun('DELETE FROM activations WHERE license_key = ?', [key]);
  log('INFO', `Deleted key: ${key}`);
  res.json({ success: true });
});

// Admin: Ban/Unban Key
app.post('/api/admin/keys/:key/toggle', authMiddleware, (req, res) => {
  const { key } = req.params;
  const row = dbGet('SELECT is_banned FROM licenses WHERE license_key = ?', [key]);
  if (!row) return res.status(404).json({ error: 'Key not found' });

  const newStatus = row.is_banned ? 0 : 1;
  dbRun('UPDATE licenses SET is_banned = ? WHERE license_key = ?', [newStatus, key]);
  log('INFO', `${newStatus ? 'Banned' : 'Unbanned'} key: ${key}`);
  res.json({ success: true, is_banned: newStatus });
});

// Admin: Reset HWID
app.post('/api/admin/keys/:key/reset', authMiddleware, (req, res) => {
  const { key } = req.params;
  dbRun('UPDATE licenses SET activation_count = 0 WHERE license_key = ?', [key]);
  dbRun('UPDATE activations SET is_active = 0 WHERE license_key = ?', [key]);
  log('INFO', `Reset HWID for key: ${key}`);
  res.json({ success: true });
});

// Admin: Stats
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const totalKeys = dbGet('SELECT COUNT(*) as count FROM licenses').count;
  const activeKeys = dbGet('SELECT COUNT(*) as count FROM licenses WHERE is_active = 1 AND is_banned = 0').count;
  const totalActivations = dbGet('SELECT COUNT(*) as count FROM activations WHERE is_active = 1').count;
  const bannedKeys = dbGet('SELECT COUNT(*) as count FROM licenses WHERE is_banned = 1').count;
  res.json({ success: true, stats: { totalKeys, activeKeys, totalActivations, bannedKeys } });
});

// Client: Activate License
app.post('/api/activate', (req, res) => {
  const { license_key, hwid_raw, machine_name, vscode_version } = req.body;

  if (!license_key || !hwid_raw) {
    return res.status(400).json({ error: 'Missing license_key or hwid', success: false });
  }

  const hwidData = typeof hwid_raw === 'object' ? hwid_raw : { machineId: hwid_raw, username: '', hostname: '' };
  const hwid = generateHWID(hwidData.machineId || hwid_raw, hwidData.username || '', hwidData.hostname || '');

  const lic = dbGet('SELECT * FROM licenses WHERE license_key = ?', [license_key]);
  if (!lic) {
    log('WARN', `Activation failed - unknown key: ${license_key}`);
    return res.status(403).json({ error: 'Invalid license key', success: false });
  }

  if (lic.is_banned) {
    log('WARN', `Activation failed - banned key: ${license_key}`);
    return res.status(403).json({ error: 'License key has been banned', success: false });
  }

  if (!lic.is_active) {
    log('WARN', `Activation failed - inactive key: ${license_key}`);
    return res.status(403).json({ error: 'License key is inactive', success: false });
  }

  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    log('WARN', `Activation failed - expired key: ${license_key}`);
    return res.status(403).json({ error: 'License key has expired', success: false });
  }

  const existing = dbGet('SELECT * FROM activations WHERE license_key = ? AND hwid = ? AND is_active = 1', [license_key, hwid]);
  if (existing) {
    dbRun('UPDATE activations SET last_seen = datetime(\'now\'), vscode_version = ? WHERE id = ?', [vscode_version || null, existing.id]);
    log('INFO', `Existing activation: ${license_key} (${hwid.slice(0, 8)}...)`);
    return res.json({ success: true, status: 'already_activated' });
  }

  if (lic.activation_count >= lic.max_activations) {
    log('WARN', `Activation failed - max activations reached: ${license_key}`);
    return res.status(403).json({ error: 'Maximum activations reached for this key', success: false });
  }

  dbRun(
    'INSERT INTO activations (license_key, hwid, machine_name, ip_address, vscode_version) VALUES (?, ?, ?, ?, ?)',
    [license_key, hwid, machine_name || null, req.ip || null, vscode_version || null]
  );
  dbRun('UPDATE licenses SET activation_count = activation_count + 1 WHERE license_key = ?', [license_key]);
  log('INFO', `Activated: ${license_key} -> ${hwid.slice(0, 8)}... (${lic.customer_name || 'unknown'})`);
  res.json({ success: true, status: 'activated' });
});

// Client: Heartbeat / Validate
app.post('/api/heartbeat', (req, res) => {
  const { license_key, hwid_raw } = req.body;
  if (!license_key) return res.status(400).json({ success: false, error: 'Missing license_key' });

  const hwidData = hwid_raw ? (typeof hwid_raw === 'object' ? hwid_raw : { machineId: hwid_raw, username: '', hostname: '' }) : null;
  const hwid = hwidData ? generateHWID(hwidData.machineId || hwid_raw, hwidData.username || '', hwidData.hostname || '') : null;

  const lic = dbGet('SELECT * FROM licenses WHERE license_key = ?', [license_key]);
  if (!lic || lic.is_banned || !lic.is_active) {
    return res.json({ success: false, valid: false, reason: 'invalid_or_banned' });
  }

  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    return res.json({ success: false, valid: false, reason: 'expired' });
  }

  if (hwid) {
    const activation = dbGet('SELECT * FROM activations WHERE license_key = ? AND hwid = ? AND is_active = 1', [license_key, hwid]);
    if (!activation) {
      return res.json({ success: false, valid: false, reason: 'hwid_mismatch' });
    }
    dbRun('UPDATE activations SET last_seen = datetime(\'now\') WHERE id = ?', [activation.id]);
  }

  res.json({ success: true, valid: true });
});

// ═══════════════════════════════════════════════════════════════
// === TELEGRAM BOT ===
// ═══════════════════════════════════════════════════════════════
let bot = null;
let pendingOrders = {};

function initBot() {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('[BOT] No valid BOT_TOKEN, bot disabled');
    return;
  }

  bot = new Telegraf(BOT_TOKEN);

  bot.start(async (ctx) => {
    const name = ctx.from.first_name || 'bạn';
    await ctx.reply(
      `👋 *Chào ${name}!*\nChào mừng đến với *ShadowForge Key Store* 🔐\n\n` +
      `🚀 Mua license key cho VS Code Extension ShadowForge.\n\n👇 Chọn lệnh bên dưới để bắt đầu:`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([['🛒 Mua Key', '💰 Bảng Giá'], ['📱 Mini App', '❓ Hỗ Trợ']]).resize(),
      }
    );
  });

  bot.hears('💰 Bảng Giá', (ctx) => {
    let msg = '*📊 BẢNG GIÁ SHADOWFORGE*\n\n';
    for (const [id, p] of Object.entries(PRODUCTS)) {
      msg += `*${p.name}*\n  └ ${p.desc}\n  └ 💵 *${formatPrice(p.price)}*\n\n`;
    }
    msg += '\n👉 Gõ /buy để mua ngay!';
    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.hears('🛒 Mua Key', (ctx) => ctx.reply('Chọn gói bạn muốn mua:', buildProductKeyboard()));
  bot.command('buy', (ctx) => ctx.reply('Chọn gói bạn muốn mua:', buildProductKeyboard()));

  bot.hears('📱 Mini App', (ctx) => {
    ctx.reply('🚀 *Mở Mini App Shop*\n\nNhấn nút bên dưới để mở cửa hàng!', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍️ Mở Shop ShadowForge', `${PUBLIC_URL}/mini-app`)],
      ]),
    });
  });

  bot.hears('❓ Hỗ Trợ', (ctx) => {
    ctx.reply(
      '*📞 HỖ TRỢ*\n\n• Cài Extension: Cài file .vsix vào VS Code\n• Kích hoạt: ShadowForge: Activate License\n• Mất key: Nhắn admin để reset HWID\n\n👤 *Admin:* @MinhQuang',
      { parse_mode: 'Markdown' }
    );
  });

  // Product selection
  function buildProductKeyboard() {
    return Markup.inlineKeyboard(
      Object.entries(PRODUCTS).map(([id, p]) => [
        Markup.button.callback(`${p.name} - ${formatPrice(p.price)}`, `buy_${id}`),
      ])
    );
  }

  bot.action(/buy_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = PRODUCTS[productId];
    if (!product) return ctx.answerCbQuery('Sản phẩm không tồn tại');
    await ctx.answerCbQuery();

    const orderId = generateOrderId();
    let msg = `*🧾 ĐƠN HÀNG #${orderId}*\n\n`;
    msg += `*Sản phẩm:* ${product.name}\n*Mô tả:* ${product.desc}\n*Số tiền:* ${formatPrice(product.price)}\n\n`;
    msg += `━━━━━━━━━━━━━━━━\n*💳 THANH TOÁN QUA:*\n\n`;
    msg += `🏦 *Ngân hàng:* ${PAYMENT_CONFIG.bankName}\n📋 *STK:* \`${PAYMENT_CONFIG.accountNumber}\`\n👤 *Chủ TK:* ${PAYMENT_CONFIG.accountName}\n\n`;
    msg += `📱 *MoMo:* \`${PAYMENT_CONFIG.momoNumber}\`\n👤 *Tên:* ${PAYMENT_CONFIG.momoName}\n\n`;
    msg += `━━━━━━━━━━━━━━━━\n💰 *Nội dung CK:* \`SF ${orderId}\`\n\n`;
    msg += `⚠️ *Sau khi chuyển khoản*, gõ:\n\`/paid ${orderId} ${productId}\`\nđể nhận key tự động!`;

    pendingOrders[orderId] = {
      productId, customerName: ctx.from.first_name || 'Unknown',
      userId: ctx.from.id, createdAt: Date.now(),
    };

    await ctx.reply(msg, { parse_mode: 'Markdown' });

    if (ADMIN_CHAT_ID) {
      bot.telegram.sendMessage(ADMIN_CHAT_ID,
        `🔔 *Đơn hàng mới!*\nOrder: #${orderId}\nSP: ${product.name}\nKhách: ${ctx.from.first_name}\nGiá: ${formatPrice(product.price)}`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // /paid command
  bot.command('paid', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const orderId = args[1];
    const productId = args[2];

    if (!orderId || !productId) {
      return ctx.reply('⚠️ *Cách dùng:*\n`/paid [mã đơn] [gói]`\nVí dụ: `/paid SF-AB12CD34 basic`\nCác gói: basic, pro, ultimate, monthly', { parse_mode: 'Markdown' });
    }
    if (!PRODUCTS[productId]) return ctx.reply('❌ Gói không hợp lệ.');

    await ctx.reply('⏳ Đang xử lý đơn hàng...');

    try {
      const key = generateKey();
      const product = PRODUCTS[productId];
      dbRun(
        'INSERT INTO licenses (license_key, customer_name, max_activations, expires_at) VALUES (?, ?, ?, ?)',
        [key, ctx.from.first_name || 'Telegram User', product.maxActivations, product.expiresDays ? new Date(Date.now() + product.expiresDays * 86400000).toISOString().split('T')[0] : null]
      );

      await ctx.reply(
        `✅ *THANH TOÁN THÀNH CÔNG!*\n\n🎉 Cảm ơn bạn đã mua *${product.name}*\n\n🔑 *License Key:*\n\`${key}\`\n\n📥 Cài .vsix → Ctrl+Shift+P → ShadowForge: Activate License → Dán key`,
        { parse_mode: 'Markdown' }
      );
      log('INFO', `Bot sold key: ${key} to ${ctx.from.first_name}`);
    } catch (e) {
      console.error('Key gen error:', e);
      ctx.reply('❌ Lỗi tạo key, liên hệ admin: @MinhQuang', { parse_mode: 'Markdown' });
    }
  });

  // Admin commands
  bot.command('stats', async (ctx) => {
    const tk = dbGet('SELECT COUNT(*) as count FROM licenses').count;
    const ak = dbGet('SELECT COUNT(*) as count FROM licenses WHERE is_active=1 AND is_banned=0').count;
    const ta = dbGet('SELECT COUNT(*) as count FROM activations WHERE is_active=1').count;
    ctx.reply(`📊 *THỐNG KÊ*\n🔑 Tổng: ${tk}\n✅ Active: ${ak}\n💻 Activated: ${ta}`, { parse_mode: 'Markdown' });
  });

  // Use webhook mode for Render (no polling)
  if (process.env.RENDER) {
    // Webhook endpoint
    app.use(bot.webhookCallback('/telegram'));
    console.log('[BOT] Using webhook mode for Render');
  } else {
    // Polling mode for local dev
    bot.launch().then(() => console.log('[BOT] Using polling mode (local dev)'));
  }

  process.once('SIGINT', () => bot && bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot && bot.stop('SIGTERM'));
}

// ═══════════════════════════════════════════════════════════════
// === MINI APP API (for Mini App web UI) ===
// ═══════════════════════════════════════════════════════════════

// API create order from Mini App
app.post('/api/create-order', async (req, res) => {
  const { productId, customerName } = req.body;
  if (!productId || !PRODUCTS[productId]) return res.status(400).json({ error: 'Invalid product' });

  try {
    const key = generateKey();
    const product = PRODUCTS[productId];
    dbRun(
      'INSERT INTO licenses (license_key, customer_name, max_activations, expires_at) VALUES (?, ?, ?, ?)',
      [key, customerName || 'Mini App User', product.maxActivations, product.expiresDays ? new Date(Date.now() + product.expiresDays * 86400000).toISOString().split('T')[0] : null]
    );
    const orderId = generateOrderId();
    log('INFO', `MiniApp sold key: ${key}`);
    res.json({ success: true, orderId, licenseKey: key, product: product.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// === STATIC FILES ===
// ═══════════════════════════════════════════════════════════════
// Copy admin-panel & mini-app from existing dirs, or use inline
app.get('/admin', (req, res) => res.redirect('/admin/index.html'));
app.use('/admin', express.static(path.join(__dirname, 'admin-panel')));
app.use('/mini-app', express.static(path.join(__dirname, 'mini-app')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ═══════════════════════════════════════════════════════════════
// === KEEP-ALIVE (Anti-sleep for Render free tier) ===
// ═══════════════════════════════════════════════════════════════
function startKeepAlive() {
  if (!KEEPALIVE_URL) return;
  console.log(`[KEEPALIVE] Pinging ${KEEPALIVE_URL}/health every 14 minutes`);
  setInterval(() => {
    fetch(KEEPALIVE_URL + '/health')
      .then(r => r.json())
      .then(d => console.log(`[KEEPALIVE] Ping OK, uptime: ${d.uptime}s`))
      .catch(e => console.log(`[KEEPALIVE] Ping failed: ${e.message}`));
  }, 14 * 60 * 1000); // 14 minutes
}

// ═══════════════════════════════════════════════════════════════
// === START ===
// ═══════════════════════════════════════════════════════════════
async function start() {
  await initDB();
  initBot();
  startKeepAlive();

  app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║       ShadowForge Unified Server v1.0               ║
╠══════════════════════════════════════════════════════╣
║  License API:  http://${HOST}:${PORT}/api/           ║
║  Admin Panel:  http://${HOST}:${PORT}/admin          ║
║  Mini App:     http://${HOST}:${PORT}/mini-app       ║
║  Bot Webhook:  http://${HOST}:${PORT}/telegram       ║
║  Health:       http://${HOST}:${PORT}/health         ║
╚══════════════════════════════════════════════════════╝
`);
  });
}

start();
