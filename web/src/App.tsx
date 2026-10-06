import { FormEvent, useEffect, useState } from 'react';

type Role = 'Kendra Pramukh' | 'Headmaster' | 'Gat Shikshan Adhikari';
type User = { id: string; username: string; name: string; role: Role; assignedSchoolIds: string[]; blockIds: string[] };
type School = { id: string; udiseCode: string; name: string; district: string; block: string; cluster: string; category: string; enrollment: number };
type Visit = { id: string; schoolId: string; officerName: string; visitDate: string; purpose: string; checklist: string; reviewStatus?: string; submittedAt: string };
type Action = { id: string; schoolId: string; title: string; ownerName: string; ownerRole: string; expectedOutcome: string; dueDate: string; status: string; blockedReason?: string };
type Notification = { id: string; schoolId: string; visitId: string; title: string; message: string; status: string; createdAt: string; responseNote?: string | null };
type ReportFinding = { id: string; category: string; description: string; severity: string; status: string };
type ReportDetails = { visit: Visit; school: School; findings: ReportFinding[] };
type Summary = { role: Role; schoolCount: number; visitCount: number; openActions: number; overdueActions: number; blockedActions: number; awaitingVerification: number; unreadNotifications: number; notifications: Notification[]; recentVisits: Visit[]; actions: Action[] };

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '')).replace(/\/+$/, '');
const demoAccounts = [
  { username: 'gsa.demo', label: 'Gat Shikshan Adhikari' },
  { username: 'kp.demo', label: 'Kendra Pramukh' },
  { username: 'hm.demo', label: 'Headmaster' }
];
const demoPassword = 'Demo@123';

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('API is not configured. Set VITE_API_URL to the deployed API base URL.');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('shalasetu-token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);

  const refresh = async (activeToken = token) => {
    const [me, dashboard, directory] = await Promise.all([
      request<{ user: User }>('/auth/me', activeToken),
      request<Summary>('/dashboard/summary', activeToken),
      request<{ schools: School[] }>('/schools', activeToken)
    ]);
    setUser(me.user);
    setSummary(dashboard);
    setSchools(directory.schools);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      request<{ user: User }>('/auth/me', token),
      request<Summary>('/dashboard/summary', token),
      request<{ schools: School[] }>('/schools', token)
    ]).then(([me, dashboard, directory]) => {
      if (cancelled) return;
      setUser(me.user);
      setSummary(dashboard);
      setSchools(directory.schools);
      setError('');
    }).catch((requestError: Error) => {
      if (cancelled) return;
      localStorage.removeItem('shalasetu-token');
      setToken('');
      setError(requestError.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await request<{ token: string }>('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
      });
      localStorage.setItem('shalasetu-token', result.token);
      setLoading(true);
      setToken(result.token);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try { await request('/auth/logout', token, { method: 'POST' }); } catch { /* Clear the local session even if the API is unavailable. */ }
    localStorage.removeItem('shalasetu-token');
    setToken('');
    setUser(null);
    setSummary(null);
  };

  const submitVisit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/visits', token, {
        method: 'POST',
        body: JSON.stringify({
          schoolId: form.get('schoolId'),
          visitDate: form.get('visitDate'),
          purpose: form.get('purpose'),
          checklist: form.get('checklist'),
          finding: {
            category: form.get('category'),
            description: form.get('description'),
            severity: form.get('severity'),
            dueDate: form.get('dueDate'),
            expectedOutcome: form.get('expectedOutcome')
          }
        })
      });
      setShowVisitForm(false);
      await refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reviewNotification = async (notification: Notification, decision: 'Approve' | 'Raise concern', note?: string) => {
    setBusy(true);
    setError('');
    try {
      await request(`/notifications/${notification.id}/respond`, token, {
        method: 'POST', body: JSON.stringify({ decision, note })
      });
      setActiveNotification(null);
      await refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createTask = async (event: FormEvent<HTMLFormElement>, notification: Notification) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await request(`/notifications/${notification.id}/tasks`, token, {
        method: 'POST', body: JSON.stringify({
          title: form.get('title'), expectedOutcome: form.get('expectedOutcome'),
          ownerId: form.get('ownerId'), dueDate: form.get('dueDate')
        })
      });
      setActiveNotification(null);
      await refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!token || !user) {
    return <LoginScreen onLogin={login} error={error} loading={loading} busy={busy} />;
  }

  if (loading || !summary) return <div className="loading-screen">Loading your authorised workspace...</div>;
  const isManager = user.role === 'Gat Shikshan Adhikari';
  const isKendra = user.role === 'Kendra Pramukh';
  const heading = isManager ? 'Block action oversight' : isKendra ? 'My school visits' : 'School action queue';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" aria-label="ShalaSetu dashboard">
          <span className="brand-mark">S</span>
          <span><strong>ShalaSetu</strong><small>VISIT TO CLOSURE</small></span>
        </a>
        <div className="scope-label">YOUR WORKSPACE</div>
        <div className="role-chip"><span className="role-dot" />{user.role}</div>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-item active" href="#dashboard"><span>◫</span> Overview</a>
          <a className="nav-item" href="#schools"><span>⌂</span> {isKendra ? 'Assigned schools' : 'Schools in scope'}</a>
          <a className="nav-item" href="#work"><span>↗</span> {isManager ? 'Visit inbox' : 'Action queue'}</a>
        </nav>
        <div className="sidebar-bottom"><span className="demo-indicator" />Synthetic POC workspace</div>
      </aside>

      <main className="main-panel" id="dashboard">
        <header className="topbar">
          <div><p className="eyebrow">MAHARASHTRA · {user.blockIds.join(', ') || 'SCHOOL'}</p><h1>{heading}</h1><p className="welcome">Good day, {user.name}. Your view is limited to your assigned role and scope.</p></div>
          <div className="top-actions">
            {isKendra && <button className="primary-btn" onClick={() => setShowVisitForm(true)}><span>＋</span> Record visit</button>}
            <button className="icon-btn notification-button" onClick={() => document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' })} aria-label={`${summary.unreadNotifications} unread notifications`} title="Go to notifications">♧{summary.unreadNotifications > 0 && <b>{summary.unreadNotifications}</b>}</button>
            <button className="user-button" onClick={logout} title="Sign out"><span className="avatar">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{user.name}</strong><small>Sign out</small></span></button>
          </div>
        </header>

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}

        {isManager ? <ManagerDashboard summary={summary} schools={schools} onOpen={setActiveNotification} /> : <StaffDashboard summary={summary} schools={schools} isKendra={isKendra} onNewVisit={() => setShowVisitForm(true)} />}
      </main>

      {showVisitForm && <VisitDialog schools={schools} busy={busy} onClose={() => setShowVisitForm(false)} onSubmit={submitVisit} />}
      {activeNotification && <NotificationDialog notification={activeNotification} token={token} busy={busy} onClose={() => setActiveNotification(null)} onReview={reviewNotification} onTask={createTask} />}
    </div>
  );
}

