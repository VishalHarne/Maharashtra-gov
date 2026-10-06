import React, { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Role = 'Kendra Pramukh' | 'Headmaster' | 'Gat Shikshan Adhikari';
type User = { id: string; username: string; name: string; role: Role; assignedSchoolIds: string[]; blockIds: string[] };
type School = { id: string; name: string; block: string; district: string; udiseCode: string };
type Notification = { id: string; schoolId: string; visitId: string; title: string; message: string; status: string; createdAt: string };
type Action = { id: string; title: string; ownerName: string; ownerRole: string; expectedOutcome: string; dueDate: string; status: string };
type Visit = { id: string; purpose: string; visitDate: string; checklist: string; reviewStatus?: string };
type Summary = { schoolCount: number; visitCount: number; openActions: number; overdueActions: number; blockedActions: number; awaitingVerification: number; unreadNotifications: number; notifications: Notification[]; recentVisits: Visit[]; actions: Action[] };
type Session = { token: string; user: User; summary: Summary; schools: School[] };

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const DEMO_PASSWORD = 'Demo@123';

async function api<T>(path: string, token = '', init: RequestInit = {}): Promise<T> {
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
    throw new Error(body.error || `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('gsa.demo');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visitForm, setVisitForm] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('Routine inspection');
  const [finding, setFinding] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [notificationId, setNotificationId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskOutcome, setTaskOutcome] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [ownerId, setOwnerId] = useState('');
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);

  const loadWorkspace = async (token: string): Promise<Session> => {
    const [me, summary, directory] = await Promise.all([
      api<{ user: User }>('/auth/me', token),
      api<Summary>('/dashboard/summary', token),
      api<{ schools: School[] }>('/schools', token)
    ]);
    return { token, user: me.user, summary, schools: directory.schools };
  };

  const signIn = async (selectedUsername = username) => {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ token: string }>('/auth/login', '', {
        method: 'POST', body: JSON.stringify({ username: selectedUsername, password })
      });
      setSession(await loadWorkspace(result.token));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!session) return;
    try { setSession(await loadWorkspace(session.token)); }
    catch (requestError) { setError((requestError as Error).message); }
  };

  useEffect(() => {
    if (!session || !notificationId) return;
    api<{ owners: { id: string; name: string }[] }>(`/schools/${session.summary.notifications.find((item) => item.id === notificationId)?.schoolId}/action-owners`, session.token)
      .then((result) => { setOwners(result.owners); setOwnerId(result.owners[0]?.id || ''); })
      .catch((requestError: Error) => setError(requestError.message));
  }, [notificationId, session?.token]);

  const logout = async () => {
    if (session) {
      try { await api('/auth/logout', session.token, { method: 'POST' }); } catch { /* Clear the current client session. */ }
    }
    setSession(null);
    setNotificationId('');
  };

  const submitVisit = async () => {
    if (!session || !session.schools[0] || !finding.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api('/visits', session.token, {
        method: 'POST',
        body: JSON.stringify({
          schoolId: session.schools[0].id, visitDate, purpose, checklist: 'School Safety Check',
          finding: { category: 'Infrastructure', description: finding.trim(), severity: 'Medium', dueDate, expectedOutcome: 'Resolve the issue and provide supporting evidence.' }
        })
      });
      setVisitForm(false);
      setFinding('');
      await refresh();
      Alert.alert('Report submitted', 'Your Gat Shikshan Adhikari has been notified.');
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (decision: 'Approve' | 'Raise concern') => {
    if (!session || !notificationId) return;
    setBusy(true);
    try {
      await api(`/notifications/${notificationId}/respond`, session.token, {
        method: 'POST', body: JSON.stringify({ decision, note: decision === 'Raise concern' ? 'Please clarify the evidence and expected resolution.' : undefined })
      });
      setNotificationId('');
      await refresh();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally { setBusy(false); }
  };

  const createTask = async () => {
    if (!session || !notificationId || !ownerId) return;
    setBusy(true);
    try {
      await api(`/notifications/${notificationId}/tasks`, session.token, {
        method: 'POST', body: JSON.stringify({ title: taskTitle, expectedOutcome: taskOutcome, dueDate: taskDueDate, ownerId })
      });
      setNotificationId('');
      setTaskTitle('');
      setTaskOutcome('');
      await refresh();
      Alert.alert('Task assigned', 'The selected headmaster will see this task in their queue.');
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally { setBusy(false); }
  };

  if (!session) {
    return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.loginContainer}>
      <View style={styles.loginHero}><Text style={styles.brand}>ShalaSetu</Text><Text style={styles.heroCaption}>VISIT TO CLOSURE · MAHARASHTRA</Text><Text style={styles.heroTitle}>Every visit.{ '\n' }A clear next step.</Text></View>
      <View style={styles.loginCard}><Text style={styles.sectionTitle}>Official access</Text><Text style={styles.subtle}>Sign in to your role-specific workspace.</Text>
        <Text style={styles.inputLabel}>Username</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" style={styles.input} placeholder="gsa.demo" />
        <Text style={styles.inputLabel}>Password</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button title={busy ? 'Signing in...' : 'Sign in'} onPress={() => signIn()} disabled={busy} />
        <Text style={styles.inputLabel}>DEMO ACCOUNTS · password {DEMO_PASSWORD}</Text>
        {(['gsa.demo', 'kp.demo', 'hm.demo']).map((account) => <Pressable key={account} style={styles.demoButton} onPress={() => { setUsername(account); signIn(account); }}><Text style={styles.demoText}>{account} →</Text></Pressable>)}
        <Text style={styles.disclaimer}>Synthetic POC records only. School assignments are illustrative, not verified.</Text>
      </View>
    </ScrollView></SafeAreaView>;
  }

  const { user, summary, schools } = session;
  const manager = user.role === 'Gat Shikshan Adhikari';
  const kendra = user.role === 'Kendra Pramukh';
  const pendingNotifications = summary.notifications.filter((item) => item.status === 'Awaiting review');

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.headerRow}><View><Text style={styles.brand}>ShalaSetu</Text><Text style={styles.subtitle}>{user.role} · {user.blockIds.join(', ') || 'Assigned school'}</Text></View><Pressable onPress={logout}><Text style={styles.logout}>Sign out</Text></Pressable></View>
    <Text style={styles.pageTitle}>{manager ? 'Block action oversight' : kendra ? 'My school visits' : 'School action queue'}</Text>
    <Text style={styles.subtle}>Welcome, {user.name}. Showing records within your authorised scope.</Text>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
    <View style={styles.metricsGrid}><Metric label={manager ? 'Schools in block' : 'Assigned schools'} value={summary.schoolCount} /><Metric label={manager ? 'Reports to review' : 'Visits submitted'} value={manager ? pendingNotifications.length : summary.visitCount} /><Metric label="Open actions" value={summary.openActions} /><Metric label={manager ? 'Overdue' : 'Blocked'} value={manager ? summary.overdueActions : summary.blockedActions} /></View>

    {kendra && <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Assigned schools</Text><Button title="＋ Visit" onPress={() => setVisitForm(!visitForm)} /></View>
      {schools.map((school) => <SchoolCard key={school.id} school={school} />)}
      {visitForm && <View style={styles.formCard}><Text style={styles.cardTitle}>Submit visit report</Text><TextInput value={visitDate} onChangeText={setVisitDate} style={styles.input} placeholder="Visit date YYYY-MM-DD" /><TextInput value={purpose} onChangeText={setPurpose} style={styles.input} placeholder="Purpose" /><TextInput value={finding} onChangeText={setFinding} style={[styles.input, styles.multiline]} multiline placeholder="Describe the finding" /><TextInput value={dueDate} onChangeText={setDueDate} style={styles.input} placeholder="Action due date YYYY-MM-DD" /><Button title={busy ? 'Submitting...' : 'Submit and notify manager'} onPress={submitVisit} disabled={busy || !finding.trim()} /></View>}
    </View>}

    {manager && <View style={styles.section}><Text style={styles.sectionTitle}>Visit review inbox</Text>{summary.notifications.length ? summary.notifications.slice().reverse().map((notice) => <View key={notice.id} style={styles.card}><Text style={styles.cardTitle}>{notice.title}</Text><Text style={styles.actionMeta}>{notice.message}</Text><Text style={styles.status}>{notice.status}</Text>{notice.status === 'Awaiting review' && <Button title="Review report" onPress={() => setNotificationId(notice.id)} />}</View>) : <Empty title="No reports awaiting review" />}
      {notificationId ? <View style={styles.formCard}><Text style={styles.cardTitle}>Manager decision and follow-up</Text><Text style={styles.inputLabel}>Task title</Text><TextInput value={taskTitle} onChangeText={setTaskTitle} style={styles.input} placeholder="Describe the task" /><Text style={styles.inputLabel}>Expected outcome</Text><TextInput value={taskOutcome} onChangeText={setTaskOutcome} style={styles.input} placeholder="State the result to verify" /><Text style={styles.inputLabel}>Due date YYYY-MM-DD</Text><TextInput value={taskDueDate} onChangeText={setTaskDueDate} style={styles.input} /><Text style={styles.inputLabel}>Authorised school owner</Text>{owners.map((owner) => <Pressable key={owner.id} onPress={() => setOwnerId(owner.id)} style={[styles.ownerChoice, ownerId === owner.id && styles.ownerSelected]}><Text style={styles.ownerText}>{ownerId === owner.id ? '● ' : '○ '}{owner.name}</Text></Pressable>)}<Button title="Assign task" onPress={createTask} disabled={busy || !taskTitle.trim() || !taskOutcome.trim() || !ownerId} /><View style={styles.buttonRow}><Button title="Approve report" onPress={() => respond('Approve')} disabled={busy} /><Button title="Raise concern" variant="secondary" onPress={() => respond('Raise concern')} disabled={busy} /></View></View> : null}
    </View>}

    {!manager && !kendra && <View style={styles.section}><Text style={styles.sectionTitle}>School visits</Text>{summary.recentVisits.map((visit) => <View key={visit.id} style={styles.card}><Text style={styles.cardTitle}>{visit.purpose}</Text><Text style={styles.actionMeta}>{visit.visitDate} · {visit.checklist}</Text><Text style={styles.status}>{visit.reviewStatus || 'Submitted'}</Text></View>)}</View>}

    {!kendra && <View style={styles.section}><Text style={styles.sectionTitle}>Schools in your scope</Text>{schools.map((school) => <SchoolCard key={school.id} school={school} />)}</View>}
    <View style={styles.section}><Text style={styles.sectionTitle}>{kendra ? 'Follow-up actions' : manager ? 'Block action queue' : 'Your tasks'}</Text>{summary.actions.length ? summary.actions.map((action) => <View key={action.id} style={styles.card}><View style={styles.actionHeader}><Text style={styles.cardTitle}>{action.title}</Text><Text style={styles.status}>{action.status}</Text></View><Text style={styles.actionMeta}>{action.ownerName || action.ownerRole} · Due {action.dueDate}</Text><Text style={styles.actionMeta}>{action.expectedOutcome}</Text></View>) : <Empty title="No assigned tasks yet" />}</View>
  </ScrollView></SafeAreaView>;
}

function Metric({ label, value }: { label: string; value: number }) { return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function SchoolCard({ school }: { school: School }) { return <View style={styles.card}><Text style={styles.cardTitle}>{school.name}</Text><Text style={styles.actionMeta}>{school.block} · {school.district} · UDISE {school.udiseCode}</Text></View>; }
function Empty({ title }: { title: string }) { return <View style={styles.empty}><Text style={styles.subtle}>{title}</Text></View>; }
function Button({ title, onPress, disabled = false, variant = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, variant === 'secondary' && styles.secondaryButton, disabled && styles.disabledButton]}><Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{title}</Text></Pressable>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f2f5f1' },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40, gap: 15 },
  loginContainer: { flexGrow: 1, paddingBottom: 30 },
  loginHero: { paddingHorizontal: 24, paddingTop: 45, paddingBottom: 34, backgroundColor: '#194733' },
  brand: { color: '#1b4936', fontSize: 25, fontWeight: '800' },
  heroCaption: { marginTop: 5, color: '#c0d1c1', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  heroTitle: { marginTop: 34, color: '#f4f5ed', fontSize: 34, fontWeight: '800', lineHeight: 40 },
  loginCard: { margin: 18, marginTop: -1, padding: 20, borderWidth: 1, borderColor: '#e4e9e4', borderRadius: 7, backgroundColor: '#fff', gap: 10 },
  sectionTitle: { color: '#26372c', fontSize: 17, fontWeight: '700' },
  subtle: { color: '#738078', fontSize: 12, lineHeight: 18 },
  inputLabel: { marginTop: 5, color: '#526258', fontSize: 11, fontWeight: '700' },
  input: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: '#dfe6df', borderRadius: 4, color: '#26352a', backgroundColor: '#fff', fontSize: 13 },
  multiline: { minHeight: 85, paddingTop: 10, textAlignVertical: 'top' },
  button: { minHeight: 41, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 13, borderRadius: 4, backgroundColor: '#206548' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#dce5dc', backgroundColor: '#fff' },
  secondaryButtonText: { color: '#385642' },
  disabledButton: { opacity: 0.5 },
  demoButton: { padding: 10, borderWidth: 1, borderColor: '#e7ece7', borderRadius: 4, backgroundColor: '#fafcf9' },
  demoText: { color: '#395b43', fontSize: 12, fontWeight: '600' },
  disclaimer: { marginTop: 5, color: '#818d83', fontSize: 10, lineHeight: 15 },
  errorText: { padding: 9, borderRadius: 4, color: '#853d32', backgroundColor: '#faece8', fontSize: 11 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtitle: { marginTop: 3, color: '#687a6e', fontSize: 11 },
  logout: { padding: 8, color: '#47634f', fontSize: 11, fontWeight: '700' },
  pageTitle: { marginTop: 6, color: '#20372a', fontSize: 23, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metricCard: { flexGrow: 1, flexBasis: '45%', minHeight: 83, padding: 12, borderWidth: 1, borderColor: '#e3e9e3', borderRadius: 6, backgroundColor: '#fff' },
  metricLabel: { color: '#6f7f73', fontSize: 10, fontWeight: '600' },
  metricValue: { marginTop: 7, color: '#285b3c', fontSize: 23, fontWeight: '800' },
  section: { gap: 9, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { padding: 13, borderWidth: 1, borderColor: '#e4eae4', borderRadius: 6, backgroundColor: '#fff', gap: 7 },
  formCard: { padding: 14, borderWidth: 1, borderColor: '#dce7dd', borderRadius: 6, backgroundColor: '#fff', gap: 10 },
  cardTitle: { flex: 1, color: '#27382c', fontSize: 13, fontWeight: '700' },
  actionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionMeta: { color: '#718076', fontSize: 11, lineHeight: 16 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4, color: '#8b5b2d', backgroundColor: '#faf0df', fontSize: 9, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 8 },
  ownerChoice: { padding: 10, borderWidth: 1, borderColor: '#e2e9e2', borderRadius: 4 },
  ownerSelected: { borderColor: '#6c9575', backgroundColor: '#eff6ef' },
  ownerText: { color: '#405547', fontSize: 11 },
  empty: { padding: 18, alignItems: 'center' }
});
