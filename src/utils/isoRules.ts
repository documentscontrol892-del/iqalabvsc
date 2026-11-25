import {
  AuditChecklistItem,
  AuditProgramItem,
  AuditScheduleItem,
  AuditTrailEntry,
  CarRecord,
  ComplianceStatus,
  DeviationAlert,
  EquipmentItem,
  FM_LB_025_CLAUSES,
  ParRecord,
  UserRole,
} from '../types/iso17025';

export interface FmLb025ClauseSummary {
  clause: string;
  titleTh: string;
  isHeader: boolean;
  cCount: number;
  carCount: number;
  ncCount: number;
  obCount: number;
  remarks: string;
}

export interface FmLb025Totals {
  rows: FmLb025ClauseSummary[];
  totalC: number;
  totalCar: number;
  totalNc: number;
  totalOb: number;
}

/**
 * Aggregates FM-LB-024 checklist items into the official FM-LB-025 summary report table
 * covering ISO/IEC 17025:2017 Clauses 4.1 through 8.9.
 */
export function aggregateFmLb025Summary(
  checklists: AuditChecklistItem[],
  filterRound?: string
): FmLb025Totals {
  const filtered = filterRound && filterRound !== 'ALL'
    ? checklists.filter((item) => item.auditRound === filterRound)
    : checklists;

  let totalC = 0;
  let totalCar = 0;
  let totalNc = 0;
  let totalOb = 0;

  const rows: FmLb025ClauseSummary[] = FM_LB_025_CLAUSES.map((meta) => {
    if (meta.isHeader) {
      return {
        clause: meta.clause,
        titleTh: meta.titleTh,
        isHeader: true,
        cCount: 0,
        carCount: 0,
        ncCount: 0,
        obCount: 0,
        remarks: '',
      };
    }

    const matching = filtered.filter((item) => {
      const c = item.clause.trim();
      return c === meta.clause || c.startsWith(`${meta.clause}.`);
    });

    const cCount = matching.filter((m) => m.result === 'C').length;
    const carCount = matching.filter((m) => m.result === 'CAR').length;
    const ncCount = matching.filter((m) => m.result === 'NC').length;
    const obCount = matching.filter((m) => m.result === 'OB').length;

    totalC += cCount;
    totalCar += carCount;
    totalNc += ncCount;
    totalOb += obCount;

    const linkedDocs = Array.from(
      new Set(
        matching
          .map((m) => m.linkedDocNo)
          .filter((doc): doc is string => Boolean(doc && doc.trim()))
      )
    );

    return {
      clause: meta.clause,
      titleTh: meta.titleTh,
      isHeader: false,
      cCount,
      carCount,
      ncCount,
      obCount,
      remarks: linkedDocs.join(', '),
    };
  });

  return { rows, totalC, totalCar, totalNc, totalOb };
}

/**
 * FM-LB-011 / FM-LB-017 Risk Matrix Calculation
 * Risk Score = Likelihood (1-4) x Severity (1-4)
 * 1-8: Not required in FM-LB-017; 9-16: Mandatory entry in FM-LB-017
 */
export function calculateRiskMatrix(likelihood: number, severity: number): {
  riskScore: number;
  riskFm17Required: boolean;
  riskLevelLabel: string;
} {
  const safeL = Math.max(1, Math.min(4, Math.round(likelihood)));
  const safeS = Math.max(1, Math.min(4, Math.round(severity)));
  const riskScore = safeL * safeS;
  const riskFm17Required = riskScore >= 9;
  const riskLevelLabel = riskFm17Required
    ? 'จำเป็นต้องบันทึกใน FM-LB-017 (ความเสี่ยงสูง 9-16 คะแนน)'
    : 'ไม่จำเป็นต้องบันทึกใน FM-LB-017 (ความเสี่ยง 1-8 คะแนน)';
  return { riskScore, riskFm17Required, riskLevelLabel };
}

/**
 * Counts business days (Mon-Fri) between two ISO date strings YYYY-MM-DD.
 */
