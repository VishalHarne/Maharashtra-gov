import cors from 'cors';
import express from 'express';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataFile = resolve(currentDir, '../data/store.json');
const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());
const isLocalDevelopmentOrigin = (origin) => {
  try {
    const url = new URL(origin);
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const isPrivateAddress = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(url.hostname);
    return url.protocol === 'http:' && (isLocalHost || isPrivateAddress) && /^517[3-9]$/.test(url.port);
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    const allowed = !origin || allowedOrigins.includes(origin)
      || (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(origin));
    callback(allowed ? null : new Error('Origin is not allowed by CORS.'), allowed);
  }
}));
app.use(express.json({ limit: '1mb' }));

const passwordRecord = (password, salt = randomBytes(16).toString('hex')) => ({
  salt,
  hash: scryptSync(password, salt, 64).toString('hex')
});

const seedDatabase = () => {
  const demoPassword = 'Demo@123';
  const users = [
    {
      id: 'user-kp-demo',
      username: 'kp.demo',
      name: 'Asha Ingle',
      role: 'Kendra Pramukh',
      managerId: 'user-gsa-demo',
      assignedSchoolIds: ['school-001'],
      blockIds: ['Haveli'],
      ...passwordRecord(demoPassword)
    },
    {
      id: 'user-gsa-demo',
      username: 'gsa.demo',
      name: 'Vikas Mehta',
      role: 'Gat Shikshan Adhikari',
      assignedSchoolIds: [],
      blockIds: ['Haveli'],
      ...passwordRecord(demoPassword)
    },
    {
      id: 'user-hm-demo',
      username: 'hm.demo',
      name: 'Sharda Joshi',
      role: 'Headmaster',
      assignedSchoolIds: ['school-001'],
      blockIds: ['Haveli'],
      ...passwordRecord(demoPassword)
    }
  ];

  return {
    demoData: true,
    users,
    schools: [
      {
        id: 'school-001',
        udiseCode: 'DEMO-27210101201',
        name: 'Zilla Parishad School, Kharadi (Demo)',
        district: 'Pune',
        block: 'Haveli',
        cluster: 'Kharadi',
        category: 'Primary School',
        enrollment: 420
      },
      {
        id: 'school-002',
        udiseCode: 'DEMO-27210101202',
        name: 'Zilla Parishad School, Wagholi (Demo)',
        district: 'Pune',
        block: 'Haveli',
        cluster: 'Kharadi',
        category: 'Primary School',
        enrollment: 315
      }
    ],
    visits: [],
    findings: [],
    actions: [],
    notifications: [],
    auditEvents: [],
    sessions: []
  };
};

mkdirSync(dirname(dataFile), { recursive: true });
if (!existsSync(dataFile)) {
  writeFileSync(dataFile, `${JSON.stringify(seedDatabase(), null, 2)}\n`, 'utf8');
}

let database = JSON.parse(readFileSync(dataFile, 'utf8'));

const saveDatabase = () => {
  const tempFile = `${dataFile}.tmp`;
  writeFileSync(tempFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  renameSync(tempFile, dataFile);
};

const publicUser = ({ id, username, name, role, assignedSchoolIds, blockIds }) => ({
  id,
  username,
  name,
  role,
  assignedSchoolIds,
  blockIds
});

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const safeEqual = (leftHex, rightHex) => {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
};

const addAuditEvent = (actorId, entityType, entityId, eventType, details = {}) => {
  database.auditEvents.push({
    id: randomBytes(16).toString('hex'),
    actorId,
    entityType,
    entityId,
    eventType,
    details,
    timestamp: new Date().toISOString()
  });
};

const requireAuth = (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in is required.' });

  const hash = tokenHash(token);
  const session = database.sessions.find((item) => item.tokenHash === hash && item.expiresAt > Date.now());
  const user = session && database.users.find((item) => item.id === session.userId);
  if (!user) return res.status(401).json({ error: 'Session is invalid or expired. Sign in again.' });

  req.user = user;
  req.sessionHash = hash;
  next();
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Your role is not allowed to perform this action.' });
  }
  next();
};

const schoolIsAccessible = (user, school) => {
  if (!school) return false;
  if (user.role === 'Gat Shikshan Adhikari') return user.blockIds.includes(school.block);
  return user.assignedSchoolIds.includes(school.id);
};

const visitIsAccessible = (user, visit) => {
  const school = database.schools.find((item) => item.id === visit.schoolId);
  return schoolIsAccessible(user, school) && (user.role !== 'Kendra Pramukh' || visit.officerId === user.id);
};

const notificationIsAccessible = (user, notification) =>
  user.role === 'Gat Shikshan Adhikari' && notification.recipientId === user.id;

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, dataMode: 'synthetic-demo' }));

