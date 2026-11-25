export type UserRole = 'quality_manager' | 'auditor' | 'auditee' | 'executive';

export type ActivityType = 'testing' | 'calibration' | 'management';

export type AuditMethod = 'horizontal' | 'vertical' | 'witness';

export type FindingResult = 'C' | 'CAR' | 'NC' | 'OB';

export type SourceType =
  | 'internal_audit'
  | 'management_review'
  | 'external_audit'
  | 'complaint'
  | 'staff_observation'
  | 'other';

export type RecordStatus = 'open' | 'responded' | 'closed' | 'reissued';

export type VerificationResult = 'pending' | 'effective' | 'ineffective';

export type ComplianceStatus = 'compliant' | 'warning' | 'non_compliant';

export type AlertCategory =
  | 'equipment_calibration'
  | 'measurement_drift'
  | 'environmental'
  | 'car_overdue'
  | 'audit_nc';

export type AlertSeverity = 'critical' | 'warning';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export type WorkspaceTab =
  | 'dashboard'
  | 'program_schedule'
  | 'audit_execution'
  | 'car_par'
  | 'equipment_trends'
  | 'security_trail';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  inviteId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleInvite {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  assignedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditProgramItem {
  id: string;
  yearBE: number;
  sequence: number;
  activity: string;
  activityType: ActivityType;
  months: boolean[]; // 12 months: Jan..Dec
  remarks?: string;
  preparedBy: string;
  preparedDate?: string;
  approvedBy?: string;
  approvedDate?: string;
  status: 'draft' | 'approved';
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditScheduleItem {
  id: string;
  auditRound: string; // e.g. "1/2569"
  yearBE: number;
  auditDate: string; // ISO YYYY-MM-DD
  timeRange: string; // e.g. "09:00 - 12:00"
  activity: string;
  activityType: ActivityType;
  criteria: string;
  auditorName: string;
  auditeeName: string;
  status: 'planned' | 'in_progress' | 'completed' | 'rescheduled';
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditChecklistItem {
  id: string;
  auditRound: string;
  yearBE: number;
  department: string;
  activity: string;
  activityType: ActivityType;
  auditMethod: AuditMethod;
  auditDate: string;
  sequence: number;
  clause: string;
  checkItem: string;
  result: FindingResult;
  detail?: string;
  remarks?: string;
  auditorName: string;
  auditeeName: string;
  linkedDocNo?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarRecord {
  id: string;
  carNo: string;
  recordType: 'CAR' | 'NC';
  sourceType: SourceType;
  sourceRef?: string;
  part1Detail: string;
  clause: string;
  activityType: ActivityType;
  finderName: string;
  foundDate: string;
  expansionHasIssue?: boolean;
  expansionCause?: string;
  rootCause?: string;
  impactHasEffect?: boolean;
  impactDetail?: string;
  riskLikelihood?: number; // 1-4
  riskSeverity?: number; // 1-4
  riskScore?: number; // 1-16
  riskFm17Required?: boolean; // >= 9
  correctiveAction?: string;
  correctiveDueDate?: string;
  preventiveAction?: string;
  preventiveDueDate?: string;
  responseDueDate?: string;
  extensionCount?: number; // max 2
  responsiblePerson?: string;
  verificationResult: VerificationResult;
  verificationDetail?: string;
  linkedNewCarNo?: string;
  linkedParentCarNo?: string;
  verifierName?: string;
  verifyDate?: string;
  status: RecordStatus;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParRecord {
  id: string;
  parNo: string;
  sourceType: SourceType;
  sourceRef?: string;
  clause: string;
  activityType: ActivityType;
  part1Detail: string;
  proposerName: string;
  proposedDate: string;
  preventiveAction?: string;
  expectedDueDate?: string;
  responsiblePerson?: string;
  verificationResult: VerificationResult;
  verificationDetail?: string;
  linkedNewParNo?: string;
  linkedParentParNo?: string;
  status: RecordStatus;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  category: 'testing' | 'calibration' | 'environment';
  clause: string;
  department: string;
  lastCalDate: string;
  nextCalDate: string;
  nominalValue: number;
  tolerance: number;
  lastMeasuredValue: number;
  unit: string;
  ptZScore?: number;
  status: ComplianceStatus;
  remarks?: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviationAlert {
  id: string;
  alertCode: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  clause: string;
  relatedCode?: string;
  measuredValue?: string;
  thresholdValue?: string;
  status: AlertStatus;
  acknowledgedBy?: string;
  resolvedCarNo?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditTrailEntry {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetCollection: string;
  targetCode: string;
  summary: string;
  createdAt: string;
}

export interface IsoClauseMeta {
  clause: string;
  titleTh: string;
  group: string;
  isHeader?: boolean;
}

/**
 * Exact 29 clauses + 5 group headers from FM-LB-025 Rev.01/13-07-2566
 */
export const FM_LB_025_CLAUSES: IsoClauseMeta[] = [
  { clause: '4', titleTh: '4. ข้อกำหนดทั่วไป', group: '4', isHeader: true },
  { clause: '4.1', titleTh: '4.1 ความเป็นกลาง', group: '4' },
  { clause: '4.2', titleTh: '4.2 การรักษาความลับ', group: '4' },
  { clause: '5', titleTh: '5. ข้อกำหนดด้านโครงสร้าง', group: '5' },
  { clause: '6', titleTh: '6. ข้อกำหนดด้านทรัพยากร', group: '6', isHeader: true },
  { clause: '6.1', titleTh: '6.1 ทั่วไป', group: '6' },
  { clause: '6.2', titleTh: '6.2 บุคลากร', group: '6' },
  { clause: '6.3', titleTh: '6.3 สิ่งอำนวยความสะดวกและภาวะแวดล้อม', group: '6' },
  { clause: '6.4', titleTh: '6.4 เครื่องมือ', group: '6' },
  { clause: '6.5', titleTh: '6.5 ความสอบกลับได้ทางมาตรวิทยา', group: '6' },
  { clause: '6.6', titleTh: '6.6 การจัดซื้อและใช้บริการ', group: '6' },
  { clause: '7', titleTh: '7. ข้อกำหนดด้านกระบวนการ', group: '7', isHeader: true },
  { clause: '7.1', titleTh: '7.1 การทบทวนคำขอข้อเสนอ การประมูลและข้อสัญญา', group: '7' },
  { clause: '7.2', titleTh: '7.2 การคัดเลือก การทวนสอบและการตรวจสอบความใช้ได้ของวิธี', group: '7' },
  { clause: '7.3', titleTh: '7.3 การชักตัวอย่าง', group: '7' },
  { clause: '7.4', titleTh: '7.4 การจัดการตัวอย่างทดสอบ', group: '7' },
  { clause: '7.5', titleTh: '7.5 บันทึกทางวิชาการ', group: '7' },
  { clause: '7.6', titleTh: '7.6 การประเมินค่าความไม่แน่นอนในการวัด', group: '7' },
  { clause: '7.7', titleTh: '7.7 การประกันความใช้ได้ของผลการทดสอบ', group: '7' },
  { clause: '7.8', titleTh: '7.8 การรายงานผลการทดสอบ', group: '7' },
  { clause: '7.9', titleTh: '7.9 ข้อร้องเรียน', group: '7' },
  { clause: '7.10', titleTh: '7.10 การควบคุมงานทดสอบที่ไม่เป็นไปตามที่กำหนด', group: '7' },
  { clause: '7.11', titleTh: '7.11 การควบคุมการจัดการข้อมูลและสารสนเทศ', group: '7' },
  { clause: '8', titleTh: '8. ข้อกำหนดระบบการบริหาร', group: '8', isHeader: true },
  { clause: '8.1', titleTh: '8.1 ทางเลือกเหมาะสมกับห้องปฏิบัติการ', group: '8' },
  { clause: '8.2', titleTh: '8.2 เอกสารระบบบริหารงานคุณภาพ', group: '8' },
  { clause: '8.3', titleTh: '8.3 การควบคุมเอกสารระบบบริหารงานคุณภาพ', group: '8' },
  { clause: '8.4', titleTh: '8.4 การควบคุมบันทึก', group: '8' },
  { clause: '8.5', titleTh: '8.5 การปฏิบัติการเพื่อจัดการความเสี่ยงและโอกาส', group: '8' },
  { clause: '8.6', titleTh: '8.6 การปรับปรุง', group: '8' },
  { clause: '8.7', titleTh: '8.7 การปฏิบัติการแก้ไข', group: '8' },
  { clause: '8.8', titleTh: '8.8 การตรวจติดตามคุณภาพภายใน', group: '8' },
  { clause: '8.9', titleTh: '8.9 การทบทวนการบริหาร', group: '8' },
];

export const ROLE_LABELS: Record<UserRole, { th: string; en: string; level: string }> = {
  quality_manager: { th: 'Admin · ผู้จัดการคุณภาพ (QM)', en: 'Admin / Quality Manager', level: 'ระดับ 4 · Admin สิทธิ์จัดการระบบทั้งหมด' },
  auditor: { th: 'ผู้ตรวจติดตามภายใน (Auditor)', en: 'Internal Auditor', level: 'ระดับ 3 · ตรวจประเมินและทวนสอบ' },
  auditee: { th: 'ผู้รับการตรวจติดตาม (Auditee)', en: 'Auditee / Lab Staff', level: 'ระดับ 2 · ตอบแนวทางแก้ไขและบันทึกค่า' },
  executive: { th: 'ผู้บริหารสูงสุด (Top Management)', en: 'Executive Reviewer', level: 'ระดับ 1 · อนุมัติแผนและทบทวนรายงาน' },
};

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  internal_audit: 'การตรวจติดตามคุณภาพภายใน',
  management_review: 'การทบทวนระบบคุณภาพ',
  external_audit: 'การตรวจติดตามภายนอก',
  complaint: 'ข้อร้องเรียน',
  staff_observation: 'การสังเกตของเจ้าหน้าที่',
  other: 'อื่นๆ',
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  testing: 'กิจกรรมการทดสอบ (Testing)',
  calibration: 'กิจกรรมการสอบเทียบ (Calibration)',
  management: 'ระบบบริหารงานคุณภาพ (Management)',
};

export const AUDIT_METHOD_LABELS: Record<AuditMethod, string> = {
  horizontal: 'Horizontal audit',
  vertical: 'Vertical audit',
  witness: 'Witness audit',
};