export function calculateBusinessDaysElapsed(fromDateISO: string, toDateISO: string): number {
  const start = new Date(`${fromDateISO}T00:00:00Z`);
  const end = new Date(`${toDateISO}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end <= start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
  }
  return count;
}

/**
 * Adds N business days to a YYYY-MM-DD date string.
 */
export function addBusinessDays(fromDateISO: string, businessDays: number): string {
  const cursor = new Date(`${fromDateISO}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return fromDateISO;
  let remaining = Math.max(0, businessDays);
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return cursor.toISOString().slice(0, 10);
}

/**
 * PD-LB-021 Clause 7.4.1(5) Timeline Evaluation:
 * - Auditee must respond with corrective action plan within 7 business days
 * - Max 2 extensions of 15 days each, total cap 30 business days from issue date
 */
export function evaluateCarTimeline(car: Pick<CarRecord, 'foundDate' | 'status' | 'extensionCount' | 'correctiveDueDate'>, todayISO: string): {
  businessDaysElapsed: number;
  maxAllowedDays: number;
  isResponseOverdue: boolean;
  isActionOverdue: boolean;
  canExtend: boolean;
  remainingExtensions: number;
} {
  const elapsed = calculateBusinessDaysElapsed(car.foundDate, todayISO);
  const extCount = Math.max(0, Math.min(2, car.extensionCount ?? 0));
  const maxAllowedDays = Math.min(30, 7 + extCount * 15);
  const isResponseOverdue = car.status === 'open' && elapsed > 7;
  const isActionOverdue =
    (car.status === 'open' || car.status === 'responded') &&
    (elapsed > maxAllowedDays || (Boolean(car.correctiveDueDate) && todayISO > (car.correctiveDueDate ?? '')));

  return {
    businessDaysElapsed: elapsed,
    maxAllowedDays,
    isResponseOverdue,
    isActionOverdue,
    canExtend: extCount < 2 && car.status !== 'closed' && car.status !== 'reissued',
    remainingExtensions: 2 - extCount,
  };
}

/**
 * ISO/IEC 17025 Clause 6.4 / 6.5 / 7.7 Equipment & Process Compliance Evaluator
 */
export function evaluateEquipmentCompliance(
  item: Pick<EquipmentItem, 'nextCalDate' | 'nominalValue' | 'tolerance' | 'lastMeasuredValue' | 'ptZScore' | 'unit'>,
  todayISO: string
): {
  status: ComplianceStatus;
  deviation: number;
  reasons: string[];
  shouldAlert: boolean;
  severity: 'critical' | 'warning';
} {
  const reasons: string[] = [];
  let status: ComplianceStatus = 'compliant';
  let severity: 'critical' | 'warning' = 'warning';

  const deviation = Number(Math.abs(item.lastMeasuredValue - item.nominalValue).toFixed(4));
  const nextCal = new Date(`${item.nextCalDate}T00:00:00Z`);
  const today = new Date(`${todayISO}T00:00:00Z`);
  const daysToCal = Math.ceil((nextCal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (!Number.isNaN(daysToCal)) {
    if (daysToCal < 0) {
      status = 'non_compliant';
      severity = 'critical';
      reasons.push(`เกินกำหนดสอบเทียบมาแล้ว ${Math.abs(daysToCal)} วัน`);
    } else if (daysToCal <= 30) {
      if (status === 'compliant') status = 'warning';
      reasons.push(`ใกล้ครบกำหนดสอบเทียบภายใน ${daysToCal} วัน`);
    }
  }

  if (deviation > item.tolerance) {
    status = 'non_compliant';
    severity = 'critical';
    reasons.push(
      `ค่าเบี่ยงเบน ${deviation} ${item.unit} เกินค่าพิกัดความเผื่อ (±${item.tolerance} ${item.unit})`
    );
  } else if (item.tolerance > 0 && deviation >= item.tolerance * 0.8) {
    if (status === 'compliant') status = 'warning';
    reasons.push(
      `ค่าเบี่ยงเบนเข้าใกล้ขีดจำกัด (${deviation}/${item.tolerance} ${item.unit})`
    );
  }

  if (typeof item.ptZScore === 'number') {
    const absZ = Math.abs(item.ptZScore);
    if (absZ >= 3.0) {
      status = 'non_compliant';
      severity = 'critical';
      reasons.push(`ผลทดสอบความชำนาญ (PT) |Z-Score| = ${absZ.toFixed(2)} >= 3.0 (ไม่ผ่านเกณฑ์)`);
    } else if (absZ >= 2.0) {
      if (status === 'compliant') status = 'warning';
      reasons.push(`ผล PT |Z-Score| = ${absZ.toFixed(2)} อยู่ในช่วงเฝ้าระวัง (2.0–2.99)`);
    }
  }

  return {
    status,
    deviation,
    reasons,
    shouldAlert: status !== 'compliant',
    severity,
  };
}

export type RbacAction =
  | 'manage_users'
  | 'edit_program'
  | 'approve_program'
  | 'edit_schedule'
  | 'conduct_audit'
  | 'issue_car_par'
  | 'respond_car_par'
  | 'verify_close_car_par'
  | 'manage_equipment'
  | 'log_measurement'
  | 'resolve_alert'
  | 'edit_any_record'
  | 'delete_any_record'
  | 'export_data';

const RBAC_MATRIX: Record<UserRole, Set<RbacAction>> = {
  quality_manager: new Set<RbacAction>([
    'manage_users',
    'edit_program',
    'approve_program',
    'edit_schedule',
    'conduct_audit',
    'issue_car_par',
    'respond_car_par',
    'verify_close_car_par',
    'manage_equipment',
    'log_measurement',
    'resolve_alert',
    'edit_any_record',
    'delete_any_record',
    'export_data',
  ]),
  auditor: new Set<RbacAction>([
    'conduct_audit',
    'issue_car_par',
    'respond_car_par',
    'verify_close_car_par',
    'manage_equipment',
    'log_measurement',
    'resolve_alert',
    'export_data',
  ]),
  auditee: new Set<RbacAction>([
    'respond_car_par',
    'log_measurement',
    'export_data',
  ]),
  executive: new Set<RbacAction>([
    'approve_program',
    'export_data',
  ]),
};

export function canPerformAction(role: UserRole, action: RbacAction): boolean {
  return RBAC_MATRIX[role]?.has(action) ?? false;
}

export interface DashboardMetrics {
  conformityRate: number;
  testingConformityRate: number;
  calibrationConformityRate: number;
  openCarCount: number;
  openNcCount: number;
  openParCount: number;
  closedCarParCount: number;
  equipmentCompliantCount: number;
  equipmentWarningCount: number;
  equipmentNonCompliantCount: number;
  activeCriticalAlerts: number;
  activeWarningAlerts: number;
  totalChecklists: number;
  cycleTrends: {
    cycle: string;
    conformityPct: number;
    carCount: number;
    ncCount: number;
    obCount: number;
  }[];
  clauseGroupDistribution: {
    group: string;
    label: string;
    car: number;
    nc: number;
    ob: number;
  }[];
}

export function computeDashboardMetrics(params: {
  checklists: AuditChecklistItem[];
  cars: CarRecord[];
  pars: ParRecord[];
  equipment: EquipmentItem[];
  alerts: DeviationAlert[];
}): DashboardMetrics {
  const { checklists, cars, pars, equipment, alerts } = params;

  const calcRate = (items: AuditChecklistItem[]) => {
    if (items.length === 0) return 100;
    const conform = items.filter((i) => i.result === 'C').length;
    return Number(((conform / items.length) * 100).toFixed(1));
  };

  const testingItems = checklists.filter((i) => i.activityType === 'testing');
  const calibrationItems = checklists.filter((i) => i.activityType === 'calibration');

  const openCarCount = cars.filter((c) => c.recordType === 'CAR' && (c.status === 'open' || c.status === 'responded')).length;
  const openNcCount = cars.filter((c) => c.recordType === 'NC' && (c.status === 'open' || c.status === 'responded')).length;
  const openParCount = pars.filter((p) => p.status === 'open' || p.status === 'responded').length;
  const closedCarParCount =
    cars.filter((c) => c.status === 'closed').length +
    pars.filter((p) => p.status === 'closed').length;

  const equipmentCompliantCount = equipment.filter((e) => e.status === 'compliant').length;
  const equipmentWarningCount = equipment.filter((e) => e.status === 'warning').length;
  const equipmentNonCompliantCount = equipment.filter((e) => e.status === 'non_compliant').length;

  const activeAlerts = alerts.filter((a) => a.status !== 'resolved');
  const activeCriticalAlerts = activeAlerts.filter((a) => a.severity === 'critical').length;
  const activeWarningAlerts = activeAlerts.filter((a) => a.severity === 'warning').length;

  // Cycle trends grouped by auditRound
  const roundMap = new Map<string, AuditChecklistItem[]>();
  for (const item of checklists) {
    const existing = roundMap.get(item.auditRound) ?? [];
    existing.push(item);
    roundMap.set(item.auditRound, existing);
  }
  const parseCycleKey = (cycle: string): number => {
    const parts = cycle.split('/');
    if (parts.length === 2) {
      const round = Number(parts[0]) || 0;
      const year = Number(parts[1]) || 0;
      return year * 100 + round;
    }
    return 0;
  };

  const cycleTrends = Array.from(roundMap.entries())
    .sort((a, b) => parseCycleKey(a[0]) - parseCycleKey(b[0]) || a[0].localeCompare(b[0]))
    .map(([cycle, items]) => ({
      cycle,
      conformityPct: calcRate(items),
      carCount: items.filter((i) => i.result === 'CAR').length,
      ncCount: items.filter((i) => i.result === 'NC').length,
      obCount: items.filter((i) => i.result === 'OB').length,
    }));

  const groups = [
    { group: '4', label: 'หมวด 4 ทั่วไป' },
    { group: '5', label: 'หมวด 5 โครงสร้าง' },
    { group: '6', label: 'หมวด 6 ทรัพยากร' },
    { group: '7', label: 'หมวด 7 กระบวนการ' },
    { group: '8', label: 'หมวด 8 ระบบบริหาร' },
  ];

  const clauseGroupDistribution = groups.map((g) => {
    const items = checklists.filter((c) => c.clause.startsWith(g.group));
    return {
      group: g.group,
      label: g.label,
      car: items.filter((i) => i.result === 'CAR').length,
      nc: items.filter((i) => i.result === 'NC').length,
      ob: items.filter((i) => i.result === 'OB').length,
    };
  });

  return {
    conformityRate: calcRate(checklists),
    testingConformityRate: calcRate(testingItems),
    calibrationConformityRate: calcRate(calibrationItems),
    openCarCount,
    openNcCount,
    openParCount,
    closedCarParCount,
    equipmentCompliantCount,
    equipmentWarningCount,
    equipmentNonCompliantCount,
    activeCriticalAlerts,
    activeWarningAlerts,
    totalChecklists: checklists.length,
    cycleTrends,
    clauseGroupDistribution,
  };
}

/**
 * Pure CSV builder with UTF-8 BOM and proper RFC-4180 escaping for Thai Excel support
 */
export function buildCsvContent(headers: string[], rows: (string | number | boolean | undefined | null)[][]): string {
  const escapeCell = (val: string | number | boolean | undefined | null): string => {
    const str = val === undefined || val === null ? '' : String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsvWithBom(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | undefined | null)[][]
): void {
  const csv = buildCsvContent(headers, rows);
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');
}

export function exportToJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  triggerFileDownload(filename, json, 'application/json;charset=utf-8;');
}

export function formatTrailTimestamp(iso: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function createAuditTrailPayload(params: {
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetCollection: string;
  targetCode: string;
  summary: string;
}): AuditTrailEntry {
  return {
    id: `trail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actorUid: params.actorUid,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    targetCollection: params.targetCollection,
    targetCode: params.targetCode,
    summary: params.summary,
    createdAt: new Date().toISOString(),
  };
}

export function getCurrentBuddhistYear(): number {
  return new Date().getFullYear() + 543;
}

export function parseRoundYearBE(auditRound: string, fallbackYearBE = getCurrentBuddhistYear()): number {
  const parts = auditRound.split('/');
  if (parts.length === 2) {
    const y = Number(parts[1]?.trim());
    if (Number.isInteger(y) && y >= 2560 && y <= 2700) {
      return y;
    }
  }
  return fallbackYearBE;
}

export interface AnnualAuditPlanBuildInput {
  yearBE: number;
  mode: 'standard' | 'copy' | 'blank';
  preparedBy: string;
  createdBy: string;
  sourcePrograms?: AuditProgramItem[];
  createInitialSchedule: boolean;
  initialRound?: string;
  initialStartDate?: string;
  defaultAuditorName?: string;
  defaultAuditeeName?: string;
}

/**
 * Generates an annual FM-LB-023 program and optional FM-LB-022 Round 1 schedule
 * for starting a new ISO/IEC 17025 internal audit plan for a given Buddhist Era year.
 */
export function buildAnnualAuditPlanSeed(input: AnnualAuditPlanBuildInput): {
  programs: AuditProgramItem[];
  schedules: AuditScheduleItem[];
} {
  const safeYearBE = Math.max(2560, Math.min(2700, Math.trunc(input.yearBE)));
  const yearCE = safeYearBE - 543;
  const todayISO = new Date().toISOString().slice(0, 10);
  const stamp = Date.now();
  const roundLabel = (input.initialRound ?? `1/${safeYearBE}`).trim() || `1/${safeYearBE}`;
  const day1 = input.initialStartDate && /^\d{4}-\d{2}-\d{2}$/.test(input.initialStartDate)
    ? input.initialStartDate
    : `${yearCE}-05-15`;
  const day2Date = new Date(`${day1}T00:00:00Z`);
  if (!Number.isNaN(day2Date.getTime())) {
    day2Date.setUTCDate(day2Date.getUTCDate() + 1);
  }
  const day2 = Number.isNaN(day2Date.getTime()) ? `${yearCE}-05-16` : day2Date.toISOString().slice(0, 10);

  const auditor = (input.defaultAuditorName ?? '').trim() || 'หัวหน้าทีมผู้ตรวจติดตามภายใน';
  const auditee = (input.defaultAuditeeName ?? '').trim() || 'ตัวแทนห้องปฏิบัติการ';

  let programs: AuditProgramItem[] = [];

  if (input.mode === 'standard') {
    const standardTemplates: Array<{
      activity: string;
      activityType: AuditProgramItem['activityType'];
      months: boolean[];
      remarks: string;
    }> = [
      {
        activity: 'ข้อกำหนดทั่วไปและโครงสร้าง (4.1–5) ความเป็นกลางและการรักษาความลับ',
        activityType: 'management',
        months: [false, false, false, false, true, false, false, false, false, false, true, false],
        remarks: `ตรวจประจำปี ${safeYearBE} อย่างน้อยปีละ 1-2 ครั้ง`,
      },
      {
        activity: 'กิจกรรมการทดสอบ (Testing) หมวด 6.2–7.8 และความใช้ได้ของผลทดสอบ',
        activityType: 'testing',
        months: [false, false, false, false, true, false, false, false, false, false, true, false],
        remarks: 'ตรวจตาม Horizontal, Vertical & Witness Audit',
      },
      {
        activity: 'กิจกรรมการสอบเทียบ (Calibration) หมวด 6.4, 6.5, 7.6 ความสอบกลับได้ทางมาตรวิทยา',
        activityType: 'calibration',
        months: [false, false, false, false, true, false, false, false, false, false, true, false],
        remarks: 'ทวนสอบใบรับรองสอบเทียบและค่าความไม่แน่นอนในการวัด',
      },
      {
        activity: 'สิ่งอำนวยความสะดวก ภาวะแวดล้อม และการควบคุมงานที่ไม่เป็นไปตามข้อกำหนด (6.3, 7.10)',
        activityType: 'testing',
        months: [false, false, false, false, false, true, false, false, false, false, false, true],
        remarks: 'เฝ้าระวังภาวะแวดล้อมและบันทึกควบคุมเครื่องมือ',
      },
      {
        activity: 'ระบบบริหารงานคุณภาพ เอกสาร บันทึก ความเสี่ยง และการทบทวนฝ่ายบริหาร (8.1–8.9)',
        activityType: 'management',
        months: [false, false, false, false, false, true, false, false, false, false, false, true],
        remarks: 'เตรียมสรุปผลเข้าประชุม Management Review (PD-LB-023)',
      },
    ];

    programs = standardTemplates.map((tpl, idx) => ({
      id: `prog-${safeYearBE}-${stamp}-${idx + 1}`,
      yearBE: safeYearBE,
      sequence: idx + 1,
      activity: tpl.activity,
      activityType: tpl.activityType,
      months: [...tpl.months],
      remarks: tpl.remarks,
      preparedBy: input.preparedBy,
      preparedDate: todayISO,
      status: 'draft',
      createdBy: input.createdBy,
    }));
  } else if (input.mode === 'copy' && input.sourcePrograms && input.sourcePrograms.length > 0) {
    programs = [...input.sourcePrograms]
      .sort((a, b) => a.sequence - b.sequence)
      .map((src, idx) => ({
        id: `prog-${safeYearBE}-${stamp}-${idx + 1}`,
        yearBE: safeYearBE,
        sequence: idx + 1,
        activity: src.activity,
        activityType: src.activityType,
        months: [...src.months],
        remarks: src.remarks,
        preparedBy: input.preparedBy,
        preparedDate: todayISO,
        status: 'draft',
        createdBy: input.createdBy,
      }));
  }

  let schedules: AuditScheduleItem[] = [];
  if (input.createInitialSchedule) {
    const scheduleTemplates: Array<Omit<AuditScheduleItem, 'id' | 'createdBy'>> = [
      {
        auditRound: roundLabel,
        yearBE: safeYearBE,
        auditDate: day1,
        timeRange: '09:00 - 10:00',
        activity: 'เปิดประชุม (Opening Meeting) & ตรวจข้อกำหนดทั่วไป/โครงสร้าง (4.1–5)',
        activityType: 'management',
        criteria: 'QM-LB-001, PD-LB-021, ISO/IEC 17025 ข้อ 4.1–5',
        auditorName: auditor,
        auditeeName: input.preparedBy,
        status: 'planned',
      },
      {
        auditRound: roundLabel,
        yearBE: safeYearBE,
        auditDate: day1,
        timeRange: '10:15 - 12:30',
        activity: 'ตรวจกิจกรรมการทดสอบ (Testing) และบันทึกทางวิชาการ',
        activityType: 'testing',
        criteria: 'ISO/IEC 17025 ข้อ 6.2–6.4, 7.1–7.8',
        auditorName: auditor,
        auditeeName: auditee,
        status: 'planned',
      },
      {
        auditRound: roundLabel,
        yearBE: safeYearBE,
        auditDate: day2,
        timeRange: '09:00 - 12:00',
        activity: 'ตรวจกิจกรรมการสอบเทียบ (Calibration) และความสอบกลับได้ทางมาตรวิทยา',
        activityType: 'calibration',
        criteria: 'ISO/IEC 17025 ข้อ 6.4, 6.5, 7.6',
        auditorName: auditor,
        auditeeName: auditee,
        status: 'planned',
      },
      {
        auditRound: roundLabel,
        yearBE: safeYearBE,
        auditDate: day2,
        timeRange: '13:30 - 16:00',
        activity: 'ตรวจระบบบริหารงานคุณภาพ (8.1–8.9) และปิดประชุม (Closing Meeting)',
        activityType: 'management',
        criteria: 'QM-LB-001 หมวด 8.1–8.9, PD-LB-020, PD-LB-021',
        auditorName: auditor,
        auditeeName: 'คณะเจ้าหน้าที่ห้องปฏิบัติการ',
        status: 'planned',
      },
    ];

    schedules = scheduleTemplates.map((tpl, idx) => ({
      ...tpl,
      id: `sch-${safeYearBE}-${stamp}-${idx + 1}`,
      createdBy: input.createdBy,
    }));
  }

  return { programs, schedules };
}