app.post('/api/v1/auth/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = database.users.find((item) => item.username.toLowerCase() === username);
  if (!user || !password) return res.status(401).json({ error: 'Username or password is incorrect.' });

  const candidate = scryptSync(password, user.salt, 64).toString('hex');
  if (!safeEqual(user.hash, candidate)) return res.status(401).json({ error: 'Username or password is incorrect.' });

  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  database.sessions = database.sessions.filter((session) => session.expiresAt > Date.now());
  database.sessions.push({ tokenHash: tokenHash(token), userId: user.id, expiresAt });
  addAuditEvent(user.id, 'session', user.id, 'login');
  saveDatabase();
  res.json({ token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) });
});

app.post('/api/v1/auth/logout', requireAuth, (req, res) => {
  database.sessions = database.sessions.filter((session) => session.tokenHash !== req.sessionHash);
  addAuditEvent(req.user.id, 'session', req.user.id, 'logout');
  saveDatabase();
  res.status(204).end();
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/v1/schools', requireAuth, (req, res) => {
  res.json({
    schools: database.schools.filter((school) => schoolIsAccessible(req.user, school))
  });
});

app.get('/api/v1/schools/:id/action-owners', requireAuth, requireRole('Gat Shikshan Adhikari'), (req, res) => {
  const school = database.schools.find((item) => item.id === req.params.id);
  if (!school || !schoolIsAccessible(req.user, school)) return res.status(404).json({ error: 'School not found.' });
  const owners = database.users.filter((user) => user.role === 'Headmaster' && user.assignedSchoolIds.includes(school.id))
    .map(({ id, name, role }) => ({ id, name, role }));
  res.json({ owners });
});

app.get('/api/v1/dashboard/summary', requireAuth, (req, res) => {
  const accessibleSchools = database.schools.filter((school) => schoolIsAccessible(req.user, school));
  const schoolIds = new Set(accessibleSchools.map((school) => school.id));
  const visibleVisits = database.visits.filter((visit) => visitIsAccessible(req.user, visit));
  const visibleActions = database.actions.filter((action) => schoolIds.has(action.schoolId)
    && (req.user.role !== 'Headmaster' || action.ownerId === req.user.id));
  const notifications = database.notifications.filter((notification) => notificationIsAccessible(req.user, notification));
  const count = (status) => visibleActions.filter((action) => action.status === status).length;

  res.json({
    role: req.user.role,
    schoolCount: accessibleSchools.length,
    visitCount: visibleVisits.length,
    openActions: visibleActions.filter((action) => action.status !== 'Closed').length,
    overdueActions: visibleActions.filter((action) => action.status !== 'Closed' && action.dueDate < new Date().toISOString().slice(0, 10)).length,
    blockedActions: count('Blocked'),
    awaitingVerification: count('Awaiting Verification'),
    unreadNotifications: notifications.filter((notification) => !notification.readAt).length,
    notifications,
    recentVisits: visibleVisits.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    actions: visibleActions.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  });
});

app.get('/api/v1/visits', requireAuth, (req, res) => {
  res.json({ visits: database.visits.filter((visit) => visitIsAccessible(req.user, visit)) });
});

app.post('/api/v1/visits', requireAuth, requireRole('Kendra Pramukh'), (req, res) => {
  const { schoolId, visitDate, purpose, checklist, finding } = req.body || {};
  const school = database.schools.find((item) => item.id === schoolId);
  const validChecklists = ['School Safety Check', 'Follow-up Review', 'Infrastructure Audit'];
  const categories = ['Water, Sanitation and Hygiene', 'Safety & Access', 'Infrastructure', 'Teaching and Learning', 'Other'];
  const severities = ['Low', 'Medium', 'High', 'Critical'];
  const dueDate = finding?.dueDate;
  if (!schoolIsAccessible(req.user, school)) return res.status(403).json({ error: 'This school is not assigned to you.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate || '') || Number.isNaN(Date.parse(`${visitDate}T00:00:00Z`))) {
    return res.status(400).json({ error: 'A valid visit date is required.' });
  }
  if (typeof purpose !== 'string' || !purpose.trim() || !validChecklists.includes(checklist)) {
    return res.status(400).json({ error: 'Purpose and an approved checklist are required.' });
  }
  if (!finding || !categories.includes(finding.category) || typeof finding.description !== 'string' || !finding.description.trim()
    || !severities.includes(finding.severity) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || '') || dueDate < visitDate) {
    return res.status(400).json({ error: 'Finding category, description, severity, and a due date on or after the visit date are required.' });
  }

  const manager = database.users.find((user) => user.id === req.user.managerId && user.role === 'Gat Shikshan Adhikari');
  if (!manager || !manager.blockIds.includes(school.block)) {
    return res.status(409).json({ error: 'No configured manager is available for this school block.' });
  }

  const timestamp = new Date().toISOString();
  const visit = {
    id: randomBytes(16).toString('hex'), schoolId, officerId: req.user.id, officerName: req.user.name,
    visitDate, purpose: purpose.trim(), checklist, status: 'Submitted', createdAt: timestamp, submittedAt: timestamp
  };
  const newFinding = {
    id: randomBytes(16).toString('hex'), visitId: visit.id, schoolId, category: finding.category,
    description: finding.description.trim(), severity: finding.severity, status: 'Open'
  };
  const notification = {
    id: randomBytes(16).toString('hex'), recipientId: manager.id, visitId: visit.id, schoolId,
    title: 'Visit report submitted', message: `${school.name}: ${req.user.name} submitted a visit report.`,
    status: 'Awaiting review', createdAt: timestamp, readAt: null, responseNote: null
  };

  database.visits.push(visit);
  database.findings.push(newFinding);
  database.notifications.push(notification);
  addAuditEvent(req.user.id, 'visit', visit.id, 'visit_submitted', { notificationId: notification.id, checklist });
  saveDatabase();
  res.status(201).json({ visit, finding: newFinding, notificationCreated: true });
});

