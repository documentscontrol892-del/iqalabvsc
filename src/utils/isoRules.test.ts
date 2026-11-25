import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBusinessDays,
  aggregateFmLb025Summary,
  buildCsvContent,
  calculateBusinessDaysElapsed,
  calculateRiskMatrix,
  canPerformAction,
  computeDashboardMetrics,
  evaluateCarTimeline,
  evaluateEquipmentCompliance,
} from './isoRules';
import type { AuditChecklistItem, CarRecord, EquipmentItem } from '../types/iso17025';

test('FM-LB-025 aggregation tallies C, CAR, NC, and OB accurately across clauses', () => {
  const sampleChecklists: AuditChecklistItem[] = [
    {
      id: 'chk-1',
      auditRound: '1/2569',
      yearBE: 2569,
      department: 'ห้องปฏิบัติการเคมี',
      activity: 'Testing',
      activityType: 'testing',
      auditMethod: 'vertical',
      auditDate: '2026-11-10',
      sequence: 1,
      clause: '6.4',
      checkItem: 'ตรวจสอบสถานะการสอบเทียบเครื่องชั่ง',
      result: 'CAR',
      auditorName: 'ดร.วินัย แจ่มจันทร์',
      auditeeName: 'ผุสดี ประถมงาม',
      linkedDocNo: 'CAR-2569-01',
      createdBy: 'u1',
    },
    {
      id: 'chk-2',
      auditRound: '1/2569',
      yearBE: 2569,
      department: 'ห้องปฏิบัติการสอบเทียบ',
      activity: 'Calibration',
      activityType: 'calibration',
      auditMethod: 'witness',
      auditDate: '2026-11-10',
      sequence: 2,
      clause: '7.6',
      checkItem: 'ทวนสอบค่าความไม่แน่นอนในการวัด',
      result: 'NC',
      auditorName: 'ดร.วินัย แจ่มจันทร์',
      auditeeName: 'วิชัย ศรีสุข',
      linkedDocNo: 'NC-2569-01',
      createdBy: 'u1',
    },
    {
      id: 'chk-3',
      auditRound: '1/2569',
      yearBE: 2569,
      department: 'ห้องปฏิบัติการเคมี',
      activity: 'Testing',
      activityType: 'testing',
      auditMethod: 'horizontal',
      auditDate: '2026-11-10',
      sequence: 3,
      clause: '4.1',
      checkItem: 'ความเป็นกลางของบุคลากร',
      result: 'C',
      auditorName: 'ดร.วินัย แจ่มจันทร์',
      auditeeName: 'ผุสดี ประถมงาม',
      createdBy: 'u1',
    },
    {
      id: 'chk-4',
      auditRound: '1/2569',
      yearBE: 2569,
      department: 'ห้องปฏิบัติการสอบเทียบ',
      activity: 'Calibration',
      activityType: 'calibration',
      auditMethod: 'horizontal',
      auditDate: '2026-11-10',
      sequence: 4,
      clause: '8.5',
      checkItem: 'ทบทวนความเสี่ยงและโอกาส',
      result: 'OB',
      auditorName: 'ดร.วินัย แจ่มจันทร์',
      auditeeName: 'วิชัย ศรีสุข',
      linkedDocNo: 'PAR-2569-01',
      createdBy: 'u1',
    },
  ];

  const summary = aggregateFmLb025Summary(sampleChecklists, '1/2569');
  assert.equal(summary.totalC, 1);
  assert.equal(summary.totalCar, 1);
  assert.equal(summary.totalNc, 1);
  assert.equal(summary.totalOb, 1);

  const row64 = summary.rows.find((r) => r.clause === '6.4');
  assert.equal(row64?.carCount, 1);
  assert.equal(row64?.remarks, 'CAR-2569-01');
});

