import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Printer,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  CarRecord,
  DeviationAlert,
  EquipmentItem,
  ParRecord,
  UserRole,
  WorkspaceTab,
} from '../types/iso17025';
import { canPerformAction, DashboardMetrics, evaluateCarTimeline, exportToCsvWithBom } from '../utils/isoRules';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  alerts: DeviationAlert[];
  cars: CarRecord[];
  pars: ParRecord[];
  equipment: EquipmentItem[];
  programsCount: number;
  schedulesCount: number;
  cloudLoading: boolean;
  hasResetWorkspace: boolean;
  role: UserRole;
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlertWithCar: (alertId: string, type: 'CAR' | 'NC' | 'PAR') => void;
  onDeleteAlert: (alertId: string) => void;
  onClearAllWorkspaceData: () => Promise<void> | void;
  onNavigate: (tab: WorkspaceTab) => void;
  onOpenPrintModal: (formCode: 'FM-LB-025' | 'FM-LB-012' | 'FM-LB-014' | 'REPORT-EXEC') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  alerts,
  cars,
  pars,
  equipment,
  programsCount,
  schedulesCount,
  cloudLoading,
  hasResetWorkspace,
  role,
  onAcknowledgeAlert,
  onResolveAlertWithCar,
  onDeleteAlert,
  onClearAllWorkspaceData,
  onNavigate,
  onOpenPrintModal,
}) => {
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [deleteTarget, setDeleteTarget] = useState<DeviationAlert | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const todayISO = new Date().toISOString().slice(0, 10);
  const totalOperationalRecords =
    programsCount +
    schedulesCount +
    metrics.totalChecklists +
    cars.length +
    pars.length +
    equipment.length +
    alerts.length;

  const activeAlerts = useMemo(() => {
    const unresolved = alerts.filter((a) => a.status !== 'resolved');
    if (alertFilter === 'all') return unresolved;
    return unresolved.filter((a) => a.severity === alertFilter);
  }, [alerts, alertFilter]);

  const overdueCars = useMemo(() => {
    return cars
      .filter((c) => c.status === 'open' || c.status === 'responded')
      .map((c) => ({ car: c, timeline: evaluateCarTimeline(c, todayISO) }))
      .filter((x) => x.timeline.isResponseOverdue || x.timeline.isActionOverdue);
  }, [cars, todayISO]);

  const canResolve = canPerformAction(role, 'resolve_alert');
  const canDelete = canPerformAction(role, 'delete_any_record');

  const handleQuickExportSummary = () => {
    exportToCsvWithBom(
      `ISO17025_Summary_${todayISO}.csv`,
      ['หมวดหมู่ตัวชี้วัด', 'ค่าปัจจุบัน', 'หน่วย', 'หมายเหตุ'],
      [
        ['อัตราความสอดคล้องรวม (Conformity Rate)', metrics.conformityRate, '%', `จาก ${metrics.totalChecklists} รายการ`],
        ['ความสอดคล้องกิจกรรมการทดสอบ (Testing)', metrics.testingConformityRate, '%', 'ISO/IEC 17025'],
        ['ความสอดคล้องกิจกรรมการสอบเทียบ (Calibration)', metrics.calibrationConformityRate, '%', 'ISO/IEC 17025'],
        ['CAR ค้างดำเนินการ', metrics.openCarCount, 'ใบ', 'FM-LB-012'],
        ['NC กระทบผลทดสอบค้างดำเนินการ', metrics.openNcCount, 'ใบ', 'PD-LB-015'],
        ['PAR ค้างดำเนินการ', metrics.openParCount, 'ใบ', 'FM-LB-014'],
        ['เครื่องมือสถานะผ่านเกณฑ์', metrics.equipmentCompliantCount, 'เครื่อง', 'หมวด 6.4/6.5'],
        ['แจ้งเตือนค่าเบี่ยงเบนวิกฤต', metrics.activeCriticalAlerts, 'รายการ', 'ต้องดำเนินการเร่งด่วน'],
      ]
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Export/Print */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            บริษัท เวท ซุปพีเรีย คอนซัลแตนท์ จำกัด · ห้องปฏิบัติการสมุทรสาคร · ISO/IEC 17025:2017
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            แดชบอร์ดตรวจติดตามคุณภาพภายในและการแจ้งเตือนค่าเบี่ยงเบน
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenPrintModal('REPORT-EXEC')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์รายงานสรุปผู้บริหาร
          </button>
          <button
            type="button"
            onClick={() => onOpenPrintModal('FM-LB-025')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์สรุป FM-LB-025
          </button>
          <button
            type="button"
            onClick={handleQuickExportSummary}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออกสรุป CSV
          </button>
        </div>
      </div>

      {role === 'quality_manager' &&
        !cloudLoading &&
        totalOperationalRecords > 0 &&
        !hasResetWorkspace && (
          <section className="bg-red-50/70 border border-red-200 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                Admin Action · ล้างข้อมูลจำลองและข้อมูลเดิมในฐานข้อมูล
              </div>
              <h2 className="text-base font-bold text-slate-900">
                พบข้อมูลเดิมค้างอยู่ในระบบจำนวน {totalOperationalRecords} รายการ
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                คุณสามารถลบข้อมูลจำลองและข้อมูลปฏิบัติการเดิมทั้งหมด (โปรแกรม FM-LB-023, ตาราง FM-LB-022, รายการตรวจ FM-LB-024, CAR/PAR, เครื่องมือ และการแจ้งเตือน) ออกจากฐานข้อมูล Cloud Firestore ได้ทันทีเพื่อเริ่มต้นใช้งานใหม่ โดยบัญชีผู้ใช้และสิทธิ์ RBAC จะยังคงอยู่
              </p>
            </div>
            <button
              type="button"
              disabled={isWiping}
              onClick={() => setShowWipeConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isWiping ? 'กำลังลบข้อมูล...' : 'ลบข้อมูลจำลองทั้งหมดทันที'}
            </button>
          </section>
        )}

      {programsCount === 0 &&
        schedulesCount === 0 &&
        metrics.totalChecklists === 0 &&
        equipment.length === 0 &&
        cars.length === 0 &&
        pars.length === 0 && (
          <section className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Workspace Ready · ISO/IEC 17025:2017
              </div>
              <h2 className="text-base font-bold text-slate-900">
                ระบบพร้อมสำหรับการเริ่มต้นวางแผนตรวจติดตามคุณภาพประจำปีใหม่
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                ยังไม่มีข้อมูลการตรวจติดตาม เครื่องมือ หรือใบ CAR/PAR ในระบบ คุณสามารถเริ่มต้นสร้างโปรแกรมและตารางตรวจประจำปี (FM-LB-023 / FM-LB-022) หรือเพิ่มทะเบียนเครื่องมือได้ทันที
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('program_schedule')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                เริ่มแผนตรวจประจำปี (FM-LB-023/022)
              </button>
              <button
                type="button"
                onClick={() => onNavigate('equipment_trends')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 whitespace-nowrap"
              >
                <Wrench className="w-3.5 h-3.5" />
                เพิ่มทะเบียนเครื่องมือ
              </button>
            </div>
          </section>
        )}

      {/* Primary KPI Strip */}
      <section aria-label="ตัวชี้วัดหลัก" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">ความสอดคล้องรวม (Conformity)</div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900">
            {metrics.conformityRate}%
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span>Testing {metrics.testingConformityRate}%</span>
            <span aria-hidden="true">·</span>
            <span>Calibration {metrics.calibrationConformityRate}%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">CAR / NC / PAR ค้างดำเนินการ</div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900">
            {metrics.openCarCount + metrics.openNcCount + metrics.openParCount}
            <span className="text-sm font-sans font-normal text-slate-500 ml-2">รายการ</span>
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-2 font-mono-tabular">
            <span>CAR {metrics.openCarCount}</span>
            <span aria-hidden="true">/</span>
            <span className="text-red-700 font-medium">NC {metrics.openNcCount}</span>
            <span aria-hidden="true">/</span>
            <span>PAR {metrics.openParCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">สถานะเครื่องมือและกระบวนการ</div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900">
            {metrics.equipmentCompliantCount}/{equipment.length}
            <span className="text-sm font-sans font-normal text-slate-500 ml-2">ปกติ</span>
          </div>
          <div className="text-xs flex items-center gap-2">
            <span className="text-amber-700 font-medium">เฝ้าระวัง {metrics.equipmentWarningCount}</span>
            <span aria-hidden="true">·</span>
            <span className="text-red-700 font-medium">ไม่สอดคล้อง {metrics.equipmentNonCompliantCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">แจ้งเตือนค่าเบี่ยงเบนที่ยังไม่ปิด</div>
          <div className="text-3xl font-bold font-mono-tabular text-red-700">
            {metrics.activeCriticalAlerts + metrics.activeWarningAlerts}
            <span className="text-sm font-sans font-normal text-slate-500 ml-2">เหตุการณ์</span>
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="text-red-700 font-medium">วิกฤต {metrics.activeCriticalAlerts}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-medium">เตือน {metrics.activeWarningAlerts}</span>
          </div>
        </div>
      </section>

      {/* Main Split: Deviation Alerts (Focal Anchor) + Testing vs Calibration Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Deviation Alert Engine */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                ระบบแจ้งเตือนค่าเบี่ยงเบนจากข้อกำหนด (Real-time Alerts)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ตรวจจับอัตโนมัติเมื่อเครื่องมือเกินพิกัดความเผื่อ ครบกำหนดสอบเทียบ PT |Z| ≥ 2.0 หรือ CAR เกิน 7 วันทำการ
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['all', 'critical', 'warning'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAlertFilter(f)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    alertFilter === f
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f === 'all' ? 'ทั้งหมด' : f === 'critical' ? 'วิกฤต' : 'เฝ้าระวัง'}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {activeAlerts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-medium text-slate-900">ไม่พบการแจ้งเตือนค่าเบี่ยงเบนที่ค้างอยู่</div>
                <div className="text-xs text-slate-500">เครื่องมือและกระบวนการทั้งหมดสอดคล้องตามเกณฑ์ ISO/IEC 17025</div>
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div key={alert.id} className="p-5 space-y-3 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {alert.severity === 'critical' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            <AlertOctagon className="w-3.5 h-3.5" />
                            วิกฤต
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            เฝ้าระวัง
                          </span>
                        )}
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-mono-tabular text-slate-600">{alert.alertCode}</span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-mono-tabular text-slate-600">ข้อกำหนด {alert.clause}</span>
                        {alert.relatedCode && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-mono-tabular text-slate-700 font-medium">{alert.relatedCode}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>

                  {(alert.measuredValue || alert.thresholdValue) && (
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                      <span>ค่าที่ตรวจพบ: <strong className="text-slate-900">{alert.measuredValue ?? '-'}</strong></span>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <span>เกณฑ์ข้อกำหนด: <strong>{alert.thresholdValue ?? '-'}</strong></span>
                      {alert.resolvedCarNo && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">|</span>
                          <span>อ้างอิงเอกสาร: <strong className="text-slate-900">{alert.resolvedCarNo}</strong></span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {alert.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100 transition-colors"
                      >
                        รับทราบเหตุการณ์
                      </button>
                    )}
                    {canResolve && !alert.resolvedCarNo && (
                      <>
                        <button
                          type="button"
                          onClick={() => onResolveAlertWithCar(alert.id, 'CAR')}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                        >
                          ออกใบ CAR (FM-LB-011)
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveAlertWithCar(alert.id, 'NC')}
                          className="px-3 py-1.5 text-xs font-medium bg-red-700 text-white rounded hover:bg-red-800 transition-colors"
                        >
                          ออกใบ NC กระทบผลทดสอบ
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveAlertWithCar(alert.id, 'PAR')}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100 transition-colors"
                        >
                          ออกใบ PAR (FM-LB-013)
                        </button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <span className="text-xs text-slate-500">
                        รับทราบแล้วโดย {alert.acknowledgedBy}
                      </span>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(alert)}
                        aria-label={`ลบการแจ้งเตือน ${alert.alertCode}`}
                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Equipment Compliance & PD-LB-021 Deadlines */}
        <div className="lg:col-span-5 space-y-6">
          {/* Equipment & Process Instant Status */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                ความสอดคล้องเครื่องมือและกระบวนการ
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('equipment_trends')}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                ดูทั้งหมด
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {equipment.length === 0 ? (
                <div className="p-6 text-center space-y-1.5">
                  <Wrench className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-xs font-medium text-slate-700">ยังไม่มีข้อมูลเครื่องมือหรือจุดตรวจวัดในทะเบียน</div>
                  <div className="text-[11px] text-slate-500">
                    ไปที่เมนู &ldquo;เครื่องมือและแนวโน้ม&rdquo; เพื่อเพิ่มเครื่องมือ Testing / Calibration / Environment
                  </div>
                </div>
              ) : (
                equipment.map((eq) => (
                  <div key={eq.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-slate-700">{eq.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{eq.category === 'testing' ? 'Testing' : eq.category === 'calibration' ? 'Calibration' : 'Environment'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">ข้อ {eq.clause}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 truncate mt-0.5">{eq.name}</div>
                      <div className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                        วัดได้ {eq.lastMeasuredValue} {eq.unit} (เกณฑ์ {eq.nominalValue} ± {eq.tolerance}) · ครบกำหนด {eq.nextCalDate}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {eq.status === 'compliant' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ผ่านเกณฑ์
                        </span>
                      )}
                      {eq.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          เฝ้าระวัง
                        </span>
                      )}
                      {eq.status === 'non_compliant' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          ไม่สอดคล้อง
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* PD-LB-021 7-day / 30-day Compliance Watch + Quick Forms */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                ติดตามกำหนดเวลา PD-LB-021 (7 / 30 วันทำการ)
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('car_par')}
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                เปิดบัญชี CAR/PAR
              </button>
            </div>

            {overdueCars.length === 0 ? (
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3">
                ใบ CAR / NC ทั้งหมดอยู่ในกรอบเวลา 7 วันทำการ (และไม่เกิน 30 วันทำการเมื่อขยายเวลา)
              </div>
            ) : (
              <div className="space-y-2">
                {overdueCars.map(({ car, timeline }) => (
                  <div key={car.id} className="p-3 bg-red-50/60 border border-red-200 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-red-800">
                      <span className="font-mono-tabular">{car.carNo} · ข้อ {car.clause}</span>
                      <span className="font-mono-tabular">ผ่านมา {timeline.businessDaysElapsed} วันทำการ</span>
                    </div>
                    <div className="text-red-700 line-clamp-2">{car.part1Detail}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-500 mb-2.5">ทางลัดเข้าสู่แบบฟอร์มมาตรฐาน</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('audit_execution')}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-800"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
                  FM-LB-024 Checklist
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPrintModal('FM-LB-012')}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-800"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  บัญชี CAR (012)
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPrintModal('FM-LB-014')}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-800"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  บัญชี PAR (014)
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('equipment_trends')}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-800"
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-600" />
                  บันทึกผลสอบเทียบ
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="ยืนยันการลบการแจ้งเตือนค่าเบี่ยงเบน"
        itemLabel={deleteTarget ? `${deleteTarget.alertCode} — ${deleteTarget.title}` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteAlert(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={showWipeConfirm}
        title="ยืนยันการลบข้อมูลจำลองและข้อมูลเดิมทั้งหมด (Fresh Start)"
        itemLabel={`ข้อมูลปฏิบัติการทั้งหมด ${totalOperationalRecords} รายการในฐานข้อมูล (บัญชีผู้ใช้และสิทธิ์ RBAC จะยังคงอยู่)`}
        confirmLabel="ยืนยันลบข้อมูลทั้งหมด"
        onCancel={() => setShowWipeConfirm(false)}
        onConfirm={async () => {
          setShowWipeConfirm(false);
          setIsWiping(true);
          try {
            await onClearAllWorkspaceData();
          } finally {
            setIsWiping(false);
          }
        }}
      />
    </div>
  );
};
