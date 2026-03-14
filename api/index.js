const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { neon } = require('@neondatabase/serverless');

// ── DB ────────────────────────────────────────────────────────────────────────
function getDb() {
  return neon(process.env.DATABASE_URL);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
}

function send(res, status, body) {
  res.status(status).json(body);
}

function isOwner(user) {
  if (!user) return false;
  const owner = (process.env.OWNER_USERNAME || '').toLowerCase();
  return owner && user.username.toLowerCase() === owner;
}

async function getUser(req) {
  const header = req.headers?.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev');
    const sql = getDb();
    const rows = await sql`SELECT id, username, email, role, avatar_url, email_verified, is_verified, last_upload_at FROM users WHERE id = ${payload.id}`;
    const user = rows[0] || null;
    if (user) { user.is_owner = isOwner(user); user.is_admin = user.role === 'admin' || user.is_owner; }
    return user;
  } catch { return null; }
}

function signToken(userId, remember = false) {
  return jwt.sign({ id: userId, remember }, process.env.JWT_SECRET || 'dev', { expiresIn: remember ? '30d' : '24h' });
}

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }).toString()
  });
  return (await r.json()).success === true;
}

function isSpam(content, recent = []) {
  const c = content.trim().toLowerCase();
  if (c.length < 2) return true;
  if (recent.some(r => r.toLowerCase() === c)) return true;
  const counts = {};
  for (const ch of c) counts[ch] = (counts[ch] || 0) + 1;
  if (Math.max(...Object.values(counts)) / c.length > 0.6) return true;
  return false;
}