test('FM-LB-011 / FM-LB-017 Risk Matrix flags >= 9 as mandatory FM-LB-017 entry', () => {
  const low = calculateRiskMatrix(2, 4);
  assert.equal(low.riskScore, 8);
  assert.equal(low.riskFm17Required, false);

  const high = calculateRiskMatrix(3, 3);
  assert.equal(high.riskScore, 9);
  assert.equal(high.riskFm17Required, true);
});

test('PD-LB-021 business day timeline detects 7-day response overdue and enforces max 2 extensions (30 days)', () => {
  // 2026-11-02 (Mon) -> 2026-11-12 (Thu) = 8 business days
  assert.equal(calculateBusinessDaysElapsed('2026-11-02', '2026-11-12'), 8);
  assert.equal(addBusinessDays('2026-11-02', 7), '2026-11-11');

  const overdueCar: Pick<CarRecord, 'foundDate' | 'status' | 'extensionCount' | 'correctiveDueDate'> = {
    foundDate: '2026-11-02',
    status: 'open',
    extensionCount: 0,
    correctiveDueDate: '2026-11-20',
  };
  const eval1 = evaluateCarTimeline(overdueCar, '2026-11-12');
  assert.equal(eval1.isResponseOverdue, true);
  assert.equal(eval1.canExtend, true);
  assert.equal(eval1.remainingExtensions, 2);

  const maxExtended = evaluateCarTimeline({ ...overdueCar, status: 'responded', extensionCount: 2 }, '2026-11-12');
  assert.equal(maxExtended.maxAllowedDays, 30);
  assert.equal(maxExtended.canExtend, false);
});

test('Equipment compliance evaluator detects out-of-tolerance, overdue calibration, and PT Z-Score deviations', () => {
  const baseEq: Pick<EquipmentItem, 'nextCalDate' | 'nominalValue' | 'tolerance' | 'lastMeasuredValue' | 'ptZScore' | 'unit'> = {
    nextCalDate: '2027-06-01',
    nominalValue: 100.0,
    tolerance: 0.5,
    lastMeasuredValue: 100.2,
    ptZScore: 0.8,
    unit: 'g',
  };
  const pass = evaluateEquipmentCompliance(baseEq, '2026-11-24');
  assert.equal(pass.status, 'compliant');
  assert.equal(pass.shouldAlert, false);

  const outOfTol = evaluateEquipmentCompliance({ ...baseEq, lastMeasuredValue: 100.75 }, '2026-11-24');
  assert.equal(outOfTol.status, 'non_compliant');
  assert.equal(outOfTol.severity, 'critical');
  assert.equal(outOfTol.shouldAlert, true);

  const ptWarn = evaluateEquipmentCompliance({ ...baseEq, ptZScore: 2.35 }, '2026-11-24');
  assert.equal(ptWarn.status, 'warning');
  assert.equal(ptWarn.shouldAlert, true);

  const calOverdue = evaluateEquipmentCompliance({ ...baseEq, nextCalDate: '2026-11-10' }, '2026-11-24');
  assert.equal(calOverdue.status, 'non_compliant');
  assert.equal(calOverdue.severity, 'critical');
});

test('RBAC permission matrix restricts actions strictly by role', () => {
  assert.equal(canPerformAction('quality_manager', 'manage_users'), true);
  assert.equal(canPerformAction('quality_manager', 'edit_any_record'), true);
  assert.equal(canPerformAction('quality_manager', 'delete_any_record'), true);
  assert.equal(canPerformAction('auditor', 'manage_users'), false);
  assert.equal(canPerformAction('auditor', 'delete_any_record'), false);
  assert.equal(canPerformAction('auditor', 'verify_close_car_par'), true);
  assert.equal(canPerformAction('auditee', 'verify_close_car_par'), false);
  assert.equal(canPerformAction('auditee', 'respond_car_par'), true);
  assert.equal(canPerformAction('executive', 'approve_program'), true);
  assert.equal(canPerformAction('executive', 'conduct_audit'), false);
});