app.get('/api/v1/notifications', requireAuth, requireRole('Gat Shikshan Adhikari'), (req, res) => {
  res.json({ notifications: database.notifications.filter((item) => notificationIsAccessible(req.user, item)) });
});

app.post('/api/v1/notifications/:id/respond', requireAuth, requireRole('Gat Shikshan Adhikari'), (req, res) => {
  const { decision, note } = req.body || {};
  if (!['Approve', 'Raise concern'].includes(decision)) return res.status(400).json({ error: 'Decision must be Approve or Raise concern.' });
  if (decision === 'Raise concern' && (typeof note !== 'string' || !note.trim())) {
    return res.status(400).json({ error: 'A concern note is required.' });
  }
  const notification = database.notifications.find((item) => item.id === req.params.id);
  if (!notification || !notificationIsAccessible(req.user, notification)) return res.status(404).json({ error: 'Notification not found.' });
  if (notification.status !== 'Awaiting review') return res.status(409).json({ error: 'This report has already been reviewed.' });

  notification.status = decision === 'Approve' ? 'Approved' : 'Concern raised';
  notification.responseNote = note?.trim() || null;
  notification.readAt = new Date().toISOString();
  notification.reviewedAt = notification.readAt;
  notification.reviewedBy = req.user.id;
  const visit = database.visits.find((item) => item.id === notification.visitId);
  if (visit) visit.reviewStatus = notification.status;
  addAuditEvent(req.user.id, 'notification', notification.id, decision === 'Approve' ? 'report_approved' : 'concern_raised', { note: notification.responseNote });
  saveDatabase();
  res.json({ notification });
});

app.post('/api/v1/notifications/:id/tasks', requireAuth, requireRole('Gat Shikshan Adhikari'), (req, res) => {
  const { title, expectedOutcome, ownerId, dueDate } = req.body || {};
  const notification = database.notifications.find((item) => item.id === req.params.id);
  if (!notification || !notificationIsAccessible(req.user, notification)) return res.status(404).json({ error: 'Notification not found.' });
  if (typeof title !== 'string' || !title.trim() || typeof expectedOutcome !== 'string' || !expectedOutcome.trim()
    || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || '') || dueDate < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Task title, expected outcome, and a current or future due date are required.' });
  }
  const owner = database.users.find((user) => user.id === ownerId && user.role === 'Headmaster'
    && user.assignedSchoolIds.includes(notification.schoolId));
  if (!owner) return res.status(400).json({ error: 'Choose a headmaster assigned to this school.' });
  const finding = database.findings.find((item) => item.visitId === notification.visitId);
  if (!finding) return res.status(409).json({ error: 'The visit has no finding to attach this task to.' });
  const timestamp = new Date().toISOString();
  const action = {
    id: randomBytes(16).toString('hex'), findingId: finding.id, schoolId: notification.schoolId,
    ownerId: owner.id, ownerName: owner.name, ownerRole: owner.role, title: title.trim(),
    expectedOutcome: expectedOutcome.trim(), dueDate, status: 'Open', priority: 'Medium',
    createdAt: timestamp, lastUpdated: timestamp
  };
  database.actions.push(action);
  addAuditEvent(req.user.id, 'action', action.id, 'task_created', { notificationId: notification.id, ownerId: owner.id });
  saveDatabase();
  res.status(201).json({ action });
});

app.get('/api/v1/actions', requireAuth, (req, res) => {
  const visibleSchoolIds = new Set(database.schools.filter((school) => schoolIsAccessible(req.user, school)).map((school) => school.id));
  const actions = database.actions.filter((action) => visibleSchoolIds.has(action.schoolId)
    && (req.user.role !== 'Headmaster' || action.ownerId === req.user.id));
  res.json({ actions });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected API error.' });
});

app.listen(port, () => {
  console.log(`ShalaSetu API listening on http://localhost:${port}`);
  console.log(`JSON data store: ${dataFile}`);
  console.log('Demo data is synthetic and stored locally.');
});