function getRobloxThumb(gameId) {
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${gameId}&width=768&height=432&format=png`;
}

// ── Script enrichment ─────────────────────────────────────────────────────────
async function enrichScript(sql, script, userId) {
  const tags = await sql`SELECT t.id, t.name, t.color FROM tags t JOIN script_tags st ON st.tag_id = t.id WHERE st.script_id = ${script.id}`;
  const [rat] = await sql`SELECT ROUND(AVG(score)::numeric,1) as avg, COUNT(*) as count FROM ratings WHERE script_id = ${script.id}`;
  const [author] = await sql`SELECT id, username, avatar_url, role, is_verified FROM users WHERE id = ${script.author_id}`;
  let thumb = script.thumbnail_url;
  if (!thumb) thumb = script.is_universal ? 'https://images.rbxcdn.com/180dbd9ca59a79f36e014fb40fc23e2d' : script.game_id ? getRobloxThumb(script.game_id) : null;
  let userRating = null, isFavorited = false;
  if (userId) {
    const [r] = await sql`SELECT score FROM ratings WHERE script_id = ${script.id} AND user_id = ${userId}`;
    userRating = r?.score || null;
    const [f] = await sql`SELECT 1 FROM favorites WHERE script_id = ${script.id} AND user_id = ${userId}`;
    isFavorited = !!f;
  }
  return { ...script, thumbnail: thumb, tags, rating: { avg: parseFloat(rat?.avg || 0), count: parseInt(rat?.count || 0) }, author, userRating, isFavorited };
}

// ── DB Migrations ─────────────────────────────────────────────────────────────
async function runMigrations(sql) {
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar_url TEXT, role TEXT DEFAULT 'user' CHECK(role IN ('user','admin','moderator')), bio TEXT, discord TEXT, email_verified BOOLEAN DEFAULT FALSE, is_verified BOOLEAN DEFAULT FALSE, verification_token TEXT, verification_expires BIGINT, last_upload_at BIGINT DEFAULT 0, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires BIGINT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_upload_at BIGINT DEFAULT 0`;
  await sql`CREATE TABLE IF NOT EXISTS scripts (id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, game TEXT, game_id TEXT, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT DEFAULT 'active' CHECK(status IN ('active','patched','outdated','removed')), is_keyless BOOLEAN DEFAULT TRUE, is_universal BOOLEAN DEFAULT FALSE, is_paid BOOLEAN DEFAULT FALSE, is_verified BOOLEAN DEFAULT FALSE, key_link TEXT, thumbnail_url TEXT, views INTEGER DEFAULT 0, downloads INTEGER DEFAULT 0, executor_notes TEXT, version TEXT DEFAULT '1.0.0', created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE scripts ADD COLUMN IF NOT EXISTS key_link TEXT`;
  await sql`ALTER TABLE scripts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS tags (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, color TEXT DEFAULT '#666')`;
  await sql`CREATE TABLE IF NOT EXISTS script_tags (script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (script_id, tag_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ratings (id SERIAL PRIMARY KEY, script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5), created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, UNIQUE(script_id, user_id))`;
  await sql`CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, is_deleted BOOLEAN DEFAULT FALSE, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`;
  await sql`CREATE TABLE IF NOT EXISTS favorites (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, PRIMARY KEY (user_id, script_id))`;
  await sql`CREATE TABLE IF NOT EXISTS view_logs (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, logged_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, PRIMARY KEY (user_id, script_id))`;
  await sql`CREATE TABLE IF NOT EXISTS download_logs (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, logged_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, PRIMARY KEY (user_id, script_id))`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, message TEXT NOT NULL, link TEXT, is_read BOOLEAN DEFAULT FALSE, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`CREATE TABLE IF NOT EXISTS badges (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, label TEXT NOT NULL, color TEXT DEFAULT '#7c6af5', icon TEXT DEFAULT '🏅', description TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS user_badges (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE, granted_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, PRIMARY KEY (user_id, badge_id))`;
  await sql`CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, type TEXT DEFAULT 'info' CHECK(type IN ('info','warning','success','danger')), is_active BOOLEAN DEFAULT TRUE, author_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`CREATE TABLE IF NOT EXISTS blog_posts (id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, excerpt TEXT, content TEXT NOT NULL, cover_url TEXT, author_id INTEGER REFERENCES users(id) ON DELETE SET NULL, published BOOLEAN DEFAULT FALSE, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`CREATE TABLE IF NOT EXISTS executors (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, website_url TEXT, download_url TEXT, logo_url TEXT, is_free BOOLEAN DEFAULT TRUE, unc_score REAL DEFAULT 0, sunc_score REAL DEFAULT 0, platform TEXT DEFAULT 'windows', status TEXT DEFAULT 'active', created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scripts_author ON scripts(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scripts_created ON scripts(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ratings_script ON ratings(script_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`;
  const tagData = [['aimbot','#e74c3c'],['esp','#e67e22'],['autofarm','#2ecc71'],['gui','#3498db'],['trolling','#9b59b6'],['universal','#1abc9c'],['combat','#e74c3c'],['movement','#f39c12'],['keyless','#27ae60'],['paid','#c0392b'],['fps','#e74c3c'],['rpg','#8e44ad'],['simulator','#16a085'],['hub','#2980b9'],['crash','#7f8c8d']];
  for (const [name, color] of tagData) await sql`INSERT INTO tags (name, color) VALUES (${name}, ${color}) ON CONFLICT (name) DO NOTHING`;
  const badgeData = [['early_adopter','Early Adopter','#f59e0b','⭐','Joined during early access'],['scripter','Scripter','#3b82f6','📜','Contributed quality scripts'],['contributor','Contributor','#10b981','🤝','Helped grow the community'],['legend','Legend','#8b5cf6','👑','Community legend'],['bug_hunter','Bug Hunter','#ef4444','🐛','Found and reported bugs']];
  for (const [name, label, color, icon, description] of badgeData) await sql`INSERT INTO badges (name, label, color, icon, description) VALUES (${name}, ${label}, ${color}, ${icon}, ${description}) ON CONFLICT (name) DO NOTHING`;
  return { ok: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const sql = getDb();
    const user = await getUser(req);
    const method = req.method;
    const b = req.body || {};

    // Parse path: /api/auth/login -> ['auth','login']
    const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    // parts[0] = 'api', parts[1] = resource, parts[2..] = rest
    const r0 = parts[1] || '';
    const r1 = parts[2] || '';
    const r2 = parts[3] || '';
    const r3 = parts[4] || '';

    // ── AUTH ────────────────────────────────────────────────────────────────
    if (r0 === 'auth') {
      if (r1 === 'register' && method === 'POST') {
        const { username, email, password, captcha } = b;
        if (!username || !email || !password) return send(res, 400, { error: 'All fields required' });
        if (username.length < 3 || username.length > 20) return send(res, 400, { error: 'Username 3–20 chars' });
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return send(res, 400, { error: 'Username: letters, numbers, underscores only' });
        if (password.length < 6) return send(res, 400, { error: 'Password min 6 chars' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Invalid email' });
        if (!await verifyTurnstile(captcha)) return send(res, 400, { error: 'Captcha failed' });
        const code = generateCode();
        const expires = Math.floor(Date.now() / 1000) + 900;
        try {
          const hash = await bcrypt.hash(password, 10);
          const rows = await sql`INSERT INTO users (username, email, password_hash, verification_token, verification_expires) VALUES (${username.toLowerCase()}, ${email.toLowerCase()}, ${hash}, ${code}, ${expires}) RETURNING id, username, email`;
          return send(res, 201, { message: 'Account created.', userId: rows[0].id, verificationCode: code, expiresIn: 900 });
        } catch (e) {
          if (e.code === '23505' || e.message?.includes('unique') || e.message?.includes('duplicate')) {
            const which = e.constraint?.includes('email') || e.detail?.includes('email') ? 'Email' : 'Username or email';
            return send(res, 409, { error: which + ' is already taken' });
          }
          throw e;
        }
      }

      if (r1 === 'verify' && method === 'POST') {
        const { userId, code } = b;
        if (!userId || !code) return send(res, 400, { error: 'userId and code required' });
        const now = Math.floor(Date.now() / 1000);
        const rows = await sql`SELECT id FROM users WHERE id = ${userId} AND verification_token = ${String(code).trim()} AND verification_expires > ${now} AND email_verified = FALSE`;
        if (!rows[0]) return send(res, 400, { error: 'Invalid or expired code.' });
        await sql`UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ${rows[0].id}`;
        return send(res, 200, { message: 'Account verified. You can now log in.' });
      }

      if (r1 === 'resend-verification' && method === 'POST') {
        const { userId } = b;
        if (!userId) return send(res, 400, { error: 'userId required' });
        const rows = await sql`SELECT id, email_verified FROM users WHERE id = ${userId}`;
        if (!rows[0]) return send(res, 404, { error: 'User not found' });
        if (rows[0].email_verified) return send(res, 400, { error: 'Already verified' });
        const code = generateCode();
        const expires = Math.floor(Date.now() / 1000) + 900;
        await sql`UPDATE users SET verification_token = ${code}, verification_expires = ${expires} WHERE id = ${userId}`;
        return send(res, 200, { verificationCode: code, expiresIn: 900 });
      }

      if (r1 === 'login' && method === 'POST') {
        const { login, password, remember, captcha } = b;
        if (!login || !password) return send(res, 400, { error: 'All fields required' });
        if (!await verifyTurnstile(captcha)) return send(res, 400, { error: 'Captcha failed' });
        const rows = await sql`SELECT * FROM users WHERE username = ${login.toLowerCase()} OR email = ${login.toLowerCase()}`;
        const u = rows[0];
        if (!u) return send(res, 401, { error: 'Invalid credentials' });
        if (!await bcrypt.compare(password, u.password_hash)) return send(res, 401, { error: 'Invalid credentials' });
        if (!u.email_verified) return send(res, 403, { error: 'Account not verified', code: 'NOT_VERIFIED', userId: u.id });
        const { password_hash, verification_token, verification_expires, ...safe } = u;
        const token = signToken(u.id, !!remember);
        return send(res, 200, { user: safe, token, expiresAt: Date.now() + (remember ? 30*86400000 : 86400000) });
      }

      if (r1 === 'me' && method === 'GET') {
        if (!user) return send(res, 401, { error: 'Not authenticated' });
        return send(res, 200, { user });
      }
    }

    // ── SETUP ───────────────────────────────────────────────────────────────
    if (r0 === 'setup') {
      if (method === 'GET') {
        try {
          const rows = await sql`SELECT value FROM settings WHERE key = 'setup_complete'`.catch(() => []);
          return send(res, 200, { complete: rows.length > 0 });
        } catch { return send(res, 200, { complete: false }); }
      }
      if (method === 'POST') {
        const { adminUsername, adminEmail, adminPassword, setupKey } = b;
        if (!adminUsername || !adminEmail || !adminPassword || !setupKey) return send(res, 400, { error: 'All fields required' });
        if (setupKey !== process.env.SETUP_KEY) return send(res, 401, { error: 'Invalid setup key' });
        if (adminPassword.length < 8) return send(res, 400, { error: 'Password min 8 chars' });
        await runMigrations(sql);
        const existing = await sql`SELECT value FROM settings WHERE key = 'setup_complete'`;
        if (existing.length > 0) return send(res, 409, { error: 'Setup already completed.' });
        const hash = await bcrypt.hash(adminPassword, 10);
        await sql`INSERT INTO users (username, email, password_hash, role, bio, email_verified) VALUES (${adminUsername.toLowerCase()}, ${adminEmail.toLowerCase()}, ${hash}, 'admin', 'Site administrator', TRUE) ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = 'admin', email_verified = TRUE`;
        await sql`INSERT INTO settings (key, value) VALUES ('setup_complete', ${new Date().toISOString()}) ON CONFLICT (key) DO NOTHING`;
        return send(res, 200, { ok: true, message: `Setup complete. Admin "${adminUsername}" ready.` });
      }
    }

    // ── DATA (tags, stats, executors) ───────────────────────────────────────
    if (r0 === 'data') {
      if (r1 === 'tags') {
        const tags = await sql`SELECT * FROM tags ORDER BY name`;
        return send(res, 200, { tags });
      }
      if (r1 === 'stats') {
        const [counts] = await sql`SELECT (SELECT COUNT(*)::int FROM scripts WHERE status != 'removed') as scripts, (SELECT COUNT(*)::int FROM users) as users, (SELECT COALESCE(SUM(downloads),0)::int FROM scripts) as downloads, (SELECT COALESCE(SUM(views),0)::int FROM scripts) as views`;
        return send(res, 200, counts);
      }
      if (r1 === 'executors') {
        const executors = await sql`SELECT * FROM executors WHERE status = 'active' ORDER BY unc_score DESC`;
        return send(res, 200, { executors });
      }
    }

    // ── COMMUNITY (announcements, notifications, badges) ────────────────────
    if (r0 === 'community') {
      if (r1 === 'announcements') {
        const id = r2 && !isNaN(parseInt(r2)) ? parseInt(r2) : null;
        if (method === 'GET') {
          const rows = await sql`SELECT a.*, u.username as author_name FROM announcements a LEFT JOIN users u ON u.id = a.author_id WHERE a.is_active = TRUE ORDER BY a.created_at DESC`;
          return send(res, 200, { announcements: rows });
        }
        if (method === 'POST' && !id) {
          if (!user?.is_owner && !user?.is_admin) return send(res, 403, { error: 'Owner only' });
          const { title, content, type } = b;
          if (!title || !content) return send(res, 400, { error: 'Title and content required' });
          const [row] = await sql`INSERT INTO announcements (title, content, type, author_id) VALUES (${title}, ${content}, ${type||'info'}, ${user.id}) RETURNING *`;
          return send(res, 201, { announcement: row });
        }
        if (method === 'PATCH' && id) {
          if (!user?.is_owner && !user?.is_admin) return send(res, 403, { error: 'Owner only' });
          const [row] = await sql`UPDATE announcements SET title = COALESCE(${b.title??null}, title), content = COALESCE(${b.content??null}, content), type = COALESCE(${b.type??null}, type), is_active = COALESCE(${b.is_active??null}, is_active) WHERE id = ${id} RETURNING *`;
          return send(res, 200, { announcement: row });
        }
        if (method === 'DELETE' && id) {
          if (!user?.is_owner && !user?.is_admin) return send(res, 403, { error: 'Owner only' });
          await sql`DELETE FROM announcements WHERE id = ${id}`;
          return send(res, 200, { ok: true });
        }
      }

      if (r1 === 'notifications') {
        if (!user) return send(res, 401, { error: 'Auth required' });
        if (method === 'GET') {
          const notifications = await sql`SELECT * FROM notifications WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`;
          const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE user_id = ${user.id} AND is_read = FALSE`;
          return send(res, 200, { notifications, unread: count });
        }
        if (method === 'PATCH') { await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${user.id}`; return send(res, 200, { ok: true }); }
        if (method === 'DELETE') { await sql`DELETE FROM notifications WHERE user_id = ${user.id}`; return send(res, 200, { ok: true }); }
      }

      if (r1 === 'badges') {
        if (!r2 && method === 'GET') { const badges = await sql`SELECT * FROM badges ORDER BY name`; return send(res, 200, { badges }); }
        if (!r2 && method === 'POST') {
          if (!user?.is_owner) return send(res, 403, { error: 'Owner only' });
          const { name, label, color, icon, description } = b;
          if (!name || !label) return send(res, 400, { error: 'Name and label required' });
          const [badge] = await sql`INSERT INTO badges (name, label, color, icon, description) VALUES (${name}, ${label}, ${color||'#7c6af5'}, ${icon||'🏅'}, ${description||null}) RETURNING *`;
          return send(res, 201, { badge });
        }
        if (r2 === 'grant' && method === 'POST') {
          if (!user?.is_owner && !user?.is_admin) return send(res, 403, { error: 'Owner only' });
          const { username, badge_name } = b;
          const [target] = await sql`SELECT id FROM users WHERE LOWER(username) = ${username?.toLowerCase()}`;
          if (!target) return send(res, 404, { error: 'User not found' });
          const [badge] = await sql`SELECT id, label FROM badges WHERE name = ${badge_name}`;
          if (!badge) return send(res, 404, { error: 'Badge not found' });
          await sql`INSERT INTO user_badges (user_id, badge_id) VALUES (${target.id}, ${badge.id}) ON CONFLICT DO NOTHING`;
          await sql`INSERT INTO notifications (user_id, type, message, link) VALUES (${target.id}, 'badge', ${`You earned the "${badge.label}" badge!`}, ${`/u/${username}`})`;
          return send(res, 200, { ok: true });
        }
        if (r2 === 'revoke' && method === 'POST') {
          if (!user?.is_owner && !user?.is_admin) return send(res, 403, { error: 'Owner only' });
          const { username, badge_name } = b;
          const [target] = await sql`SELECT id FROM users WHERE LOWER(username) = ${username?.toLowerCase()}`;
          const [badge] = await sql`SELECT id FROM badges WHERE name = ${badge_name}`;
          if (!target || !badge) return send(res, 404, { error: 'Not found' });
          await sql`DELETE FROM user_badges WHERE user_id = ${target.id} AND badge_id = ${badge.id}`;
          return send(res, 200, { ok: true });
        }
      }
    }

    // ── USERS ───────────────────────────────────────────────────────────────
    if (r0 === 'users' && r1) {
      const username = r1;
      const [u] = await sql`SELECT id, username, email, role, avatar_url, bio, discord, is_verified, created_at FROM users WHERE LOWER(username) = ${username.toLowerCase()}`;
      if (!u) return send(res, 404, { error: 'User not found' });
      if (method === 'GET') {
        const scripts = await sql`SELECT s.id, s.slug, s.title, s.status, s.views, s.downloads, s.is_verified, s.thumbnail_url, s.game_id, s.is_universal, s.created_at, (SELECT ROUND(AVG(score)::numeric,1) FROM ratings WHERE script_id = s.id) as avg_rating FROM scripts s WHERE s.author_id = ${u.id} AND s.status != 'removed' ORDER BY s.created_at DESC`;
        const badges = await sql`SELECT b.name, b.label, b.color, b.icon, b.description, ub.granted_at FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ${u.id} ORDER BY ub.granted_at DESC`;
        const [stats] = await sql`SELECT (SELECT COUNT(*)::int FROM scripts WHERE author_id = ${u.id} AND status != 'removed') as script_count, (SELECT COALESCE(SUM(downloads),0)::int FROM scripts WHERE author_id = ${u.id}) as total_downloads, (SELECT COALESCE(SUM(views),0)::int FROM scripts WHERE author_id = ${u.id}) as total_views, (SELECT COUNT(*)::int FROM favorites f JOIN scripts s ON s.id = f.script_id WHERE s.author_id = ${u.id}) as total_favorites`;
        return send(res, 200, { user: { ...u, is_owner: isOwner(u) }, scripts, badges, stats });
      }
      if (method === 'PATCH') {
        if (!user) return send(res, 401, { error: 'Auth required' });
        if (user.id !== u.id && !user.is_admin) return send(res, 403, { error: 'Forbidden' });
        const verifiedUpdate = b.is_verified !== undefined && user.is_admin ? b.is_verified : null;
        const [updated] = await sql`UPDATE users SET bio = COALESCE(${b.bio??null}, bio), discord = COALESCE(${b.discord??null}, discord), avatar_url = COALESCE(${b.avatar_url??null}, avatar_url), is_verified = COALESCE(${verifiedUpdate}, is_verified), updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = ${u.id} RETURNING id, username, email, role, avatar_url, bio, discord, is_verified, created_at`;
        return send(res, 200, { user: updated });
      }
    }

    // ── SCRIPTS ─────────────────────────────────────────────────────────────
    if (r0 === 'scripts') {
      const slug = r1;
      const action = r2;

      if (!slug && method === 'GET') {
        const q = req.query || {};
        const search = q.q || '', tag = q.tag || '', sort = q.sort || 'newest', status = q.status || '';
        const page = Math.max(1, parseInt(q.page || '1'));
        const limit = Math.min(parseInt(q.limit || '24'), 50);
        const offset = (page - 1) * limit;
        const orderClause = { newest: sql`s.created_at DESC`, oldest: sql`s.created_at ASC`, downloads: sql`s.downloads DESC`, views: sql`s.views DESC`, rating: sql`(SELECT AVG(score) FROM ratings WHERE script_id = s.id) DESC NULLS LAST` }[sort] || sql`s.created_at DESC`;
        let scripts, total;
        if (!search && !tag && !status) {
          const [cr] = await sql`SELECT COUNT(*)::int as total FROM scripts s WHERE s.status != 'removed'`;
          total = cr.total; scripts = await sql`SELECT s.* FROM scripts s WHERE s.status != 'removed' ORDER BY ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
        } else if (search && !tag && !status) {
          const like = `%${search}%`;
          const [cr] = await sql`SELECT COUNT(*)::int as total FROM scripts s WHERE s.status != 'removed' AND (s.title ILIKE ${like} OR s.description ILIKE ${like} OR s.game ILIKE ${like})`;
          total = cr.total; scripts = await sql`SELECT s.* FROM scripts s WHERE s.status != 'removed' AND (s.title ILIKE ${like} OR s.description ILIKE ${like} OR s.game ILIKE ${like}) ORDER BY ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
        } else if (tag && !search && !status) {
          const [cr] = await sql`SELECT COUNT(*)::int as total FROM scripts s WHERE s.status != 'removed' AND EXISTS (SELECT 1 FROM script_tags st JOIN tags t ON t.id = st.tag_id WHERE st.script_id = s.id AND t.name = ${tag})`;
          total = cr.total; scripts = await sql`SELECT s.* FROM scripts s WHERE s.status != 'removed' AND EXISTS (SELECT 1 FROM script_tags st JOIN tags t ON t.id = st.tag_id WHERE st.script_id = s.id AND t.name = ${tag}) ORDER BY ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
        } else if (status && !search && !tag) {
          const [cr] = await sql`SELECT COUNT(*)::int as total FROM scripts s WHERE s.status = ${status}`;
          total = cr.total; scripts = await sql`SELECT s.* FROM scripts s WHERE s.status = ${status} ORDER BY ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
        } else {
          const like = `%${search}%`;
          const [cr] = await sql`SELECT COUNT(*)::int as total FROM scripts s WHERE s.status != 'removed' AND (${!search} OR s.title ILIKE ${like||''} OR s.description ILIKE ${like||''}) AND (${!tag} OR EXISTS (SELECT 1 FROM script_tags st JOIN tags t ON t.id = st.tag_id WHERE st.script_id = s.id AND t.name = ${tag||''})) AND (${!status} OR s.status = ${status||''})`;
          total = cr.total; scripts = await sql`SELECT s.* FROM scripts s WHERE s.status != 'removed' AND (${!search} OR s.title ILIKE ${like||''} OR s.description ILIKE ${like||''}) AND (${!tag} OR EXISTS (SELECT 1 FROM script_tags st JOIN tags t ON t.id = st.tag_id WHERE st.script_id = s.id AND t.name = ${tag||''})) AND (${!status} OR s.status = ${status||''}) ORDER BY ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
        }
        const enriched = await Promise.all(scripts.map(s => enrichScript(sql, s, user?.id)));
        return send(res, 200, { scripts: enriched, total, page, pages: Math.ceil(total / limit) });
      }

      if (!slug && method === 'POST') {
        if (!user) return send(res, 401, { error: 'Auth required' });
        const now = Math.floor(Date.now() / 1000);
        if (now - (user.last_upload_at || 0) < 300) return send(res, 429, { error: `Wait ${Math.ceil((300 - (now - (user.last_upload_at||0))) / 60)} min before uploading again.` });
        const { title, description, content, game, game_id, is_keyless, is_universal, is_paid, executor_notes, tags, version, thumbnail_url, key_link } = b;
        if (!title || !content) return send(res, 400, { error: 'Title and content required' });
        if (isSpam(title)) return send(res, 400, { error: 'Title looks like spam' });
        const newSlug = generateSlug(title);
        const finalThumb = user.is_verified ? (thumbnail_url || null) : null;
        const [script] = await sql`INSERT INTO scripts (slug, title, description, content, game, game_id, author_id, is_keyless, is_universal, is_paid, executor_notes, version, thumbnail_url, key_link) VALUES (${newSlug}, ${title}, ${description||''}, ${content}, ${game||null}, ${game_id||null}, ${user.id}, ${is_keyless??true}, ${is_universal??false}, ${is_paid??false}, ${executor_notes||null}, ${version||'1.0.0'}, ${finalThumb}, ${key_link||null}) RETURNING *`;
        if (tags?.length) for (const tagName of tags) { const [t] = await sql`SELECT id FROM tags WHERE name = ${tagName}`; if (t) await sql`INSERT INTO script_tags (script_id, tag_id) VALUES (${script.id}, ${t.id}) ON CONFLICT DO NOTHING`; }
        await sql`UPDATE users SET last_upload_at = ${now} WHERE id = ${user.id}`;
        return send(res, 201, await enrichScript(sql, script, user.id));
      }

      if (slug) {
        const [script] = await sql`SELECT * FROM scripts WHERE slug = ${slug}`;

        if (!action && method === 'GET') {
          if (!script) return send(res, 404, { error: 'Script not found' });
          if (user) {
            const now = Math.floor(Date.now() / 1000);
            const [vl] = await sql`SELECT logged_at FROM view_logs WHERE user_id = ${user.id} AND script_id = ${script.id}`;
            if (!vl || (now - vl.logged_at) > 86400) {
              await sql`UPDATE scripts SET views = views + 1 WHERE id = ${script.id}`;
              await sql`INSERT INTO view_logs (user_id, script_id, logged_at) VALUES (${user.id}, ${script.id}, ${now}) ON CONFLICT (user_id, script_id) DO UPDATE SET logged_at = ${now}`;
              script.views = (script.views || 0) + 1;
            }
          }
          return send(res, 200, await enrichScript(sql, script, user?.id));
        }

        if (!action && method === 'PATCH') {
          if (!script) return send(res, 404, { error: 'Not found' });
          if (!user) return send(res, 401, { error: 'Auth required' });
          if (script.author_id !== user.id && !user.is_admin) return send(res, 403, { error: 'Forbidden' });
          const [updated] = await sql`UPDATE scripts SET title = COALESCE(${b.title??null}, title), description = COALESCE(${b.description??null}, description), content = COALESCE(${b.content??null}, content), game = COALESCE(${b.game??null}, game), game_id = COALESCE(${b.game_id??null}, game_id), is_keyless = COALESCE(${b.is_keyless??null}, is_keyless), is_universal = COALESCE(${b.is_universal??null}, is_universal), status = COALESCE(${b.status??null}, status), version = COALESCE(${b.version??null}, version), key_link = COALESCE(${b.key_link??null}, key_link), thumbnail_url = COALESCE(${b.thumbnail_url??null}, thumbnail_url), updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = ${script.id} RETURNING *`;
          if (b.tags) { await sql`DELETE FROM script_tags WHERE script_id = ${script.id}`; for (const tn of b.tags) { const [t] = await sql`SELECT id FROM tags WHERE name = ${tn}`; if (t) await sql`INSERT INTO script_tags (script_id, tag_id) VALUES (${script.id}, ${t.id}) ON CONFLICT DO NOTHING`; } }
          return send(res, 200, await enrichScript(sql, updated, user.id));
        }

        if (!action && method === 'DELETE') {
          if (!script) return send(res, 404, { error: 'Not found' });
          if (!user) return send(res, 401, { error: 'Auth required' });
          if (script.author_id !== user.id && !user.is_admin) return send(res, 403, { error: 'Forbidden' });
          await sql`DELETE FROM scripts WHERE id = ${script.id}`;
          return send(res, 200, { ok: true });
        }

        if (action === 'download' && method === 'POST') {
          if (!script) return send(res, 404, { error: 'Not found' });
          if (user) {
            const now = Math.floor(Date.now() / 1000);
            const [dl] = await sql`SELECT logged_at FROM download_logs WHERE user_id = ${user.id} AND script_id = ${script.id}`;
            if (!dl || (now - dl.logged_at) > 86400) {
              await sql`UPDATE scripts SET downloads = downloads + 1 WHERE id = ${script.id}`;
              await sql`INSERT INTO download_logs (user_id, script_id, logged_at) VALUES (${user.id}, ${script.id}, ${now}) ON CONFLICT (user_id, script_id) DO UPDATE SET logged_at = ${now}`;
            }
          }
          return send(res, 200, { ok: true });
        }

        if (action === 'rate' && method === 'POST') {
          if (!user) return send(res, 401, { error: 'Auth required' });
          if (!script) return send(res, 404, { error: 'Not found' });
          const { score } = b;
          if (!score || score < 1 || score > 5) return send(res, 400, { error: 'Score 1–5' });
          await sql`INSERT INTO ratings (script_id, user_id, score) VALUES (${script.id}, ${user.id}, ${score}) ON CONFLICT (script_id, user_id) DO UPDATE SET score = ${score}`;
          const [r] = await sql`SELECT ROUND(AVG(score)::numeric,1) as avg, COUNT(*) as count FROM ratings WHERE script_id = ${script.id}`;
          return send(res, 200, { avg: parseFloat(r.avg), count: parseInt(r.count) });
        }

        if (action === 'comments' && method === 'GET') {
          if (!script) return send(res, 404, { error: 'Not found' });
          const comments = await sql`SELECT c.id, c.content, c.parent_id, c.is_deleted, c.created_at, u.id as user_id, u.username, u.avatar_url, u.role, u.is_verified FROM comments c JOIN users u ON u.id = c.user_id WHERE c.script_id = ${script.id} AND c.parent_id IS NULL ORDER BY c.created_at ASC`;
          const replies = await sql`SELECT c.id, c.content, c.parent_id, c.is_deleted, c.created_at, u.id as user_id, u.username, u.avatar_url, u.role, u.is_verified FROM comments c JOIN users u ON u.id = c.user_id WHERE c.script_id = ${script.id} AND c.parent_id IS NOT NULL ORDER BY c.created_at ASC`;
          const mask = c => c.is_deleted ? { ...c, content: '[deleted]' } : c;
          return send(res, 200, { comments: comments.map(mask), replies: replies.map(mask) });
        }

        if (action === 'comments' && method === 'POST') {
          if (!user) return send(res, 401, { error: 'Auth required' });
          if (!script) return send(res, 404, { error: 'Not found' });
          const { content, parent_id } = b;
          if (!content?.trim()) return send(res, 400, { error: 'Content required' });
          const recent = await sql`SELECT content FROM comments WHERE user_id = ${user.id} AND script_id = ${script.id} ORDER BY created_at DESC LIMIT 3`;
          if (isSpam(content, recent.map(r => r.content))) return send(res, 400, { error: 'Looks like spam.' });
          const [comment] = await sql`INSERT INTO comments (script_id, user_id, content, parent_id) VALUES (${script.id}, ${user.id}, ${content.trim()}, ${parent_id||null}) RETURNING *`;
          const [withUser] = await sql`SELECT c.id, c.content, c.parent_id, c.is_deleted, c.created_at, u.id as user_id, u.username, u.avatar_url, u.role, u.is_verified FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ${comment.id}`;
          const mentions = [...content.matchAll(/@([a-zA-Z0-9_]+)/g)].map(m => m[1].toLowerCase());
          for (const mention of [...new Set(mentions)]) { const [m] = await sql`SELECT id FROM users WHERE LOWER(username) = ${mention}`; if (m && m.id !== user.id) await sql`INSERT INTO notifications (user_id, type, message, link) VALUES (${m.id}, 'mention', ${`@${user.username} mentioned you`}, ${`/scripts/${slug}`})`; }
          if (script.author_id !== user.id && !parent_id) await sql`INSERT INTO notifications (user_id, type, message, link) VALUES (${script.author_id}, 'comment', ${`${user.username} commented on your script`}, ${`/scripts/${slug}`})`;
          return send(res, 201, withUser);
        }

        if (action === 'comments' && r3 && method === 'DELETE') {
          if (!user) return send(res, 401, { error: 'Auth required' });
          const cid = parseInt(r3);
          const [c] = await sql`SELECT * FROM comments WHERE id = ${cid}`;
          if (!c) return send(res, 404, { error: 'Not found' });
          if (c.user_id !== user.id && !user.is_admin) return send(res, 403, { error: 'Forbidden' });
          await sql`UPDATE comments SET is_deleted = TRUE, content = '' WHERE id = ${cid}`;
          return send(res, 200, { ok: true });
        }

        if (action === 'favorite' && method === 'POST') {
          if (!user) return send(res, 401, { error: 'Auth required' });
          if (!script) return send(res, 404, { error: 'Not found' });
          const [ex] = await sql`SELECT 1 FROM favorites WHERE user_id = ${user.id} AND script_id = ${script.id}`;
          if (ex) { await sql`DELETE FROM favorites WHERE user_id = ${user.id} AND script_id = ${script.id}`; return send(res, 200, { favorited: false }); }
          await sql`INSERT INTO favorites (user_id, script_id) VALUES (${user.id}, ${script.id})`;
          return send(res, 200, { favorited: true });
        }
      }
    }

    // ── BLOG ────────────────────────────────────────────────────────────────
    if (r0 === 'blog') {
      const slug = r1;
      const canWrite = user?.is_owner || user?.is_admin;
      if (!slug && method === 'GET') {
        const posts = canWrite
          ? await sql`SELECT p.*, u.username as author_name, u.avatar_url as author_avatar FROM blog_posts p LEFT JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC`
          : await sql`SELECT p.*, u.username as author_name, u.avatar_url as author_avatar FROM blog_posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.published = TRUE ORDER BY p.created_at DESC`;
        return send(res, 200, { posts });
      }
      if (slug && method === 'GET') {
        const [post] = await sql`SELECT p.*, u.username as author_name, u.avatar_url as author_avatar FROM blog_posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.slug = ${slug}`;
        if (!post || (!post.published && !canWrite)) return send(res, 404, { error: 'Post not found' });
        return send(res, 200, { post });
      }
      if (!slug && method === 'POST') {
        if (!canWrite) return send(res, 403, { error: 'Owner only' });
        const { title, excerpt, content, cover_url, published } = b;
        if (!title || !content) return send(res, 400, { error: 'Title and content required' });
        const [post] = await sql`INSERT INTO blog_posts (slug, title, excerpt, content, cover_url, author_id, published) VALUES (${generateSlug(title)}, ${title}, ${excerpt||null}, ${content}, ${cover_url||null}, ${user.id}, ${published??false}) RETURNING *`;
        return send(res, 201, { post });
      }
      if (slug && method === 'PATCH') {
        if (!canWrite) return send(res, 403, { error: 'Owner only' });
        const [post] = await sql`UPDATE blog_posts SET title = COALESCE(${b.title??null}, title), excerpt = COALESCE(${b.excerpt??null}, excerpt), content = COALESCE(${b.content??null}, content), cover_url = COALESCE(${b.cover_url??null}, cover_url), published = COALESCE(${b.published??null}, published), updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE slug = ${slug} RETURNING *`;
        return send(res, 200, { post });
      }
      if (slug && method === 'DELETE') {
        if (!canWrite) return send(res, 403, { error: 'Owner only' });
        await sql`DELETE FROM blog_posts WHERE slug = ${slug}`;
        return send(res, 200, { ok: true });
      }
    }

    // ── ADMIN ───────────────────────────────────────────────────────────────
    if (r0 === 'admin') {
      if (!user?.is_admin) return send(res, 403, { error: 'Admin only' });
      const id = r2;
      const q = req.query || {};

      if (r1 === 'stats' && method === 'GET') {
        const [counts] = await sql`SELECT (SELECT COUNT(*)::int FROM users) as users, (SELECT COUNT(*)::int FROM scripts WHERE status != 'removed') as scripts, (SELECT COALESCE(SUM(downloads),0)::int FROM scripts) as downloads, (SELECT COALESCE(SUM(views),0)::int FROM scripts) as views`;
        const recent_users = await sql`SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5`;
        const recent_scripts = await sql`SELECT id, slug, title, status, downloads, created_at FROM scripts ORDER BY created_at DESC LIMIT 5`;
        return send(res, 200, { counts, recent_users, recent_scripts });
      }

      if (r1 === 'users' && method === 'GET' && !id) {
        const page = Math.max(1, parseInt(q.page||'1')), limit = 25, offset = (page-1)*25, search = q.q||'';
        let users, total;
        if (search) { const like=`%${search}%`; const [t]=await sql`SELECT COUNT(*)::int as c FROM users WHERE username ILIKE ${like} OR email ILIKE ${like}`; total=t.c; users=await sql`SELECT id, username, email, role, is_verified, created_at, (SELECT COUNT(*)::int FROM scripts WHERE author_id = users.id) as script_count FROM users WHERE username ILIKE ${like} OR email ILIKE ${like} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`; }
        else { const [t]=await sql`SELECT COUNT(*)::int as c FROM users`; total=t.c; users=await sql`SELECT id, username, email, role, is_verified, created_at, (SELECT COUNT(*)::int FROM scripts WHERE author_id = users.id) as script_count FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`; }
        return send(res, 200, { users, total, page, pages: Math.ceil(total/limit) });
      }
      if (r1 === 'users' && id && method === 'PATCH') {
        if (parseInt(id) === user.id) return send(res, 400, { error: 'Cannot change your own role' });
        const [u] = await sql`UPDATE users SET role = COALESCE(${b.role??null}, role), is_verified = COALESCE(${b.is_verified??null}, is_verified) WHERE id = ${id} RETURNING id, username, role, is_verified`;
        return send(res, 200, { user: u });
      }
      if (r1 === 'users' && id && method === 'DELETE') {
        if (parseInt(id) === user.id) return send(res, 400, { error: 'Cannot delete yourself' });
        await sql`DELETE FROM users WHERE id = ${id}`;
        return send(res, 200, { ok: true });
      }

      if (r1 === 'scripts' && method === 'GET' && !id) {
        const page = Math.max(1, parseInt(q.page||'1')), limit = 25, offset = (page-1)*25, search = q.q||'', status = q.status||'';
        let scripts, total;
        if (!search && !status) { const [t]=await sql`SELECT COUNT(*)::int as c FROM scripts s JOIN users u ON u.id = s.author_id`; total=t.c; scripts=await sql`SELECT s.id, s.slug, s.title, s.status, s.is_verified, s.downloads, s.views, s.created_at, u.username as author FROM scripts s JOIN users u ON u.id = s.author_id ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`; }
        else if (search && !status) { const like=`%${search}%`; const [t]=await sql`SELECT COUNT(*)::int as c FROM scripts s JOIN users u ON u.id = s.author_id WHERE s.title ILIKE ${like} OR u.username ILIKE ${like}`; total=t.c; scripts=await sql`SELECT s.id, s.slug, s.title, s.status, s.is_verified, s.downloads, s.views, s.created_at, u.username as author FROM scripts s JOIN users u ON u.id = s.author_id WHERE s.title ILIKE ${like} OR u.username ILIKE ${like} ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`; }
        else if (status && !search) { const [t]=await sql`SELECT COUNT(*)::int as c FROM scripts s JOIN users u ON u.id = s.author_id WHERE s.status = ${status}`; total=t.c; scripts=await sql`SELECT s.id, s.slug, s.title, s.status, s.is_verified, s.downloads, s.views, s.created_at, u.username as author FROM scripts s JOIN users u ON u.id = s.author_id WHERE s.status = ${status} ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`; }
        else { const like=`%${search}%`; const [t]=await sql`SELECT COUNT(*)::int as c FROM scripts s JOIN users u ON u.id = s.author_id WHERE (s.title ILIKE ${like} OR u.username ILIKE ${like}) AND s.status = ${status}`; total=t.c; scripts=await sql`SELECT s.id, s.slug, s.title, s.status, s.is_verified, s.downloads, s.views, s.created_at, u.username as author FROM scripts s JOIN users u ON u.id = s.author_id WHERE (s.title ILIKE ${like} OR u.username ILIKE ${like}) AND s.status = ${status} ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`; }
        return send(res, 200, { scripts, total, page, pages: Math.ceil(total/limit) });
      }
      if (r1 === 'scripts' && id && method === 'PATCH') {
        const [script] = await sql`UPDATE scripts SET status = COALESCE(${b.status??null}, status), is_verified = COALESCE(${b.is_verified??null}, is_verified) WHERE id = ${id} RETURNING id, slug, title, status, is_verified`;
        return send(res, 200, { script });
      }
      if (r1 === 'scripts' && id && method === 'DELETE') {
        await sql`DELETE FROM scripts WHERE id = ${id}`;
        return send(res, 200, { ok: true });
      }
    }

    return send(res, 404, { error: 'Not found' });

  } catch (e) {
    console.error('API error:', e);
    send(res, 500, { error: e.message || 'Internal server error' });
  }
};
