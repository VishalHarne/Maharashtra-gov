export type Role = 'Kendra Pramukh' | 'Headmaster' | 'Gat Shikshan Adhikari';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ActionStatus = 'Open' | 'In Progress' | 'Blocked' | 'Awaiting Verification' | 'Closed';

export type School = {
  id: string;
  udiseCode: string;
  name: string;
  district: string;
  block: string;
  cluster: string;
  category: string;
  enrollment: number;
};

export type Finding = {
  id: string;
  visitId: string;
  category: string;
  description: string;
  severity: Severity;
  actionRequired: boolean;
  status: 'Open' | 'Resolved';
};

export type ActionItem = {
  id: string;
  findingId: string;
  schoolId: string;
  owner: string;
  ownerRole: Role;
  title: string;
  expectedOutcome: string;
  dueDate: string;
  status: ActionStatus;
  blockedReason?: string;
  lastUpdated: string;
  priority: 'Low' | 'Medium' | 'High';
};

export type VisitRecord = {
  id: string;
  schoolId: string;
  officerName: string;
  date: string;
  purpose: string;
  checklist: 'School Safety Check' | 'Follow-up Review' | 'Infrastructure Audit';
};

export const schools: School[] = [
  {
    id: 'school-001',
    udiseCode: '27210101201',
    name: 'Zilla Parishad School, Pune',
    district: 'Pune',
    block: 'Haveli',
    cluster: 'Kharadi',
    category: 'Primary School',
    enrollment: 420
  },
  {
    id: 'school-002',
    udiseCode: '27280102012',
    name: 'Government High School, Nashik',
    district: 'Nashik',
    block: 'Pimpalgaon',
    cluster: 'Nashik Rural',
    category: 'Secondary School',
    enrollment: 610
  },
  {
    id: 'school-003',
    udiseCode: '27040401831',
    name: 'Municipal School, Aurangabad',
    district: 'Aurangabad',
    block: 'Sillod',
    cluster: 'Aurangabad East',
    category: 'Upper Primary',
    enrollment: 350
  },
  {
    id: 'school-004',
    udiseCode: '27160105641',
    name: 'Shivaji Vidyalaya, Kolhapur',
    district: 'Kolhapur',
    block: 'Karvir',
    cluster: 'Kolhapur Urban',
    category: 'Secondary School',
    enrollment: 540
  },
  {
    id: 'school-005',
    udiseCode: '27320801482',
    name: 'Rural School, Solapur',
    district: 'Solapur',
    block: 'Barshi',
    cluster: 'South Solapur',
    category: 'Primary School',
    enrollment: 280
  }
];

export const visits: VisitRecord[] = [
  {
    id: 'visit-001',
    schoolId: 'school-001',
    officerName: 'Asha Ingle',
    date: '2026-09-12',
    purpose: 'Routine inspection',
    checklist: 'School Safety Check'
  },
  {
    id: 'visit-002',
    schoolId: 'school-002',
    officerName: 'Ritesh Patil',
    date: '2026-09-18',
    purpose: 'Follow-up review',
    checklist: 'Follow-up Review'
  },
  {
    id: 'visit-003',
    schoolId: 'school-003',
    officerName: 'Nitin Kulkarni',
    date: '2026-09-21',
    purpose: 'Infrastructure audit',
    checklist: 'Infrastructure Audit'
  }
];

export const findings: Finding[] = [
  {
    id: 'finding-001',
    visitId: 'visit-001',
    category: 'Water, Sanitation and Hygiene',
    description: 'Toilet block is not functional and lacks running water.',
    severity: 'High',
    actionRequired: true,
    status: 'Open'
  },
  {
    id: 'finding-002',
    visitId: 'visit-002',
    category: 'Safety & Access',
    description: 'Boundary wall is damaged near the main gate.',
    severity: 'Medium',
    actionRequired: true,
    status: 'Open'
  },
  {
    id: 'finding-003',
    visitId: 'visit-003',
    category: 'Infrastructure',
    description: 'Classroom roof leakage noted during monsoon season.',
    severity: 'Critical',
    actionRequired: true,
    status: 'Open'
  }
];

export const actions: ActionItem[] = [
  {
    id: 'action-001',
    findingId: 'finding-001',
    schoolId: 'school-001',
    owner: 'Sharda Joshi',
    ownerRole: 'Headmaster',
    title: 'Repair toilets and restore water supply',
    expectedOutcome: 'Functional toilet units with safe water access',
    dueDate: '2026-10-10',
    status: 'In Progress',
    lastUpdated: '2026-09-29T09:20:00Z',
    priority: 'High'
  },
  {
    id: 'action-002',
    findingId: 'finding-002',
    schoolId: 'school-002',
    owner: 'Sanjay Bhosale',
    ownerRole: 'Headmaster',
    title: 'Repair boundary wall at entrance',
    expectedOutcome: 'Secure gate and repaired wall sections',
    dueDate: '2026-10-05',
    status: 'Blocked',
    blockedReason: 'Awaiting local contractor approval and material estimate',
    lastUpdated: '2026-09-27T14:00:00Z',
    priority: 'Medium'
  },
  {
    id: 'action-003',
    findingId: 'finding-003',
    schoolId: 'school-003',
    owner: 'Vikas Mehta',
    ownerRole: 'Gat Shikshan Adhikari',
    title: 'Escalate roof repair to civil works',
    expectedOutcome: 'Repair completed and verified by reviewer',
    dueDate: '2026-10-08',
    status: 'Awaiting Verification',
    lastUpdated: '2026-09-30T11:15:00Z',
    priority: 'High'
  }
];

export const dashboardSummary = {
  open: 8,
  overdue: 3,
  blocked: 2,
  awaitingVerification: 4,
  schoolsAssigned: 5,
  followUpVisits: 11
};

export const userRoles: Role[] = ['Kendra Pramukh', 'Headmaster', 'Gat Shikshan Adhikari'];
