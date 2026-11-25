import React, { useMemo, useState } from 'react';
import { Activity, AlertOctagon, AlertTriangle, CheckCircle2, Download, Pencil, Plus, Printer, Sliders, Trash2, X } from 'lucide-react';
import { EquipmentItem, UserProfile } from '../types/iso17025';
import { canPerformAction, DashboardMetrics, exportToCsvWithBom } from '../utils/isoRules';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface EquipmentTrendsViewProps {
  equipment: EquipmentItem[];
  metrics: DashboardMetrics;
  currentUser: UserProfile;
  onLogReading: (
    equipmentId: string,
    payload: {
      lastMeasuredValue: number;
      ptZScore?: number;
      lastCalDate: string;
      nextCalDate: string;
      remarks?: string;
    }
  ) => void;
  onAddEquipment: (
    input: Omit<EquipmentItem, 'id' | 'status' | 'updatedBy' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateEquipment: (
    equipmentId: string,
    payload: Omit<EquipmentItem, 'id' | 'status' | 'updatedBy' | 'createdAt' | 'updatedAt'>
  ) => void;
  onDeleteEquipment: (equipmentId: string) => void;
  onOpenPrintModal: (formCode: 'REPORT-EQUIP') => void;
}

export const EquipmentTrendsView: React.FC<EquipmentTrendsViewProps> = ({
  equipment,
  metrics,
  currentUser,
  onLogReading,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  onOpenPrintModal,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | EquipmentItem['category']>('all');
  const [editingEq, setEditingEq] = useState<EquipmentItem | null>(null);
  const [measuredVal, setMeasuredVal] = useState('');
  const [zScoreVal, setZScoreVal] = useState('');
  const [lastCalVal, setLastCalVal] = useState('');
  const [nextCalVal, setNextCalVal] = useState('');
  const [remarksVal, setRemarksVal] = useState('');

  // Add / Edit Equipment metadata modal state
  const [eqFormMode, setEqFormMode] = useState<'add' | EquipmentItem | null>(null);
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fCat, setFCat] = useState<EquipmentItem['category']>('testing');
  const [fClause, setFClause] = useState('6.4');
  const [fDept, setFDept] = useState('ห้องปฏิบัติการทดสอบ');
  const [fNominal, setFNominal] = useState('0');
  const [fTolerance, setFTolerance] = useState('0.5');
  const [fMeasured, setFMeasured] = useState('0');
  const [fUnit, setFUnit] = useState('°C');
  const [fZScore, setFZScore] = useState('');
  const defaultNextCal = () => new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

  const [fLastCal, setFLastCal] = useState(new Date().toISOString().slice(0, 10));
  const [fNextCal, setFNextCal] = useState(defaultNextCal);
  const [fRemarks, setFRemarks] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EquipmentItem | null>(null);

  const canLog = canPerformAction(currentUser.role, 'log_measurement');
  const canManageEq = canPerformAction(currentUser.role, 'manage_equipment');
  const canAdminEdit = canPerformAction(currentUser.role, 'edit_any_record');
  const canAdminDelete = canPerformAction(currentUser.role, 'delete_any_record');

  const openAddEquipmentModal = () => {
    setEqFormMode('add');
    setFCode('');
    setFName('');
    setFCat('testing');
    setFClause('6.4');
    setFDept('ห้องปฏิบัติการทดสอบ');
    setFNominal('25');
    setFTolerance('1');
    setFMeasured('25');
    setFUnit('°C');
    setFZScore('');
    setFLastCal(new Date().toISOString().slice(0, 10));
    setFNextCal(defaultNextCal());
    setFRemarks('');
  };

  const openEditEquipmentModal = (item: EquipmentItem) => {
    setEqFormMode(item);
    setFCode(item.code);
    setFName(item.name);
    setFCat(item.category);
    setFClause(item.clause);
    setFDept(item.department);
    setFNominal(String(item.nominalValue));
    setFTolerance(String(item.tolerance));
    setFMeasured(String(item.lastMeasuredValue));
    setFUnit(item.unit);
    setFZScore(item.ptZScore !== undefined ? String(item.ptZScore) : '');
    setFLastCal(item.lastCalDate);
    setFNextCal(item.nextCalDate);
    setFRemarks(item.remarks ?? '');
  };

  const handleSaveEquipmentForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fCode.trim() || !fName.trim()) return;
    const nominalValue = Number(fNominal);
    const tolerance = Math.max(0, Number(fTolerance));
    const lastMeasuredValue = Number(fMeasured);
    if (Number.isNaN(nominalValue) || Number.isNaN(tolerance) || Number.isNaN(lastMeasuredValue)) return;
    const ptZScoreNum = fZScore.trim() === '' ? undefined : Number(fZScore);

    const payload: Omit<EquipmentItem, 'id' | 'status' | 'updatedBy' | 'createdAt' | 'updatedAt'> = {
      code: fCode.trim(),
      name: fName.trim(),
      category: fCat,
      clause: fClause.trim() || '6.4',
      department: fDept.trim() || 'ห้องปฏิบัติการทดสอบ',
      nominalValue,
      tolerance,
      lastMeasuredValue,
      unit: fUnit.trim() || 'หน่วย',
      ptZScore: ptZScoreNum !== undefined && !Number.isNaN(ptZScoreNum) ? ptZScoreNum : undefined,
      lastCalDate: fLastCal,
      nextCalDate: fNextCal,
      remarks: fRemarks.trim() || undefined,
    };

    if (eqFormMode === 'add') {
      onAddEquipment(payload);
    } else if (eqFormMode) {
      onUpdateEquipment(eqFormMode.id, payload);
    }
    setEqFormMode(null);
  };

  const filteredEquipment = useMemo(() => {
    if (categoryFilter === 'all') return equipment;
    return equipment.filter((e) => e.category === categoryFilter);
  }, [equipment, categoryFilter]);

  const openLogModal = (item: EquipmentItem) => {
    setEditingEq(item);
    setMeasuredVal(String(item.lastMeasuredValue));
    setZScoreVal(item.ptZScore !== undefined ? String(item.ptZScore) : '');
    setLastCalVal(item.lastCalDate);
    setNextCalVal(item.nextCalDate);
    setRemarksVal(item.remarks ?? '');
  };

  const handleSaveReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEq) return;
    const numMeasured = Number(measuredVal);
    if (Number.isNaN(numMeasured)) return;
    const numZ = zScoreVal.trim() === '' ? undefined : Number(zScoreVal);

    onLogReading(editingEq.id, {
      lastMeasuredValue: numMeasured,
      ptZScore: numZ !== undefined && !Number.isNaN(numZ) ? numZ : undefined,
      lastCalDate: lastCalVal,
      nextCalDate: nextCalVal,
      remarks: remarksVal.trim(),
    });
    setEditingEq(null);
  };

  const handleExportEquipmentCsv = () => {
    exportToCsvWithBom(
      'ISO17025_Equipment_Compliance.csv',
      ['รหัสเครื่องมือ', 'ชื่อเครื่องมือ', 'ประเภท', 'ข้อกำหนด', 'หน่วยงาน', 'ค่ามาตรฐาน', 'ค่าความเผื่อ (±)', 'ค่าที่วัดได้ล่าสุด', 'หน่วย', 'PT Z-Score', 'สอบเทียบล่าสุด', 'ครบกำหนดสอบเทียบ', 'สถานะ'],
      equipment.map((e) => [
        e.code,
        e.name,
        e.category,
        e.clause,
        e.department,
        e.nominalValue,
        e.tolerance,
        e.lastMeasuredValue,
        e.unit,
        e.ptZScore ?? '',
        e.lastCalDate,
        e.nextCalDate,
        e.status,
      ])
    );
  };

  // SVG Trend Chart dimensions
  const trends = metrics.cycleTrends;
  const maxClauseFindings = Math.max(
    1,
    ...metrics.clauseGroupDistribution.map((g) => g.car + g.nc + g.ob)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-mono-tabular">
            ISO/IEC 17025 หมวด 6.3 · 6.4 · 6.5 · 7.7 · Statistical Trend & Drift Analytics
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            สถานะความสอดคล้องของเครื่องมือ กระบวนการ และการวิเคราะห์แนวโน้ม
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPrintModal('REPORT-EQUIP')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์รายงานเครื่องมือและแนวโน้ม
          </button>
          <button
            type="button"
            onClick={handleExportEquipmentCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออกข้อมูลเครื่องมือ (CSV)
          </button>
          {canManageEq && (
            <button
              type="button"
              onClick={openAddEquipmentModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มเครื่องมือใหม่
            </button>
          )}
        </div>
      </div>

      {/* Trend Charts Row */}
      <section aria-label="การวิเคราะห์แนวโน้มข้อมูล" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Audit Conformity Trend Across Cycles */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                แนวโน้มอัตราความสอดคล้อง (Conformity %) รายรอบการตรวจ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบผลประเมิน Testing &amp; Calibration จากทุกรอบการตรวจตามลำดับเวลา
              </p>
            </div>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 480 200" className="w-full h-48" role="img" aria-label="กราฟแนวโน้มอัตราความสอดคล้องรายรอบ">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = 165 - (pct / 100) * 135;
                return (
                  <g key={pct}>
                    <line x1="42" y1={y} x2="460" y2={y} stroke="#E2E8F0" strokeWidth="1" />
                    <text x="34" y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]" fontFamily="JetBrains Mono, monospace">
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {trends.length === 0 ? (
                <text x="250" y="102" textAnchor="middle" className="fill-slate-400 text-xs">
                  ยังไม่มีข้อมูลผลตรวจติดตาม (FM-LB-024) เพื่อคำนวณแนวโน้ม
                </text>
              ) : (
                <>
                  {/* Line path */}
                  <polyline
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="2.5"
                    points={trends
                      .map((t, idx) => {
                        const x = trends.length === 1 ? 250 : 75 + (idx * 350) / Math.max(1, trends.length - 1);
                        const y = 165 - (t.conformityPct / 100) * 135;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  {/* Points & Labels */}
                  {trends.map((t, idx) => {
                    const x = trends.length === 1 ? 250 : 75 + (idx * 350) / Math.max(1, trends.length - 1);
                    const y = 165 - (t.conformityPct / 100) * 135;
                    return (
                      <g key={t.cycle}>
                        <circle cx={x} cy={y} r="5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
                        <text x={x} y={y - 10} textAnchor="middle" className="fill-slate-900 text-[11px] font-semibold" fontFamily="JetBrains Mono, monospace">
                          {t.conformityPct}%
                        </text>
                        <text x={x} y="188" textAnchor="middle" className="fill-slate-600 text-[11px]" fontFamily="JetBrains Mono, monospace">
                          {t.cycle}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>
        </div>

        {/* Chart 2: ISO Clause 4-8 Finding Distribution (CAR / NC / OB) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                การกระจายตัวของข้อบกพร่องตามหมวดข้อกำหนด ISO/IEC 17025 (หมวด 4–8)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                จำแนกจำนวน CAR (สีอำพัน), NC (สีแดง), และ OB/PAR (สีน้ำเงินเข้ม)
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {metrics.clauseGroupDistribution.map((g) => {
              const total = g.car + g.nc + g.ob;
              const barPct = (total / maxClauseFindings) * 100;
              return (
                <div key={g.group} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{g.label}</span>
                    <span className="font-mono-tabular text-slate-600">
                      CAR {g.car} · NC {g.nc} · OB {g.ob}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded overflow-hidden flex">
                    {total > 0 ? (
                      <div style={{ width: `${barPct}%` }} className="flex h-full">
                        {g.nc > 0 && (
                          <div style={{ width: `${(g.nc / total) * 100}%` }} className="bg-red-600 h-full" />
                        )}
                        {g.car > 0 && (
                          <div style={{ width: `${(g.car / total) * 100}%` }} className="bg-amber-500 h-full" />
                        )}
                        {g.ob > 0 && (
                          <div style={{ width: `${(g.ob / total) * 100}%` }} className="bg-slate-700 h-full" />
                        )}
                      </div>
                    ) : (
                      <div className="w-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Equipment & Process Compliance Registry */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              ทะเบียนสถานะเครื่องมือสอบเทียบและกระบวนการตรวจวัด (Clause 6.3, 6.4, 6.5, 7.7)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              บันทึกผลตรวจวัดหรือสอบเทียบล่าสุด ระบบจะคำนวณความเบี่ยงเบนและแจ้งเตือนอัตโนมัติทันทีเมื่อเกินเกณฑ์
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(['all', 'testing', 'calibration', 'environment'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  categoryFilter === cat ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'all' ? 'ทั้งหมด' : cat === 'testing' ? 'Testing' : cat === 'calibration' ? 'Calibration' : 'Environment'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="py-3 px-4">รหัส / เครื่องมือ</th>
                <th className="py-3 px-4">หมวด · หน่วยงาน</th>
                <th className="py-3 px-4 text-right">เกณฑ์มาตรฐาน (±Tolerance)</th>
                <th className="py-3 px-4 text-right">ค่าที่วัดได้ล่าสุด</th>
                <th className="py-3 px-4 text-right">PT Z-Score</th>
                <th className="py-3 px-4">ครบกำหนดสอบเทียบ</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4 text-right">บันทึกค่า</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredEquipment.map((eq) => {
                const diff = Math.abs(eq.lastMeasuredValue - eq.nominalValue);
                const overTol = diff > eq.tolerance;
                return (
                  <tr key={eq.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="font-mono-tabular font-semibold text-slate-900">{eq.code}</div>
                      <div className="text-slate-700 mt-0.5">{eq.name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono-tabular text-slate-700">ข้อ {eq.clause}</div>
                      <div className="text-slate-500">{eq.department}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                      {eq.nominalValue} ± {eq.tolerance} {eq.unit}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap ${overTol ? 'text-red-700' : 'text-slate-900'}`}>
                      {eq.lastMeasuredValue} {eq.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular">
                      {typeof eq.ptZScore === 'number' ? (
                        <span className={Math.abs(eq.ptZScore) >= 3 ? 'text-red-700 font-semibold' : Math.abs(eq.ptZScore) >= 2 ? 'text-amber-700 font-semibold' : 'text-slate-700'}>
                          {eq.ptZScore.toFixed(2)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {eq.nextCalDate}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {eq.status === 'compliant' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ผ่านเกณฑ์
                        </span>
                      )}
                      {eq.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          เฝ้าระวัง
                        </span>
                      )}
                      {eq.status === 'non_compliant' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          ไม่สอดคล้อง
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canLog ? (
                          <button
                            type="button"
                            onClick={() => openLogModal(eq)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 text-slate-800 rounded hover:bg-slate-100 whitespace-nowrap"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            บันทึกผลตรวจวัด
                          </button>
                        ) : (
                          <span className="text-slate-400">ดูอย่างเดียว</span>
                        )}
                        {(canAdminEdit || canManageEq) && (
                          <button
                            type="button"
                            onClick={() => openEditEquipmentModal(eq)}
                            aria-label={`แก้ไข ${eq.code}`}
                            title="แก้ไขข้อมูลเครื่องมือ"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canAdminDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(eq)}
                            aria-label={`ลบ ${eq.code}`}
                            title="ลบเครื่องมือ"
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEquipment.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-slate-500">
                    ยังไม่มีข้อมูลเครื่องมือหรือจุดตรวจวัดในหมวดนี้ กด &ldquo;เพิ่มเครื่องมือใหม่&rdquo; เพื่อเริ่มต้นบันทึกทะเบียน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Log Reading Modal */}
      {editingEq && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="eq-modal-title">
          <form onSubmit={handleSaveReading} className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4 shadow-lg">
            <div>
              <div className="text-xs font-mono-tabular text-slate-500">{editingEq.code} · เกณฑ์ {editingEq.nominalValue} ± {editingEq.tolerance} {editingEq.unit}</div>
              <h3 id="eq-modal-title" className="text-base font-bold text-slate-900 mt-0.5">
                บันทึกผลตรวจวัด / สอบเทียบ: {editingEq.name}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="eq-measured" className="block text-xs font-medium text-slate-700 mb-1">
                  ค่าที่วัดได้ ({editingEq.unit}) *
                </label>
                <input
                  id="eq-measured"
                  type="number"
                  step="any"
                  required
                  value={measuredVal}
                  onChange={(e) => setMeasuredVal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
              <div>
                <label htmlFor="eq-zscore" className="block text-xs font-medium text-slate-700 mb-1">
                  ค่า PT Z-Score (ถ้ามี)
                </label>
                <input
                  id="eq-zscore"
                  type="number"
                  step="0.01"
                  value={zScoreVal}
                  onChange={(e) => setZScoreVal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="eq-lastcal" className="block text-xs font-medium text-slate-700 mb-1">วันที่สอบเทียบล่าสุด</label>
                <input id="eq-lastcal" type="date" required value={lastCalVal} onChange={(e) => setLastCalVal(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label htmlFor="eq-nextcal" className="block text-xs font-medium text-slate-700 mb-1">ครบกำหนดสอบเทียบครั้งถัดไป</label>
                <input id="eq-nextcal" type="date" required value={nextCalVal} onChange={(e) => setNextCalVal(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
            </div>

            <div>
              <label htmlFor="eq-remarks" className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุ</label>
              <input id="eq-remarks" type="text" value={remarksVal} onChange={(e) => setRemarksVal(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingEq(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
                ยกเลิก
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                บันทึกและตรวจสอบเกณฑ์อัตโนมัติ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Equipment Metadata Modal */}
      {eqFormMode && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="eq-form-title">
          <form onSubmit={handleSaveEquipmentForm} className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="eq-form-title" className="text-base font-bold text-slate-900">
                {eqFormMode === 'add' ? 'เพิ่มเครื่องมือ / จุดตรวจวัดใหม่' : `แก้ไขข้อมูลเครื่องมือ ${eqFormMode.code}`}
              </h3>
              <button type="button" onClick={() => setEqFormMode(null)} className="p-1 text-slate-500 hover:text-slate-900" aria-label="ปิดหน้าต่าง">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">รหัสเครื่องมือ *</label>
                <input type="text" required value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="เช่น EQ-CAL-01" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อเครื่องมือ / รายการตรวจวัด *</label>
                <input type="text" required value={fName} onChange={(e) => setFName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หมวดหมู่</label>
                <select value={fCat} onChange={(e) => setFCat(e.target.value as EquipmentItem['category'])} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="testing">Testing</option>
                  <option value="calibration">Calibration</option>
                  <option value="environment">Environment</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนด ISO/IEC 17025</label>
                <input type="text" required value={fClause} onChange={(e) => setFClause(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หน่วยงานรับผิดชอบ</label>
                <input type="text" required value={fDept} onChange={(e) => setFDept(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ค่ามาตรฐาน (Nominal)</label>
                <input type="number" step="any" required value={fNominal} onChange={(e) => setFNominal(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ค่าความเผื่อ (±Tolerance)</label>
                <input type="number" step="any" min="0" required value={fTolerance} onChange={(e) => setFTolerance(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หน่วยวัด</label>
                <input type="text" required value={fUnit} onChange={(e) => setFUnit(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ค่าที่วัดได้ล่าสุด</label>
                <input type="number" step="any" required value={fMeasured} onChange={(e) => setFMeasured(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">PT Z-Score (ถ้ามี)</label>
                <input type="number" step="0.01" value={fZScore} onChange={(e) => setFZScore(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สอบเทียบล่าสุด</label>
                <input type="date" required value={fLastCal} onChange={(e) => setFLastCal(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ครบกำหนดสอบเทียบ</label>
                <input type="date" required value={fNextCal} onChange={(e) => setFNextCal(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุ</label>
                <input type="text" value={fRemarks} onChange={(e) => setFRemarks(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEqFormMode(null)} className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-md">
                ยกเลิก
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800">
                {eqFormMode === 'add' ? 'เพิ่มเครื่องมือ' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="ยืนยันการลบข้อมูลเครื่องมือ"
        itemLabel={deleteTarget ? `${deleteTarget.code} · ${deleteTarget.name}` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeleteEquipment(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