function LoginScreen({ onLogin, error, loading, busy }: { onLogin: (event: FormEvent<HTMLFormElement>) => void; error: string; loading: boolean; busy: boolean }) {
  return (
    <main className="login-page">
      <section className="login-intro"><div className="brand light-brand"><span className="brand-mark">S</span><span><strong>ShalaSetu</strong><small>VISIT TO CLOSURE</small></span></div><p className="eyebrow">MAHARASHTRA · SCHOOL GOVERNANCE</p><h1>Every visit.<br />A clear next step.</h1><p>Record what was found, route follow-up to the right authority, and keep review decisions traceable.</p><div className="intro-rule"><span /> Local JSON-backed POC</div></section>
      <section className="login-side"><form className="login-form" onSubmit={onLogin}><p className="eyebrow">OFFICIAL ACCESS</p><h2>Sign in to ShalaSetu</h2><p className="form-caption">Use one of the demonstration accounts to explore role-specific views.</p>
        <label>Username<input name="username" autoComplete="username" placeholder="e.g. gsa.demo" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter demo password" required /></label>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <button className="primary-btn login-submit" disabled={busy || loading}>{busy || loading ? 'Signing in...' : 'Sign in'} <span>→</span></button>
        <div className="demo-access"><strong>DEMO ACCOUNTS</strong>{demoAccounts.map((account) => <button key={account.username} type="button" onClick={(event) => { const form = event.currentTarget.closest('form'); if (!form) return; (form.elements.namedItem('username') as HTMLInputElement).value = account.username; (form.elements.namedItem('password') as HTMLInputElement).value = demoPassword; }}><span>{account.label}</span><code>{account.username}</code></button>)}<small>Password for each: <code>{demoPassword}</code></small></div>
      </form><footer>Demo records are synthetic and do not represent verified school or officer assignments.</footer></section>
    </main>
  );
}