test('CSV builder prepends UTF-8 BOM and escapes commas and quotes properly', () => {
  const csv = buildCsvContent(['รหัส', 'รายละเอียด'], [['CAR-01', 'พบค่า "เบี่ยงเบน", เกินเกณฑ์']]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.match(csv, /"พบค่า ""เบี่ยงเบน"", เกินเกณฑ์"/);
});

test('Dashboard metrics compute testing vs calibration conformity and clause group counts', () => {
  const metrics = computeDashboardMetrics({
    checklists: [
      {
        id: '1', auditRound: '1/2569', yearBE: 2569, department: 'Chem', activity: 'T1', activityType: 'testing',
        auditMethod: 'vertical', auditDate: '2026-11-10', sequence: 1, clause: '7.5', checkItem: 'A',
        result: 'C', auditorName: 'A', auditeeName: 'B', createdBy: 'u1',
      },
      {
        id: '2', auditRound: '1/2569', yearBE: 2569, department: 'Cal', activity: 'C1', activityType: 'calibration',
        auditMethod: 'witness', auditDate: '2026-11-10', sequence: 2, clause: '6.4', checkItem: 'B',
        result: 'CAR', auditorName: 'A', auditeeName: 'B', createdBy: 'u1',
      },
      {
        id: '3', auditRound: '2/2568', yearBE: 2568, department: 'Chem', activity: 'T2', activityType: 'testing',
        auditMethod: 'horizontal', auditDate: '2025-11-10', sequence: 3, clause: '7.5', checkItem: 'C',
        result: 'C', auditorName: 'A', auditeeName: 'B', createdBy: 'u1',
      },
    ],
    cars: [],
    pars: [],
    equipment: [],
    alerts: [],
  });
  assert.equal(metrics.conformityRate, 66.7);
  assert.equal(metrics.testingConformityRate, 100);
  assert.equal(metrics.calibrationConformityRate, 0);
  assert.deepEqual(metrics.cycleTrends.map((t) => t.cycle), ['2/2568', '1/2569']);
});

import { buildAnnualAuditPlanSeed, parseRoundYearBE } from './isoRules';

test('parseRoundYearBE extracts valid Buddhist Era year from audit round label', () => {
  assert.equal(parseRoundYearBE('1/2570', 2569), 2570);
  assert.equal(parseRoundYearBE('2/2569', 2568), 2569);
  assert.equal(parseRoundYearBE('invalid', 2569), 2569);
});

test('buildAnnualAuditPlanSeed generates standard ISO 17025 program and Round 1 schedule', () => {
  const { programs, schedules } = buildAnnualAuditPlanSeed({
    yearBE: 2570,
    mode: 'standard',
    preparedBy: 'นายชวิน พาพิทักษ์',
    createdBy: 'uid-admin',
    createInitialSchedule: true,
    initialStartDate: '2027-05-15',
  });
  assert.equal(programs.length, 5);
  assert.equal(programs[0].yearBE, 2570);
  assert.equal(programs[0].status, 'draft');
  assert.equal(schedules.length, 4);
  assert.equal(schedules[0].auditRound, '1/2570');
  assert.equal(schedules[0].auditDate, '2027-05-15');
  assert.equal(schedules[2].auditDate, '2027-05-16');

  const copied = buildAnnualAuditPlanSeed({
    yearBE: 2571,
    mode: 'copy',
    sourcePrograms: [{ ...programs[0], status: 'approved', approvedBy: 'Director', approvedDate: '2027-01-05' }],
    preparedBy: 'นายชวิน พาพิทักษ์',
    createdBy: 'uid-admin',
    createInitialSchedule: false,
  });
  assert.equal(copied.programs.length, 1);
  assert.equal(copied.programs[0].yearBE, 2571);
  assert.equal(copied.programs[0].status, 'draft');
  assert.equal(copied.programs[0].approvedBy, undefined);
  assert.equal(copied.schedules.length, 0);
});
