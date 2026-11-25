import React, { useState } from 'react';
import { Cloud, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { ROLE_LABELS, UserRole } from '../types/iso17025';

interface LoginViewProps {
  authError: string | null;
  onSignInGoogle: () => void;
  onSignInSandbox: (role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  authError,
  onSignInGoogle,
  onSignInSandbox,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('quality_manager');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
        <div className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Vet Superior ISO/IEC 17025
        </div>
        <div className="hidden sm:block text-xs text-slate-500 font-mono-tabular whitespace-nowrap">
          PD-LB-021 Rev.02 · Quality Audit &amp; Compliance Portal
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-5 md:p-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Laboratory Context */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-7 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-mono-tabular text-slate-500">
                บริษัท เวท ซุปพีเรีย คอนซัลแตนท์ จำกัด · ห้องปฏิบัติการสมุทรสาคร
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                ระบบตรวจติดตามคุณภาพภายใน ISO/IEC 17025:2017
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                ครอบคลุมทั้งกิจกรรมการทดสอบ (Testing) และการสอบเทียบ (Calibration) พร้อมรายงานสรุปผลแบบเรียลไทม์ การวิเคราะห์แนวโน้ม การแจ้งเตือนค่าเบี่ยงเบน และการควบคุมสิทธิ์การแก้ไข-ลบข้อมูลตามบทบาท (RBAC)
              </p>
            </div>

            <div className="border-t border-slate-200 pt-5 space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">สอดคล้องเอกสารควบคุมมาตรฐานครบชุด</div>
                  <div className="text-slate-500 mt-0.5 font-mono-tabular">
                    PD-LB-021 Rev.02 · FM-LB-011 ถึง FM-LB-014 · FM-LB-022 ถึง FM-LB-025
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">ความปลอดภัยและการตรวจสอบย้อนกลับ</div>
                  <div className="text-slate-500 mt-0.5">
                    บันทึกทุกการสร้าง แก้ไข และลบข้อมูลลงใน Audit Trail อัตโนมัติ พร้อมกำหนดสิทธิ์ Admin เพื่อบริหารจัดการข้อมูลอย่างสมบูรณ์
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Login Card */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-7 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">เข้าสู่ระบบ (Sign In)</h2>
                <p className="text-xs text-slate-500 mt-1">
                  เข้าสู่ระบบผ่านบัญชี Google เพื่อซิงค์ข้อมูล Cloud Firestore จริง หรือเลือกบทบาทสำหรับเข้าใช้งานแบบออฟไลน์ (ไม่มีข้อมูลจำลอง)
                </p>
              </div>

              {authError && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                  ไม่สามารถเข้าสู่ระบบด้วย Google ได้: {authError}
                </div>
              )}

              <button
                type="button"
                onClick={onSignInGoogle}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
              >
                <Cloud className="w-4 h-4" />
                เข้าสู่ระบบด้วยบัญชี Google (Cloud Sync)
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs text-slate-400">หรือเลือกบทบาท (ใช้งานแบบออฟไลน์)</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  เลือกบทบาทผู้ใช้งานที่ต้องการเข้าสู่ระบบ
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => {
                    const active = selectedRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`p-3 rounded-md border text-left transition-colors ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-semibold">{ROLE_LABELS[role].th}</div>
                        <div className={`text-[11px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {ROLE_LABELS[role].level}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSignInSandbox(selectedRole)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              เข้าสู่ระบบด้วยสิทธิ์ที่เลือก ({ROLE_LABELS[selectedRole].en})
            </button>
          </section>
        </div>
      </main>

      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        Vet Superior Consultant Co., Ltd. · Samutsakhon Laboratory · ISO/IEC 17025:2017 Internal Audit System
      </footer>
    </div>
  );
};