function Metric({ label, value, note, tone = '' }: { label: string; value: number; note: string; tone?: string }) {
  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function ManagerDashboard({ summary, schools, onOpen }: { summary: Summary; schools: School[]; onOpen: (item: Notification) => void }) {
  const pending = summary.notifications.filter((item) => item.status === 'Awaiting review');
  return <>
    <section className="metrics-grid"><Metric label="Schools in block" value={summary.schoolCount} note="Within your authorised scope" /><Metric label="Open actions" value={summary.openActions} note="Assigned work not yet closed" /><Metric label="Overdue" value={summary.overdueActions} note="Past the stated due date" tone="metric-red" /><Metric label="Reports to review" value={pending.length} note="Submitted by Kendra Pramukhs" tone="metric-amber" /></section>
    <section className="dashboard-grid manager-grid">
      <div className="panel" id="work"><div className="panel-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h2>Visit reports</h2></div><span className="count-badge">{pending.length} pending</span></div>
        {summary.notifications.length ? <div className="inbox-list">{summary.notifications.slice().reverse().map((notification) => <article className="inbox-item" key={notification.id}><div className="inbox-icon">↗</div><div className="inbox-copy"><div className="inbox-title"><strong>{notification.title}</strong><span className={`status-tag ${notification.status === 'Awaiting review' ? 'tag-pending' : 'tag-done'}`}>{notification.status}</span></div><p>{notification.message}</p><small>{dateLabel(notification.createdAt)} · {schools.find((school) => school.id === notification.schoolId)?.block || 'Block scope'}</small></div>{notification.status === 'Awaiting review' && <button className="text-button" onClick={() => onOpen(notification)}>Review <span>→</span></button>}</article>)}</div> : <EmptyState title="No reports in your inbox" detail="A notification will appear when an assigned Kendra Pramukh submits a visit." />}
      </div>
      <section className="panel" id="schools"><div className="panel-heading"><div><p className="eyebrow">AUTHORISED SCOPE</p><h2>Schools in block</h2></div><span className="count-badge">{schools.length}</span></div><SchoolList schools={schools} /></section>
    </section>
    <section className="panel manager-actions"><div className="panel-heading"><div><p className="eyebrow">FOLLOW-UP</p><h2>Current action queue</h2></div><span className="count-badge">{summary.actions.length} tasks</span></div><ActionList actions={summary.actions} />
    </section>
  </>;
}

function StaffDashboard({ summary, schools, isKendra, onNewVisit }: { summary: Summary; schools: School[]; isKendra: boolean; onNewVisit: () => void }) {
  return <>
    <section className="metrics-grid"><Metric label={isKendra ? 'Assigned schools' : 'School assignment'} value={summary.schoolCount} note={isKendra ? 'Your current portfolio' : 'Assigned to your account'} /><Metric label={isKendra ? 'Visits submitted' : 'Visits in school record'} value={summary.visitCount} note="Submitted visit records" /><Metric label="Open actions" value={summary.openActions} note="Work requiring progress" /><Metric label="Blocked" value={summary.blockedActions} note="Needs an authorised route" tone="metric-amber" /></section>
    <section className="dashboard-grid staff-grid"><section className="panel" id="schools"><div className="panel-heading"><div><p className="eyebrow">YOUR PORTFOLIO</p><h2>Assigned schools</h2></div>{isKendra && <button className="primary-btn compact-btn" onClick={onNewVisit}>＋ Record visit</button>}</div><SchoolList schools={schools} /></section>
      <section className="panel" id="work"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>{isKendra ? 'Submitted visits' : 'School visits'}</h2></div><span className="count-badge">{summary.recentVisits.length}</span></div>{summary.recentVisits.length ? <div className="visit-list">{summary.recentVisits.map((visit) => <article className="visit-row" key={visit.id}><span className="visit-mark">V</span><div><strong>{visit.purpose}</strong><small>{dateLabel(visit.visitDate)} · {visit.checklist}</small></div><span className={`status-tag ${visit.reviewStatus ? 'tag-done' : 'tag-pending'}`}>{visit.reviewStatus || 'Submitted'}</span></article>)}</div> : <EmptyState title="No visits yet" detail={isKendra ? 'Record a school visit to begin a traceable follow-up.' : 'New school reports will appear here.'} />}</section>
    </section>
    <section className="panel manager-actions"><div className="panel-heading"><div><p className="eyebrow">TASKS</p><h2>{isKendra ? 'Follow-up actions' : 'Your action queue'}</h2></div><span className="count-badge">{summary.actions.length}</span></div><ActionList actions={summary.actions} /></section>
  </>;
}

function SchoolList({ schools }: { schools: School[] }) {
  if (!schools.length) return <EmptyState title="No schools assigned" detail="Your administrator has not assigned a school to this account." />;
  return <div className="school-list">{schools.map((school) => <article className="school-row" key={school.id}><span className="school-icon">⌂</span><div className="school-details"><strong>{school.name}</strong><small>{school.block} block · {school.cluster} cluster · {school.category}</small></div><span className="udise-label">{school.udiseCode}</span></article>)}</div>;
}

function ActionList({ actions }: { actions: Action[] }) {
  if (!actions.length) return <EmptyState title="No assigned tasks" detail="Tasks appear here once an authorised reviewer assigns an owner and due date." />;
  return <div className="action-list">{actions.map((action) => <article className="action-row" key={action.id}><div><strong>{action.title}</strong><small>{action.expectedOutcome}</small></div><span>{action.ownerName || action.ownerRole}</span><span className={`status-tag status-${action.status.toLowerCase().replace(/\s+/g, '-')}`}>{action.status}</span><time>{dateLabel(action.dueDate)}</time></article>)}</div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><strong>{title}</strong><p>{detail}</p></div>; }

function VisitDialog({ schools, busy, onClose, onSubmit }: { schools: School[]; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="visit-dialog-title"><div className="dialog-heading"><div><p className="eyebrow">FIELD VISIT</p><h2 id="visit-dialog-title">Submit visit report</h2></div><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div><p className="dialog-intro">Submitting sends a review notification to your configured Gat Shikshan Adhikari.</p>
    <form className="dialog-form" onSubmit={onSubmit}><div className="form-grid"><label>Assigned school<select name="schoolId" required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><label>Visit date<input name="visitDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Purpose<input name="purpose" placeholder="e.g. Routine inspection" required /></label><label>Checklist<select name="checklist"><option>School Safety Check</option><option>Follow-up Review</option><option>Infrastructure Audit</option></select></label><label>Finding category<select name="category"><option>Water, Sanitation and Hygiene</option><option>Safety &amp; Access</option><option>Infrastructure</option><option>Teaching and Learning</option><option>Other</option></select></label><label>Severity<select name="severity"><option>Medium</option><option>Low</option><option>High</option><option>Critical</option></select></label><label className="full-field">Finding description<textarea name="description" rows={3} placeholder="Describe the observed issue" required /></label><label>Expected outcome<input name="expectedOutcome" placeholder="What should be resolved?" /></label><label>Requested due date<input name="dueDate" type="date" defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)} required /></label></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={onClose}>Cancel</button><button className="primary-btn" disabled={busy}>{busy ? 'Submitting...' : 'Submit report'} <span>→</span></button></div></form>
  </section></div>;
}

function NotificationDialog({ notification, token, busy, onClose, onReview, onTask }: { notification: Notification; token: string; busy: boolean; onClose: () => void; onReview: (notification: Notification, decision: 'Approve' | 'Raise concern', note?: string) => void; onTask: (event: FormEvent<HTMLFormElement>, notification: Notification) => void }) {
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [ownerError, setOwnerError] = useState('');
  const [report, setReport] = useState<ReportDetails | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    request<{ owners: { id: string; name: string }[] }>(`/schools/${notification.schoolId}/action-owners`, token)
      .then((result) => setOwners(result.owners))
      .catch((requestError: Error) => setOwnerError(requestError.message));
  }, [notification.schoolId, token]);
  useEffect(() => {
    let cancelled = false;
    setReportLoading(true);
    setReportError('');
    request<ReportDetails & { notification: Notification }>(`/notifications/${notification.id}/report`, token)
      .then((details) => { if (!cancelled) setReport(details); })
      .catch((requestError: Error) => { if (!cancelled) setReportError(requestError.message); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [notification.id, token]);

  return <div className="modal-backdrop" role="presentation">
    <section className="dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
      <div className="dialog-heading"><div><p className="eyebrow">MANAGER REVIEW</p><h2 id="review-dialog-title">Review visit report</h2></div><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
      <p className="dialog-intro">{notification.message}</p>
      {reportLoading && <p className="report-loading">Loading submitted report...</p>}
      {reportError && <div className="report-error" role="alert">Could not load report details: {reportError}</div>}
      {report && <ReportDetailsView report={report} />}
      <div className="review-options">
        <button className="review-option approve-option" disabled={busy || !report} onClick={() => onReview(notification, 'Approve')}><span>✓</span><strong>Approve report</strong><small>Record that the report was reviewed.</small></button>
        <form className="review-option concern-option" onSubmit={(event) => { event.preventDefault(); const note = new FormData(event.currentTarget).get('note') as string; onReview(notification, 'Raise concern', note); }}><strong>Raise a concern</strong><textarea name="note" rows={2} placeholder="Explain what needs clarification" required /><button className="secondary-btn" disabled={busy || !report}>Send concern</button></form>
      </div>
      <form className="task-form" onSubmit={(event) => onTask(event, notification)}><h3>Assign a follow-up task</h3><p>Task ownership is confirmed by you; no task is assigned automatically.</p><div className="form-grid"><label className="full-field">Task title<input name="title" required /></label><label className="full-field">Expected outcome<input name="expectedOutcome" required /></label><label>Authorised school owner<select name="ownerId" required disabled={!owners.length}><option value="">{owners.length ? 'Select headmaster' : 'No assigned headmaster available'}</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select>{ownerError && <small className="field-error">{ownerError}</small>}</label><label>Due date<input name="dueDate" type="date" min={new Date().toISOString().slice(0, 10)} required /></label></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={onClose}>Close</button><button className="primary-btn" disabled={busy || !owners.length || !report}>Create task</button></div></form>
    </section>
  </div>;
}

function ReportDetailsView({ report }: { report: ReportDetails }) {
  return <section className="submitted-report" aria-label="Submitted visit details">
    <div className="report-facts">
      <div><span>School</span><strong>{report.school.name}</strong></div>
      <div><span>Visit date</span><strong>{dateLabel(report.visit.visitDate)}</strong></div>
      <div><span>Reported by</span><strong>{report.visit.officerName}</strong></div>
      <div><span>Purpose</span><strong>{report.visit.purpose}</strong></div>
      <div><span>Checklist</span><strong>{report.visit.checklist}</strong></div>
      <div><span>Submitted</span><strong>{dateLabel(report.visit.submittedAt)}</strong></div>
    </div>
    <div className="report-findings">
      <h3>Submitted findings <span>{report.findings.length}</span></h3>
      {report.findings.length ? report.findings.map((finding) => <article className="report-finding" key={finding.id}>
        <div className="finding-heading"><strong>{finding.category}</strong><span className={`severity severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span></div>
        <p>{finding.description}</p>
        <small>Status: {finding.status}</small>
      </article>) : <p className="report-loading">This visit has no findings recorded.</p>}
    </div>
  </section>;
}

export default App;
