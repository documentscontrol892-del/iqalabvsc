import { useState } from 'react';
import { AuditExecutionView } from './components/AuditExecutionView';
import { CarParView } from './components/CarParView';
import { DashboardView } from './components/DashboardView';
import { EquipmentTrendsView } from './components/EquipmentTrendsView';
import { LoginView } from './components/LoginView';
import { PrintableFormCode, PrintableFormModal } from './components/PrintableFormModal';
import { ProgramScheduleView } from './components/ProgramScheduleView';
import { SecurityAuditTrailView } from './components/SecurityAuditTrailView';
import { Sidebar, TopBar } from './components/TopBar';
import { useIsoWorkspace } from './hooks/useIsoWorkspace';
import { AuditChecklistItem, WorkspaceTab } from './types/iso17025';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [printTarget, setPrintTarget] = useState<{
    code: PrintableFormCode;
    docId?: string;
    auditRound?: string;
    yearBE?: number;
  } | null>(null);

  const ws = useIsoWorkspace();

  const handleOpenPrint = (
    code: PrintableFormCode,
    opts?: string | { docId?: string; auditRound?: string; yearBE?: number }
  ) => {
    if (!opts) {
      setPrintTarget({ code });
      return;
    }
    if (typeof opts === 'string') {
      if (code === 'FM-LB-024' || code === 'FM-LB-025' || code === 'FM-LB-022') {
        setPrintTarget({ code, auditRound: opts });
      } else {
        setPrintTarget({ code, docId: opts });
      }
      return;
    }
    setPrintTarget({ code, ...opts });
  };

  const handleIssueCarFromChecklist = async (item: AuditChecklistItem, type: 'CAR' | 'NC') => {
    await ws.createCarRecord({
      recordType: type,
      sourceType: 'internal_audit',
      sourceRef: `ครั้งที่ ${item.auditRound}`,
      part1Detail: `${item.checkItem}${item.detail ? ` — ${item.detail}` : ''}`,
      clause: item.clause,
      activityType: item.activityType,
      finderName: item.auditorName,
      foundDate: item.auditDate,
      responsiblePerson: item.auditeeName,
      checklistIdToLink: item.id,
    });
  };

  const handleIssueParFromChecklist = async (item: AuditChecklistItem) => {
    await ws.createParRecord({
      sourceType: 'internal_audit',
      sourceRef: `ครั้งที่ ${item.auditRound}`,
      clause: item.clause,
      activityType: item.activityType,
      part1Detail: `${item.checkItem}${item.detail ? ` — ${item.detail}` : ''}`,
      proposerName: item.auditorName,
      proposedDate: item.auditDate,
      responsiblePerson: item.auditeeName,
      checklistIdToLink: item.id,
    });
  };

  if (!ws.isLoggedIn) {
    return (
      <>
        <LoginView
          authError={ws.authError}
          onSignInGoogle={ws.signInWithGoogle}
          onSignInSandbox={ws.signInSandbox}
        />
        {ws.toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="no-print fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-md shadow-lg border border-slate-700"
          >
            {ws.toastMessage}
          </div>
        )}
      </>
    );
  }

  if (!ws.currentUser.isActive) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-center shadow-sm">
          <div className="text-xs font-mono-tabular text-red-700 font-semibold uppercase tracking-wider">
            Account Suspended · ISO/IEC 17025 Access Control
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            บัญชีผู้ใช้งานนี้ถูกระงับสิทธิ์ชั่วคราวโดย Admin
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            บัญชี <span className="font-mono-tabular font-semibold text-slate-800">{ws.currentUser.email}</span> ({ws.currentUser.displayName}) ถูกระงับการใช้งานระบบชั่วคราว กรุณาติดต่อผู้จัดการคุณภาพ (Quality Manager) เพื่อเปิดใช้งานสิทธิ์
          </p>
          <button
            type="button"
            onClick={ws.signOutCloud}
            className="w-full py-2.5 px-4 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  const activeAlertCount = ws.metrics.activeCriticalAlerts + ws.metrics.activeWarningAlerts;
  const openCarCount = ws.metrics.openCarCount + ws.metrics.openNcCount + ws.metrics.openParCount;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <div className={`min-h-screen flex flex-col ${printTarget ? 'no-print' : ''}`}>
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isCloudMode={ws.isCloudMode}
          currentUser={ws.currentUser}
          onSignIn={ws.signInWithGoogle}
          onSignOut={ws.signOutCloud}
          activeAlertCount={activeAlertCount}
        />

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            currentUser={ws.currentUser}
            isCloudMode={ws.isCloudMode}
            activeAlertCount={activeAlertCount}
            openCarCount={openCarCount}
          />

          <main className="flex-1 min-w-0 p-5 md:p-8 max-w-[1280px] w-full mx-auto">
            {ws.authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                ข้อผิดพลาดการยืนยันตัวตน: {ws.authError}
              </div>
            )}

            {ws.cloudLoading && (
              <div className="mb-6 p-4 bg-white border border-slate-200 rounded-md text-xs text-slate-600">
                กำลังเชื่อมต่อและซิงค์ข้อมูลระบบคุณภาพ ISO/IEC 17025 บน Cloud Firestore...
              </div>
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                metrics={ws.metrics}
                alerts={ws.alerts}
                cars={ws.cars}
                pars={ws.pars}
                equipment={ws.equipment}
                programsCount={ws.programs.length}
                schedulesCount={ws.schedules.length}
                cloudLoading={ws.cloudLoading}
                hasResetWorkspace={ws.trail.some((t) => t.action === 'RESET_WORKSPACE_FRESH_START')}
                role={ws.currentUser.role}
                onAcknowledgeAlert={ws.acknowledgeAlert}
                onResolveAlertWithCar={ws.resolveAlertWithCar}
                onDeleteAlert={ws.deleteAlert}
                onClearAllWorkspaceData={ws.clearAllWorkspaceData}
                onNavigate={setActiveTab}
                onOpenPrintModal={(code) => handleOpenPrint(code)}
              />
            )}

            {activeTab === 'program_schedule' && (
              <ProgramScheduleView
                programs={ws.programs}
                schedules={ws.schedules}
                currentUser={ws.currentUser}
                onToggleProgramMonth={ws.toggleProgramMonth}
                onApproveProgram={ws.approveProgramItem}
                onApproveAllProgramsForYear={ws.approveAllProgramsForYear}
                onStartNewAnnualPlan={ws.startNewAnnualAuditPlan}
                onAddProgram={ws.addProgramItem}
                onUpdateProgram={ws.updateProgramItem}
                onDeleteProgram={ws.deleteProgramItem}
                onAddSchedule={ws.addScheduleItem}
                onUpdateScheduleStatus={ws.updateScheduleStatus}
                onUpdateSchedule={ws.updateScheduleItem}
                onDeleteSchedule={ws.deleteScheduleItem}
                onOpenPrintModal={(code, opts) => handleOpenPrint(code, opts)}
              />
            )}

            {activeTab === 'audit_execution' && (
              <AuditExecutionView
                checklists={ws.checklists}
                schedules={ws.schedules}
                currentUser={ws.currentUser}
                onAddChecklistItem={ws.addChecklistItem}
                onUpdateChecklistResult={ws.updateChecklistResult}
                onUpdateChecklistItem={ws.updateChecklistItem}
                onDeleteChecklistItem={ws.deleteChecklistItem}
                onIssueCarFromChecklist={handleIssueCarFromChecklist}
                onIssueParFromChecklist={handleIssueParFromChecklist}
                onOpenPrintModal={(code, round) => handleOpenPrint(code, round)}
              />
            )}

            {activeTab === 'car_par' && (
              <CarParView
                cars={ws.cars}
                pars={ws.pars}
                currentUser={ws.currentUser}
                onCreateCar={ws.createCarRecord}
                onRespondCarPart2={ws.respondCarPart2}
                onVerifyCarPart3={ws.verifyCarPart3}
                onCreatePar={ws.createParRecord}
                onRespondParPart2={ws.respondParPart2}
                onVerifyParPart3={ws.verifyParPart3}
                onUpdateCarItem={ws.updateCarItem}
                onDeleteCarItem={ws.deleteCarItem}
                onUpdateParItem={ws.updateParItem}
                onDeleteParItem={ws.deleteParItem}
                onOpenPrintModal={(code, id) => handleOpenPrint(code, id)}
              />
            )}

            {activeTab === 'equipment_trends' && (
              <EquipmentTrendsView
                equipment={ws.equipment}
                metrics={ws.metrics}
                currentUser={ws.currentUser}
                onLogReading={ws.logEquipmentReading}
                onAddEquipment={ws.addEquipmentItem}
                onUpdateEquipment={ws.updateEquipmentItem}
                onDeleteEquipment={ws.deleteEquipmentItem}
                onOpenPrintModal={(code) => handleOpenPrint(code)}
              />
            )}

            {activeTab === 'security_trail' && (
              <SecurityAuditTrailView
                isCloudMode={ws.isCloudMode}
                currentUser={ws.currentUser}
                users={ws.users}
                roleInvites={ws.roleInvites}
                trail={ws.trail}
                programs={ws.programs}
                schedules={ws.schedules}
                checklists={ws.checklists}
                cars={ws.cars}
                pars={ws.pars}
                equipment={ws.equipment}
                alerts={ws.alerts}
                onSetPreviewRole={ws.setPreviewRole}
                onUpdateUserRole={ws.updateUserRole}
                onUpdateUserAccount={ws.updateUserAccount}
                onAssignUserRole={ws.assignUserRole}
                onUpdateRoleInvite={ws.updateRoleInvite}
                onDeleteRoleInvite={ws.deleteRoleInvite}
                onDeleteUserProfile={ws.deleteUserProfile}
                onSignIn={ws.signInWithGoogle}
                onResetSandbox={ws.resetSandboxData}
                onClearAllWorkspaceData={ws.clearAllWorkspaceData}
              />
            )}
          </main>
        </div>
      </div>

      <PrintableFormModal
        formCode={printTarget?.code ?? null}
        docId={printTarget?.docId}
        auditRound={printTarget?.auditRound}
        yearBE={printTarget?.yearBE}
        programs={ws.programs}
        schedules={ws.schedules}
        checklists={ws.checklists}
        cars={ws.cars}
        pars={ws.pars}
        equipment={ws.equipment}
        metrics={ws.metrics}
        alerts={ws.alerts}
        onClose={() => setPrintTarget(null)}
      />

      {ws.toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-md shadow-lg border border-slate-700"
        >
          {ws.toastMessage}
        </div>
      )}
    </div>
  );
}
