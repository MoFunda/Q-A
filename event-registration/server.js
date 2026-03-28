const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== Configuration ==========
const CONFIG = {
  port: process.env.PORT || 3000,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  dataFile: path.join(__dirname, 'data', 'registrations.json'),

  // Email configuration (use environment variables)
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },

  // Event details
  event: {
    name: '共识粉碎机GTC线下交流会',
    date: '2026年3月18日 周三 下午17:00',
    address: '42 Tuscaloosa Ave, Atherton, CA 94027',
  },
};

// ========== Data Storage ==========
function ensureDataDir() {
  const dir = path.dirname(CONFIG.dataFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.dataFile)) {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify([], null, 2));
  }
}

function readRegistrations() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf-8'));
}

function saveRegistrations(data) {
  ensureDataDir();
  fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
}

// ========== Auth Token ==========
const tokens = new Set();

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  return token;
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未授权' });
  }
  const token = auth.slice(7);
  if (!tokens.has(token)) {
    return res.status(401).json({ message: '无效的令牌' });
  }
  next();
}

// ========== Email ==========
function createTransporter() {
  if (!CONFIG.email.user || !CONFIG.email.pass) {
    console.warn('WARNING: SMTP credentials not configured. Emails will not be sent.');
    return null;
  }
  return nodemailer.createTransport({
    host: CONFIG.email.host,
    port: CONFIG.email.port,
    secure: CONFIG.email.secure,
    auth: {
      user: CONFIG.email.user,
      pass: CONFIG.email.pass,
    },
  });
}

async function sendApprovalEmail(registration) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Mock Email] Would send approval to: ${registration.email}`);
    console.log(`[Mock Email] Event address: ${CONFIG.event.address}`);
    return;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f0c29, #302b63); border-radius: 16px; padding: 32px; color: #fff; text-align: center;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">🎉 报名审核通过</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px;">共识粉碎机GTC线下交流会</p>
      </div>

      <div style="background: #fff; border-radius: 12px; padding: 24px; margin-top: 16px;">
        <p style="font-size: 15px; line-height: 1.8; color: #2d3436;">
          ${registration.name}，您好！
        </p>
        <p style="font-size: 15px; line-height: 1.8; color: #2d3436;">
          恭喜！您的活动报名已审核通过。以下是活动详情：
        </p>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2d3436;">
            <tr>
              <td style="padding: 8px 0; color: #636e72; width: 80px;">活动名称</td>
              <td style="padding: 8px 0; font-weight: 600;">${CONFIG.event.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #636e72;">活动时间</td>
              <td style="padding: 8px 0; font-weight: 600;">${CONFIG.event.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #636e72;">活动地址</td>
              <td style="padding: 8px 0; font-weight: 600;">${CONFIG.event.address}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #b2bec3; margin-top: 16px;">
          ⚠️ 请注意：活动地址为私密信息，请勿外传。感谢您的理解与配合。
        </p>

        <p style="font-size: 14px; color: #2d3436; margin-top: 16px;">
          期待与您见面！<br>
          共识粉碎机团队
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: CONFIG.email.from,
    to: registration.email,
    subject: `✅ 报名通过 - ${CONFIG.event.name}`,
    html,
  });
}

async function sendRejectionEmail(registration) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Mock Email] Would send rejection to: ${registration.email}`);
    return;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f0c29, #302b63); border-radius: 16px; padding: 32px; color: #fff; text-align: center;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">${CONFIG.event.name}</h1>
      </div>

      <div style="background: #fff; border-radius: 12px; padding: 24px; margin-top: 16px;">
        <p style="font-size: 15px; line-height: 1.8; color: #2d3436;">
          ${registration.name}，您好！
        </p>
        <p style="font-size: 15px; line-height: 1.8; color: #2d3436;">
          感谢您对本次活动的关注。很遗憾，由于名额有限，本次未能通过您的报名申请。
        </p>
        <p style="font-size: 15px; line-height: 1.8; color: #2d3436;">
          期待未来活动中与您相见！
        </p>
        <p style="font-size: 14px; color: #2d3436; margin-top: 16px;">
          共识粉碎机团队
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: CONFIG.email.from,
    to: registration.email,
    subject: `${CONFIG.event.name} - 报名结果通知`,
    html,
  });
}

// ========== API Routes ==========

// User registration
app.post('/api/register', (req, res) => {
  const { name, company, customerType, email } = req.body;

  if (!name || !company || !customerType || !email) {
    return res.status(400).json({ message: '请填写所有必填字段' });
  }

  const validTypes = ['institutional', 'individual', 'non-subscriber'];
  if (!validTypes.includes(customerType)) {
    return res.status(400).json({ message: '无效的客户类型' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: '无效的邮箱地址' });
  }

  const registrations = readRegistrations();

  // Check duplicate email
  if (registrations.some(r => r.email === email)) {
    return res.status(409).json({ message: '该邮箱已报名，请勿重复提交' });
  }

  const registration = {
    id: crypto.randomUUID(),
    name: name.trim(),
    company: company.trim(),
    customerType,
    email: email.trim().toLowerCase(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  registrations.push(registration);
  saveRegistrations(registrations);

  console.log(`[New Registration] ${registration.name} - ${registration.company} - ${registration.email}`);

  res.status(201).json({ message: '报名成功', id: registration.id });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== CONFIG.adminPassword) {
    return res.status(401).json({ message: '密码错误' });
  }
  const token = generateToken();
  res.json({ token });
});

// Get all registrations (admin)
app.get('/api/admin/registrations', authMiddleware, (req, res) => {
  const registrations = readRegistrations();
  res.json({ registrations });
});

// Approve registration
app.post('/api/admin/registrations/:id/approve', authMiddleware, async (req, res) => {
  const registrations = readRegistrations();
  const reg = registrations.find(r => r.id === req.params.id);

  if (!reg) return res.status(404).json({ message: '未找到该报名记录' });
  if (reg.status !== 'pending') return res.status(400).json({ message: '该报名已处理' });

  reg.status = 'approved';
  reg.approvedAt = new Date().toISOString();
  saveRegistrations(registrations);

  try {
    await sendApprovalEmail(reg);
    console.log(`[Approved] ${reg.name} - Email sent to ${reg.email}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send to ${reg.email}:`, err.message);
  }

  res.json({ message: '已通过，邮件已发送' });
});

// Reject registration
app.post('/api/admin/registrations/:id/reject', authMiddleware, async (req, res) => {
  const registrations = readRegistrations();
  const reg = registrations.find(r => r.id === req.params.id);

  if (!reg) return res.status(404).json({ message: '未找到该报名记录' });
  if (reg.status !== 'pending') return res.status(400).json({ message: '该报名已处理' });

  reg.status = 'rejected';
  reg.rejectedAt = new Date().toISOString();
  saveRegistrations(registrations);

  try {
    await sendRejectionEmail(reg);
    console.log(`[Rejected] ${reg.name} - Email sent to ${reg.email}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send to ${reg.email}:`, err.message);
  }

  res.json({ message: '已拒绝' });
});

// ========== Start Server ==========
app.listen(CONFIG.port, () => {
  console.log(`\n========================================`);
  console.log(`  共识粉碎机GTC - 活动报名系统`);
  console.log(`========================================`);
  console.log(`  报名页面: http://localhost:${CONFIG.port}`);
  console.log(`  管理后台: http://localhost:${CONFIG.port}/admin.html`);
  console.log(`  管理密码: ${CONFIG.adminPassword}`);
  console.log(`========================================\n`);
});
