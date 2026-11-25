import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  DocumentReference,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  SEED_ALERTS,
  SEED_CARS,
  SEED_CHECKLISTS,
  SEED_EQUIPMENT,
  SEED_PARS,
  SEED_PROGRAMS,
  SEED_SCHEDULES,
  SEED_TRAIL,
  SEED_USERS,
} from '../data/seedData';
import {
  AuditChecklistItem,
  AuditProgramItem,
  AuditScheduleItem,
  AuditTrailEntry,
  CarRecord,
  DeviationAlert,
  EquipmentItem,
  ParRecord,
  ROLE_LABELS,
  RoleInvite,
  UserProfile,
  UserRole,
} from '../types/iso17025';
import {
  addBusinessDays,
  buildAnnualAuditPlanSeed,
  computeDashboardMetrics,
  createAuditTrailPayload,
  evaluateEquipmentCompliance,
  getCurrentBuddhistYear,
} from '../utils/isoRules';

const LEGACY_STORAGE_KEYS = ['iso17025_workspace_v1', 'iso17025_workspace_v2'];
const STORAGE_KEY = 'iso17025_workspace_v3';
const SANDBOX_SESSION_KEY = 'iso17025_sandbox_session_v1';

interface LocalWorkspaceState {
  users: UserProfile[];
  programs: AuditProgramItem[];
  schedules: AuditScheduleItem[];
  checklists: AuditChecklistItem[];
  cars: CarRecord[];
  pars: ParRecord[];
  equipment: EquipmentItem[];
  alerts: DeviationAlert[];
  trail: AuditTrailEntry[];
  previewRole: UserRole;
}

function getInitialLocalState(): LocalWorkspaceState {
  try {
    LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalWorkspaceState>;
      if (Array.isArray(parsed.programs) && Array.isArray(parsed.checklists)) {
        return {
          users: parsed.users ?? SEED_USERS,
          programs: parsed.programs,
          schedules: parsed.schedules ?? SEED_SCHEDULES,
          checklists: parsed.checklists,
          cars: parsed.cars ?? SEED_CARS,
          pars: parsed.pars ?? SEED_PARS,
          equipment: parsed.equipment ?? SEED_EQUIPMENT,
          alerts: parsed.alerts ?? SEED_ALERTS,
          trail: parsed.trail ?? SEED_TRAIL,
          previewRole: parsed.previewRole ?? 'quality_manager',
        };
      }
    }
  } catch {
    // Fallback to clean empty state
  }
  return {
    users: SEED_USERS,
    programs: SEED_PROGRAMS,
    schedules: SEED_SCHEDULES,
    checklists: SEED_CHECKLISTS,
    cars: SEED_CARS,
    pars: SEED_PARS,
    equipment: SEED_EQUIPMENT,
    alerts: SEED_ALERTS,
    trail: SEED_TRAIL,
    previewRole: 'quality_manager',
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function timestampToIso(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

export function useIsoWorkspace() {
  const [localState, setLocalState] = useState<LocalWorkspaceState>(getInitialLocalState);
  const [sandboxSignedIn, setSandboxSignedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SANDBOX_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudProfile, setCloudProfile] = useState<UserProfile | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cloud collections state
  const [cloudUsers, setCloudUsers] = useState<UserProfile[]>([]);
  const [cloudInvites, setCloudInvites] = useState<RoleInvite[]>([]);
  const [cloudPrograms, setCloudPrograms] = useState<AuditProgramItem[]>([]);
  const [cloudSchedules, setCloudSchedules] = useState<AuditScheduleItem[]>([]);
  const [cloudChecklists, setCloudChecklists] = useState<AuditChecklistItem[]>([]);
  const [cloudCars, setCloudCars] = useState<CarRecord[]>([]);
  const [cloudPars, setCloudPars] = useState<ParRecord[]>([]);
  const [cloudEquipment, setCloudEquipment] = useState<EquipmentItem[]>([]);
  const [cloudAlerts, setCloudAlerts] = useState<DeviationAlert[]>([]);
  const [cloudTrail, setCloudTrail] = useState<AuditTrailEntry[]>([]);

  const isCloudMode = Boolean(firebaseUser);
  const isLoggedIn = Boolean(firebaseUser) || sandboxSignedIn;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  // Persist local sandbox state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
    } catch {
      // Ignore storage quota errors
    }
  }, [localState]);

  // Listen to Firebase Auth state and bootstrap user profile (with Admin roleInvites lookup)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudProfile(null);
        setCloudInvites([]);
        setCloudUsers([]);
        return;
      }

      setCloudLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const normalizedEmail = (user.email ?? '').trim().toLowerCase();
        const isBootAdmin = normalizedEmail === 'documentscontrol892@gmail.com';
        if (snap.exists()) {
          const data = snap.data();
          setCloudProfile({
            uid: user.uid,
            email: String(data.email ?? user.email ?? ''),
            displayName: String(data.displayName ?? user.displayName ?? 'Laboratory Staff'),
            role: isBootAdmin ? 'quality_manager' : ((data.role as UserRole) ?? 'auditee'),
            department: String(data.department ?? 'ห้องปฏิบัติการทดสอบและสอบเทียบ'),
            isActive: isBootAdmin ? true : Boolean(data.isActive ?? true),
            inviteId: typeof data.inviteId === 'string' ? data.inviteId : undefined,
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          });
        } else {
          let matchedInvite: { id: string; role: UserRole; displayName: string; department: string } | null = null;
          if (!isBootAdmin && normalizedEmail) {
            try {
              const inviteSnap = await getDocs(
                query(collection(db, 'roleInvites'), where('email', '==', normalizedEmail))
              );
              const activeDoc = inviteSnap.docs.find((d) => d.data().isActive === true);
              if (activeDoc) {
                const inv = activeDoc.data();
                matchedInvite = {
                  id: activeDoc.id,
                  role: (inv.role as UserRole) ?? 'auditee',
                  displayName: String(inv.displayName ?? ''),
                  department: String(inv.department ?? ''),
                };
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.LIST, 'roleInvites');
            }
          }

          const initialRole: UserRole = isBootAdmin
            ? 'quality_manager'
            : matchedInvite?.role ?? 'auditee';
          const fallbackName =
            matchedInvite?.displayName?.trim() ||
            user.displayName?.trim() ||
            user.email?.split('@')[0] ||
            'เจ้าหน้าที่ห้องปฏิบัติการ';
          const initialDepartment = isBootAdmin
            ? 'ฝ่ายประกันคุณภาพ (Quality Management)'
            : matchedInvite?.department?.trim() || 'ห้องปฏิบัติการทดสอบ';

          const newProfile = stripUndefined({
            uid: user.uid,
            email: (normalizedEmail || 'staff@lab.local').slice(0, 200),
            displayName: fallbackName.slice(0, 120),
            role: initialRole,
            department: initialDepartment.slice(0, 120),
            isActive: true,
            inviteId: matchedInvite?.id,
          });
          await setDoc(userRef, {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setCloudProfile({
            uid: user.uid,
            email: String(newProfile.email),
            displayName: String(newProfile.displayName),
            role: initialRole,
            department: String(newProfile.department),
            isActive: true,
            inviteId: matchedInvite?.id,
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } finally {
        setCloudLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Real-time sync of the current signed-in user's profile so Admin role/status updates apply live
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const isBootAdmin = (firebaseUser.email ?? '').trim().toLowerCase() === 'documentscontrol892@gmail.com';
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setCloudProfile({
          uid: firebaseUser.uid,
          email: String(data.email ?? firebaseUser.email ?? ''),
          displayName: String(data.displayName ?? firebaseUser.displayName ?? 'Laboratory Staff'),
          role: isBootAdmin ? 'quality_manager' : ((data.role as UserRole) ?? 'auditee'),
          department: String(data.department ?? 'ห้องปฏิบัติการทดสอบและสอบเทียบ'),
          isActive: isBootAdmin ? true : Boolean(data.isActive ?? true),
          inviteId: typeof data.inviteId === 'string' ? data.inviteId : undefined,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`)
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  // Attach real-time onSnapshot listeners strictly after authReady && firebaseUser && cloudProfile && isActive
  useEffect(() => {
    if (!authReady || !firebaseUser || !cloudProfile || !cloudProfile.isActive) return;

    const unsubs: (() => void)[] = [];

    if (cloudProfile.role === 'quality_manager') {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setCloudUsers(
              snap.docs.map((d) => ({
                ...(d.data() as UserProfile),
                uid: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'roleInvites'),
            where('role', 'in', ['quality_manager', 'auditor', 'auditee', 'executive'])
          ),
          (snap) => {
            setCloudInvites(
              snap.docs
                .map((d) => ({
                  ...(d.data() as RoleInvite),
                  id: d.id,
                  createdAt: timestampToIso(d.data().createdAt),
                  updatedAt: timestampToIso(d.data().updatedAt),
                }))
                .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.email.localeCompare(b.email))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'roleInvites')
        )
      );
    } else {
      setCloudUsers([cloudProfile]);
      setCloudInvites([]);
    }

    unsubs.push(
      onSnapshot(
        query(collection(db, 'auditPrograms'), where('yearBE', '>=', 2560)),
        (snap) => {
          setCloudPrograms(
            snap.docs
              .map((d) => ({
                ...(d.data() as AuditProgramItem),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => a.sequence - b.sequence)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditPrograms')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'auditSchedules'), where('yearBE', '>=', 2560)),
        (snap) => {
          setCloudSchedules(
            snap.docs
              .map((d) => ({
                ...(d.data() as AuditScheduleItem),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => a.auditDate.localeCompare(b.auditDate))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditSchedules')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'auditChecklists'), where('yearBE', '>=', 2560)),
        (snap) => {
          setCloudChecklists(
            snap.docs
              .map((d) => ({
                ...(d.data() as AuditChecklistItem),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => a.sequence - b.sequence)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditChecklists')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'carRecords'), where('recordType', 'in', ['CAR', 'NC'])),
        (snap) => {
          setCloudCars(
            snap.docs
              .map((d) => ({
                ...(d.data() as CarRecord),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => b.foundDate.localeCompare(a.foundDate))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'carRecords')
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'parRecords'),
          where('status', 'in', ['open', 'responded', 'closed', 'reissued'])
        ),
        (snap) => {
          setCloudPars(
            snap.docs
              .map((d) => ({
                ...(d.data() as ParRecord),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => b.proposedDate.localeCompare(a.proposedDate))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'parRecords')
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'equipment'),
          where('category', 'in', ['testing', 'calibration', 'environment'])
        ),
        (snap) => {
          setCloudEquipment(
            snap.docs
              .map((d) => ({
                ...(d.data() as EquipmentItem),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => a.code.localeCompare(b.code))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'equipment')
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'deviationAlerts'),
          where('status', 'in', ['active', 'acknowledged', 'resolved'])
        ),
        (snap) => {
          setCloudAlerts(
            snap.docs
              .map((d) => ({
                ...(d.data() as DeviationAlert),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
                updatedAt: timestampToIso(d.data().updatedAt),
              }))
              .sort((a, b) => b.alertCode.localeCompare(a.alertCode))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'deviationAlerts')
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'auditTrail'),
          where('actorRole', 'in', ['quality_manager', 'auditor', 'auditee', 'executive'])
        ),
        (snap) => {
          setCloudTrail(
            snap.docs
              .map((d) => ({
                ...(d.data() as AuditTrailEntry),
                id: d.id,
                createdAt: timestampToIso(d.data().createdAt),
              }))
              .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditTrail')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser, cloudProfile]);

  // Active data resolved from Cloud vs Sandbox
  const users = isCloudMode ? cloudUsers : localState.users;
  const programs = isCloudMode ? cloudPrograms : localState.programs;
  const schedules = isCloudMode ? cloudSchedules : localState.schedules;
  const checklists = isCloudMode ? cloudChecklists : localState.checklists;
  const cars = isCloudMode ? cloudCars : localState.cars;
  const pars = isCloudMode ? cloudPars : localState.pars;
  const equipment = isCloudMode ? cloudEquipment : localState.equipment;
  const alerts = isCloudMode ? cloudAlerts : localState.alerts;
  const trail = isCloudMode ? cloudTrail : localState.trail;

  const currentUser: UserProfile = useMemo(() => {
    if (isCloudMode && cloudProfile) return cloudProfile;
    const matched = localState.users.find((u) => u.role === localState.previewRole);
    return (
      matched ?? {
        uid: `local-${localState.previewRole}`,
        email: 'offline@local.session',
        displayName: `${ROLE_LABELS[localState.previewRole].th} (ออฟไลน์)`,
        role: localState.previewRole,
        department: 'ห้องปฏิบัติการ Vet Superior Consultant',
        isActive: true,
      }
    );
  }, [isCloudMode, cloudProfile, localState.users, localState.previewRole]);

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        checklists,
        cars,
        pars,
        equipment,
        alerts,
      }),
    [checklists, cars, pars, equipment, alerts]
  );

  // Helper to append immutable audit trail
  const recordTrail = useCallback(
    async (action: string, targetCollection: string, targetCode: string, summary: string) => {
      const entry = createAuditTrailPayload({
        actorUid: currentUser.uid,
        actorName: currentUser.displayName,
        actorRole: currentUser.role,
        action,
        targetCollection,
        targetCode,
        summary,
      });

      if (isCloudMode && firebaseUser) {
        const { id, createdAt: _c, ...rest } = entry;
        try {
          await setDoc(doc(db, 'auditTrail', id), {
            ...rest,
            actorUid: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `auditTrail/${id}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          trail: [entry, ...prev.trail],
        }));
      }
    },
    [currentUser, isCloudMode, firebaseUser]
  );

  // Auth Actions
  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setSandboxSignedIn(false);
      try {
        localStorage.removeItem(SANDBOX_SESSION_KEY);
      } catch {
        // ignore
      }
      showToast('เข้าสู่ระบบคลาวด์สำเร็จ กำลังเชื่อมต่อฐานข้อมูล ISO/IEC 17025');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถเข้าสู่ระบบ Google ได้';
      setAuthError(message);
    }
  }, [showToast]);

  const signInSandbox = useCallback(
    (role: UserRole) => {
      setAuthError(null);
      setLocalState((prev) => ({ ...prev, previewRole: role }));
      setSandboxSignedIn(true);
      try {
        localStorage.setItem(SANDBOX_SESSION_KEY, 'true');
      } catch {
        // ignore
      }
      showToast(`เข้าสู่ระบบสำเร็จ (${role === 'quality_manager' ? 'Admin / ผู้จัดการคุณภาพ' : role})`);
    },
    [showToast]
  );

  const signOutCloud = useCallback(async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    setSandboxSignedIn(false);
    try {
      localStorage.removeItem(SANDBOX_SESSION_KEY);
    } catch {
      // ignore
    }
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  }, [firebaseUser, showToast]);

  const setPreviewRole = useCallback((role: UserRole) => {
    setLocalState((prev) => ({ ...prev, previewRole: role }));
    showToast(`สลับสิทธิ์ผู้ใช้งานเป็น ${role === 'quality_manager' ? 'Admin / QM' : role}`);
  }, [showToast]);

  const clearAllWorkspaceData = useCallback(async () => {
    if (currentUser.role !== 'quality_manager') {
      showToast('เฉพาะ Admin (Quality Manager) เท่านั้นที่สามารถล้างข้อมูลทั้งหมดได้');
      return;
    }

    if (isCloudMode && firebaseUser) {
      const targetQueries: Array<{ name: string; q: ReturnType<typeof query> }> = [
        { name: 'auditPrograms', q: query(collection(db, 'auditPrograms'), where('yearBE', '>=', 2560)) },
        { name: 'auditSchedules', q: query(collection(db, 'auditSchedules'), where('yearBE', '>=', 2560)) },
        { name: 'auditChecklists', q: query(collection(db, 'auditChecklists'), where('yearBE', '>=', 2560)) },
        { name: 'carRecords', q: query(collection(db, 'carRecords'), where('recordType', 'in', ['CAR', 'NC'])) },
        { name: 'parRecords', q: query(collection(db, 'parRecords'), where('status', 'in', ['open', 'responded', 'closed', 'reissued'])) },
        { name: 'equipment', q: query(collection(db, 'equipment'), where('category', 'in', ['testing', 'calibration', 'environment'])) },
        { name: 'deviationAlerts', q: query(collection(db, 'deviationAlerts'), where('status', 'in', ['active', 'acknowledged', 'resolved'])) },
      ];

      const refsToDelete: DocumentReference<unknown>[] = [];
      for (const item of targetQueries) {
        try {
          const snap = await getDocs(item.q);
          snap.docs.forEach((d) => refsToDelete.push(d.ref));
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, item.name);
        }
      }

      try {
        for (let i = 0; i < refsToDelete.length; i += 400) {
          const batch = writeBatch(db);
          refsToDelete.slice(i, i + 400).forEach((ref) => batch.delete(ref));
          await batch.commit();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'workspace_reset');
      }

      setCloudPrograms([]);
      setCloudSchedules([]);
      setCloudChecklists([]);
      setCloudCars([]);
      setCloudPars([]);
      setCloudEquipment([]);
      setCloudAlerts([]);

      await recordTrail(
        'RESET_WORKSPACE_FRESH_START',
        'workspace',
        'FRESH-START',
        `Admin ล้างข้อมูลปฏิบัติการทั้งหมด (${refsToDelete.length} รายการ) เพื่อเริ่มต้นระบบใหม่`
      );
      showToast('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว ระบบพร้อมเริ่มต้นใช้งานใหม่');
    } else {
      try {
        LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      setLocalState((prev) => ({
        users: prev.users,
        programs: [],
        schedules: [],
        checklists: [],
        cars: [],
        pars: [],
        equipment: [],
        alerts: [],
        trail: [],
        previewRole: prev.previewRole,
      }));
      showToast('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว ระบบพร้อมเริ่มต้นใช้งานใหม่');
    }
  }, [currentUser.role, isCloudMode, firebaseUser, recordTrail, showToast]);

  const resetSandboxData = useCallback(() => {
    void clearAllWorkspaceData();
  }, [clearAllWorkspaceData]);

  // --- Mutations ---
  const toggleProgramMonth = useCallback(
    async (programId: string, monthIndex: number) => {
      const target = programs.find((p) => p.id === programId);
      if (!target) return;
      const nextMonths = target.months.map((v, i) => (i === monthIndex ? !v : v));

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditPrograms', programId), {
            months: nextMonths,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditPrograms/${programId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          programs: prev.programs.map((p) => (p.id === programId ? { ...p, months: nextMonths } : p)),
        }));
      }
      await recordTrail(
        'UPDATE_AUDIT_PROGRAM',
        'auditPrograms',
        `FM-LB-023 #${target.sequence}`,
        `ปรับปรุงกำหนดเดือนตรวจประเมินกิจกรรม "${target.activity}"`
      );
    },
    [programs, isCloudMode, recordTrail]
  );

  const approveProgramItem = useCallback(
    async (programId: string) => {
      const target = programs.find((p) => p.id === programId);
      if (!target) return;
      const todayStr = new Date().toISOString().slice(0, 10);

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditPrograms', programId), {
            status: 'approved',
            approvedBy: currentUser.displayName,
            approvedDate: todayStr,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditPrograms/${programId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          programs: prev.programs.map((p) =>
            p.id === programId
              ? { ...p, status: 'approved', approvedBy: currentUser.displayName, approvedDate: todayStr }
              : p
          ),
        }));
      }
      await recordTrail(
        'APPROVE_AUDIT_PROGRAM',
        'auditPrograms',
        `FM-LB-023 #${target.sequence}`,
        `อนุมัติแผนโปรแกรมการตรวจติดตามคุณภาพภายในลำดับที่ ${target.sequence}`
      );
      showToast('อนุมัติโปรแกรมการตรวจติดตามเรียบร้อยแล้ว');
    },
    [programs, isCloudMode, currentUser.displayName, recordTrail, showToast]
  );

  const approveAllProgramsForYear = useCallback(
    async (yearBE: number) => {
      const drafts = programs.filter((p) => p.yearBE === yearBE && p.status !== 'approved');
      if (drafts.length === 0) {
        showToast(`แผนปี พ.ศ. ${yearBE} ได้รับการอนุมัติครบทุกรายการแล้ว`);
        return;
      }
      const todayStr = new Date().toISOString().slice(0, 10);

      if (isCloudMode) {
        try {
          for (let i = 0; i < drafts.length; i += 400) {
            const batch = writeBatch(db);
            drafts.slice(i, i + 400).forEach((item) => {
              batch.update(doc(db, 'auditPrograms', item.id), {
                status: 'approved',
                approvedBy: currentUser.displayName,
                approvedDate: todayStr,
                updatedAt: serverTimestamp(),
              });
            });
            await batch.commit();
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'auditPrograms');
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          programs: prev.programs.map((p) =>
            p.yearBE === yearBE && p.status !== 'approved'
              ? { ...p, status: 'approved', approvedBy: currentUser.displayName, approvedDate: todayStr }
              : p
          ),
        }));
      }
      await recordTrail(
        'APPROVE_ANNUAL_PROGRAM',
        'auditPrograms',
        `FM-LB-023/${yearBE}`,
        `อนุมัติโปรแกรมตรวจติดตามคุณภาพภายในประจำปี พ.ศ. ${yearBE} จำนวน ${drafts.length} กิจกรรม`
      );
      showToast(`อนุมัติแผนประจำปี พ.ศ. ${yearBE} ครบทั้ง ${drafts.length} รายการแล้ว`);
    },
    [programs, isCloudMode, currentUser.displayName, recordTrail, showToast]
  );

  const startNewAnnualAuditPlan = useCallback(
    async (input: {
      yearBE: number;
      mode: 'standard' | 'copy' | 'blank';
      sourceYearBE?: number;
      createInitialSchedule: boolean;
      initialRound?: string;
      initialStartDate?: string;
      defaultAuditorName?: string;
      defaultAuditeeName?: string;
      replaceExistingYear?: boolean;
    }) => {
      const safeYearBE = Math.max(2560, Math.min(2700, Math.trunc(input.yearBE)));
      const ownerUid = isCloudMode && firebaseUser ? firebaseUser.uid : currentUser.uid;
      const sourcePrograms =
        input.mode === 'copy' && input.sourceYearBE
          ? programs.filter((p) => p.yearBE === input.sourceYearBE)
          : undefined;

      const built = buildAnnualAuditPlanSeed({
        yearBE: safeYearBE,
        mode: input.mode,
        preparedBy: currentUser.displayName,
        createdBy: ownerUid,
        sourcePrograms,
        createInitialSchedule: input.createInitialSchedule,
        initialRound: input.initialRound,
        initialStartDate: input.initialStartDate,
        defaultAuditorName: input.defaultAuditorName,
        defaultAuditeeName: input.defaultAuditeeName,
      });

      if (isCloudMode && firebaseUser) {
        if (input.replaceExistingYear) {
          const oldProgRefs = programs.filter((p) => p.yearBE === safeYearBE).map((p) => doc(db, 'auditPrograms', p.id));
          const oldSchRefs = schedules.filter((s) => s.yearBE === safeYearBE).map((s) => doc(db, 'auditSchedules', s.id));
          const allOld = [...oldProgRefs, ...oldSchRefs];
          try {
            for (let i = 0; i < allOld.length; i += 400) {
              const delBatch = writeBatch(db);
              allOld.slice(i, i + 400).forEach((r) => delBatch.delete(r));
              await delBatch.commit();
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, 'auditPrograms');
          }
        }

        const writeOps: Array<{ col: 'auditPrograms' | 'auditSchedules'; id: string; data: Record<string, unknown> }> = [
          ...built.programs.map((item) => {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            return {
              col: 'auditPrograms' as const,
              id,
              data: { ...stripUndefined(rest), createdBy: firebaseUser.uid },
            };
          }),
          ...built.schedules.map((item) => {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            return {
              col: 'auditSchedules' as const,
              id,
              data: { ...stripUndefined(rest), createdBy: firebaseUser.uid },
            };
          }),
        ];

        try {
          for (let i = 0; i < writeOps.length; i += 400) {
            const batch = writeBatch(db);
            writeOps.slice(i, i + 400).forEach((op) => {
              batch.set(doc(db, op.col, op.id), {
                ...op.data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            });
            await batch.commit();
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'auditPrograms');
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          programs: [
            ...(input.replaceExistingYear ? prev.programs.filter((p) => p.yearBE !== safeYearBE) : prev.programs),
            ...built.programs,
          ],
          schedules: [
            ...(input.replaceExistingYear ? prev.schedules.filter((s) => s.yearBE !== safeYearBE) : prev.schedules),
            ...built.schedules,
          ],
        }));
      }

      await recordTrail(
        'START_ANNUAL_AUDIT_PLAN',
        'auditPrograms',
        `FM-LB-023/${safeYearBE}`,
        `เริ่มแผนการตรวจติดตามคุณภาพภายในประจำปี พ.ศ. ${safeYearBE} (โปรแกรม ${built.programs.length} กิจกรรม, กำหนดการ ${built.schedules.length} รายการ)`
      );
      showToast(
        built.programs.length > 0 || built.schedules.length > 0
          ? `สร้างแผนตรวจประจำปี พ.ศ. ${safeYearBE} เรียบร้อยแล้ว (${built.programs.length} กิจกรรม, ${built.schedules.length} กำหนดการ)`
          : `เปิดปีงบประมาณแผนตรวจ พ.ศ. ${safeYearBE} แล้ว`
      );
      return { programCount: built.programs.length, scheduleCount: built.schedules.length };
    },
    [programs, schedules, isCloudMode, firebaseUser, currentUser.uid, currentUser.displayName, recordTrail, showToast]
  );

  const addProgramItem = useCallback(
    async (input: Omit<AuditProgramItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      const id = `prog-${Date.now()}`;
      const newItem: AuditProgramItem = {
        ...input,
        id,
        createdBy: currentUser.uid,
      };
      if (isCloudMode && firebaseUser) {
        const { id: _id, ...rest } = newItem;
        try {
          await setDoc(doc(db, 'auditPrograms', id), {
            ...stripUndefined(rest),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `auditPrograms/${id}`);
        }
      } else {
        setLocalState((prev) => ({ ...prev, programs: [...prev.programs, newItem] }));
      }
      await recordTrail('CREATE_AUDIT_PROGRAM', 'auditPrograms', `FM-LB-023 #${input.sequence}`, `เพิ่มกิจกรรม "${input.activity}" ในโปรแกรมประจำปี`);
      showToast('เพิ่มกิจกรรมใน FM-LB-023 แล้ว');
    },
    [currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const addScheduleItem = useCallback(
    async (input: Omit<AuditScheduleItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      const id = `sch-${Date.now()}`;
      const newItem: AuditScheduleItem = {
        ...input,
        id,
        createdBy: currentUser.uid,
      };
      if (isCloudMode && firebaseUser) {
        const { id: _id, ...rest } = newItem;
        try {
          await setDoc(doc(db, 'auditSchedules', id), {
            ...stripUndefined(rest),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `auditSchedules/${id}`);
        }
      } else {
        setLocalState((prev) => ({ ...prev, schedules: [...prev.schedules, newItem] }));
      }
      await recordTrail('CREATE_AUDIT_SCHEDULE', 'auditSchedules', `FM-LB-022 ${input.auditRound}`, `เพิ่มกำหนดการตรวจประเมินวันที่ ${input.auditDate} (${input.activity})`);
      showToast('เพิ่มกำหนดการตรวจติดตาม (FM-LB-022) แล้ว');
    },
    [currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const updateScheduleStatus = useCallback(
    async (scheduleId: string, status: AuditScheduleItem['status']) => {
      const target = schedules.find((s) => s.id === scheduleId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditSchedules', scheduleId), {
            status,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditSchedules/${scheduleId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          schedules: prev.schedules.map((s) => (s.id === scheduleId ? { ...s, status } : s)),
        }));
      }
      await recordTrail('UPDATE_SCHEDULE_STATUS', 'auditSchedules', target.auditRound, `เปลี่ยนสถานะกำหนดการ "${target.activity}" เป็น ${status}`);
    },
    [schedules, isCloudMode, recordTrail]
  );

  const addChecklistItem = useCallback(
    async (input: Omit<AuditChecklistItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      const id = `chk-${Date.now()}`;
      const newItem: AuditChecklistItem = {
        ...input,
        id,
        createdBy: currentUser.uid,
      };
      if (isCloudMode && firebaseUser) {
        const { id: _id, ...rest } = newItem;
        try {
          await setDoc(doc(db, 'auditChecklists', id), {
            ...stripUndefined(rest),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `auditChecklists/${id}`);
        }
      } else {
        setLocalState((prev) => ({ ...prev, checklists: [newItem, ...prev.checklists] }));
      }
      await recordTrail(
        'RECORD_CHECKLIST_ITEM',
        'auditChecklists',
        `FM-LB-024 Clause ${input.clause}`,
        `บันทึกผลตรวจข้อกำหนด ${input.clause} (${input.result}): ${input.checkItem}`
      );
      showToast('บันทึกรายการตรวจติดตาม (FM-LB-024) เรียบร้อยแล้ว');
      return newItem;
    },
    [currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const updateChecklistResult = useCallback(
    async (checklistId: string, result: AuditChecklistItem['result'], detail?: string, linkedDocNo?: string) => {
      const target = checklists.find((c) => c.id === checklistId);
      if (!target) return;
      const patch = stripUndefined({
        result,
        detail: detail ?? target.detail,
        linkedDocNo: linkedDocNo ?? target.linkedDocNo,
      });

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditChecklists', checklistId), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditChecklists/${checklistId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          checklists: prev.checklists.map((c) => (c.id === checklistId ? { ...c, ...patch } : c)),
        }));
      }
      await recordTrail(
        'UPDATE_CHECKLIST_RESULT',
        'auditChecklists',
        `FM-LB-024 Clause ${target.clause}`,
        `ปรับผลการตรวจข้อกำหนด ${target.clause} เป็น ${result}`
      );
    },
    [checklists, isCloudMode, recordTrail]
  );

  const createCarRecord = useCallback(
    async (input: {
      recordType: 'CAR' | 'NC';
      sourceType: CarRecord['sourceType'];
      sourceRef?: string;
      part1Detail: string;
      clause: string;
      activityType: CarRecord['activityType'];
      finderName: string;
      foundDate: string;
      responsiblePerson?: string;
      linkedParentCarNo?: string;
      checklistIdToLink?: string;
    }) => {
      const prefix = input.recordType;
      const num = cars.filter((c) => c.recordType === input.recordType).length + 1;
      const yearBE = new Date(input.foundDate).getFullYear() + 543;
      const carNo = `${prefix}-${yearBE}-${String(num).padStart(2, '0')}`;
      const id = `car-${Date.now()}`;
      const responseDueDate = addBusinessDays(input.foundDate, 7);

      const newCar: CarRecord = {
        id,
        carNo,
        recordType: input.recordType,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        part1Detail: input.part1Detail,
        clause: input.clause,
        activityType: input.activityType,
        finderName: input.finderName,
        foundDate: input.foundDate,
        responseDueDate,
        extensionCount: 0,
        responsiblePerson: input.responsiblePerson ?? '',
        verificationResult: 'pending',
        linkedParentCarNo: input.linkedParentCarNo,
        status: 'open',
        createdBy: currentUser.uid,
      };

      if (isCloudMode && firebaseUser) {
        const { id: _id, ...rest } = newCar;
        try {
          await setDoc(doc(db, 'carRecords', id), {
            ...stripUndefined(rest),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (input.checklistIdToLink) {
            await updateDoc(doc(db, 'auditChecklists', input.checklistIdToLink), {
              linkedDocNo: carNo,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `carRecords/${id}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          cars: [newCar, ...prev.cars],
          checklists: input.checklistIdToLink
            ? prev.checklists.map((c) =>
                c.id === input.checklistIdToLink ? { ...c, linkedDocNo: carNo } : c
              )
            : prev.checklists,
        }));
      }

      await recordTrail(
        'ISSUE_CAR_OR_NC',
        'carRecords',
        carNo,
        `ออกใบ ${carNo} (ข้อกำหนด ${input.clause}) กำหนดตอบแนวทางแก้ไขภายใน ${responseDueDate}`
      );
      showToast(`ออกใบ ${carNo} (FM-LB-011) เรียบร้อยแล้ว`);
      return newCar;
    },
    [cars, currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const respondCarPart2 = useCallback(
    async (
      carId: string,
      payload: {
        expansionHasIssue: boolean;
        expansionCause: string;
        rootCause: string;
        impactHasEffect: boolean;
        impactDetail: string;
        riskLikelihood: number;
        riskSeverity: number;
        riskScore: number;
        riskFm17Required: boolean;
        correctiveAction: string;
        correctiveDueDate: string;
        preventiveAction: string;
        preventiveDueDate: string;
        responsiblePerson: string;
        extensionCount: number;
      }
    ) => {
      const target = cars.find((c) => c.id === carId);
      if (!target) return;

      const patch = stripUndefined({
        ...payload,
        status: 'responded' as const,
        verificationResult: 'pending' as const,
      });

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'carRecords', carId), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `carRecords/${carId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          cars: prev.cars.map((c) => (c.id === carId ? { ...c, ...patch } : c)),
        }));
      }

      await recordTrail(
        'SUBMIT_CAR_PART2',
        'carRecords',
        target.carNo,
        `บันทึกสาเหตุที่แท้จริง แนวทางแก้ไข และระดับความเสี่ยง (${payload.riskScore} คะแนน) สำหรับ ${target.carNo}`
      );
      showToast(`บันทึกส่วนที่ 2 ของ ${target.carNo} แล้ว`);
    },
    [cars, isCloudMode, recordTrail, showToast]
  );

  const verifyCarPart3 = useCallback(
    async (
      carId: string,
      payload: {
        verificationResult: 'effective' | 'ineffective';
        verificationDetail: string;
        verifierName: string;
        verifyDate: string;
      }
    ) => {
      const target = cars.find((c) => c.id === carId);
      if (!target) return;

      if (payload.verificationResult === 'effective') {
        if (isCloudMode) {
          try {
            await updateDoc(doc(db, 'carRecords', carId), {
              ...payload,
              status: 'closed',
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `carRecords/${carId}`);
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            cars: prev.cars.map((c) =>
              c.id === carId ? { ...c, ...payload, status: 'closed' } : c
            ),
          }));
        }
        await recordTrail(
          'CLOSE_CAR',
          'carRecords',
          target.carNo,
          `ทวนสอบผล ${target.carNo} มีประสิทธิผล และลงนามปิด CAR ในบัญชี FM-LB-012`
        );
        showToast(`ปิด ${target.carNo} สำเร็จ`);
      } else {
        // Ineffective -> reissue linked new CAR per PD-LB-021 Clause 7.5.3
        const newCar = await createCarRecord({
          recordType: target.recordType,
          sourceType: target.sourceType,
          sourceRef: `ออกใหม่สืบเนื่องจาก ${target.carNo}`,
          part1Detail: `[ออกใหม่จากการทวนสอบไม่มีประสิทธิผล: ${target.carNo}] ${target.part1Detail}`,
          clause: target.clause,
          activityType: target.activityType,
          finderName: payload.verifierName,
          foundDate: payload.verifyDate,
          responsiblePerson: target.responsiblePerson,
          linkedParentCarNo: target.carNo,
        });

        if (isCloudMode) {
          try {
            await updateDoc(doc(db, 'carRecords', carId), {
              ...payload,
              linkedNewCarNo: newCar.carNo,
              status: 'reissued',
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `carRecords/${carId}`);
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            cars: prev.cars.map((c) =>
              c.id === carId
                ? { ...c, ...payload, linkedNewCarNo: newCar.carNo, status: 'reissued' }
                : c
            ),
          }));
        }
        await recordTrail(
          'REISSUE_CAR',
          'carRecords',
          target.carNo,
          `ทวนสอบ ${target.carNo} ไม่มีประสิทธิผล จึงไม่อนุมัติปิดและออกฉบับใหม่อ้างอิง ${newCar.carNo}`
        );
        showToast(`ทวนสอบไม่มีประสิทธิผล — ออกฉบับใหม่ ${newCar.carNo} แล้ว`);
      }
    },
    [cars, isCloudMode, createCarRecord, recordTrail, showToast]
  );

  const createParRecord = useCallback(
    async (input: {
      sourceType: ParRecord['sourceType'];
      sourceRef?: string;
      clause: string;
      activityType: ParRecord['activityType'];
      part1Detail: string;
      proposerName: string;
      proposedDate: string;
      responsiblePerson?: string;
      linkedParentParNo?: string;
      checklistIdToLink?: string;
    }) => {
      const num = pars.length + 1;
      const yearBE = new Date(input.proposedDate).getFullYear() + 543;
      const parNo = `PAR-${yearBE}-${String(num).padStart(2, '0')}`;
      const id = `par-${Date.now()}`;

      const newPar: ParRecord = {
        id,
        parNo,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        clause: input.clause,
        activityType: input.activityType,
        part1Detail: input.part1Detail,
        proposerName: input.proposerName,
        proposedDate: input.proposedDate,
        responsiblePerson: input.responsiblePerson ?? '',
        verificationResult: 'pending',
        linkedParentParNo: input.linkedParentParNo,
        status: 'open',
        createdBy: currentUser.uid,
      };

      if (isCloudMode && firebaseUser) {
        const { id: _id, ...rest } = newPar;
        try {
          await setDoc(doc(db, 'parRecords', id), {
            ...stripUndefined(rest),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (input.checklistIdToLink) {
            await updateDoc(doc(db, 'auditChecklists', input.checklistIdToLink), {
              linkedDocNo: parNo,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `parRecords/${id}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          pars: [newPar, ...prev.pars],
          checklists: input.checklistIdToLink
            ? prev.checklists.map((c) =>
                c.id === input.checklistIdToLink ? { ...c, linkedDocNo: parNo } : c
              )
            : prev.checklists,
        }));
      }

      await recordTrail('ISSUE_PAR', 'parRecords', parNo, `ออกใบคำร้องขอให้ปฏิบัติการป้องกัน ${parNo} (ข้อกำหนด ${input.clause})`);
      showToast(`ออกใบ ${parNo} (FM-LB-013) เรียบร้อยแล้ว`);
      return newPar;
    },
    [pars.length, currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const respondParPart2 = useCallback(
    async (
      parId: string,
      payload: {
        preventiveAction: string;
        expectedDueDate: string;
        responsiblePerson: string;
      }
    ) => {
      const target = pars.find((p) => p.id === parId);
      if (!target) return;

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'parRecords', parId), {
            ...payload,
            status: 'responded',
            verificationResult: 'pending',
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `parRecords/${parId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          pars: prev.pars.map((p) =>
            p.id === parId ? { ...p, ...payload, status: 'responded', verificationResult: 'pending' } : p
          ),
        }));
      }
      await recordTrail('SUBMIT_PAR_PART2', 'parRecords', target.parNo, `บันทึกแนวทางปฏิบัติการป้องกันสำหรับ ${target.parNo}`);
      showToast(`บันทึกส่วนที่ 2 ของ ${target.parNo} แล้ว`);
    },
    [pars, isCloudMode, recordTrail, showToast]
  );

  const verifyParPart3 = useCallback(
    async (
      parId: string,
      payload: {
        verificationResult: 'effective' | 'ineffective';
        verificationDetail: string;
      }
    ) => {
      const target = pars.find((p) => p.id === parId);
      if (!target) return;

      if (payload.verificationResult === 'effective') {
        if (isCloudMode) {
          try {
            await updateDoc(doc(db, 'parRecords', parId), {
              ...payload,
              status: 'closed',
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `parRecords/${parId}`);
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            pars: prev.pars.map((p) => (p.id === parId ? { ...p, ...payload, status: 'closed' } : p)),
          }));
        }
        await recordTrail('CLOSE_PAR', 'parRecords', target.parNo, `ทวนสอบ ${target.parNo} มีประสิทธิผล และปิด PAR ในบัญชี FM-LB-014`);
        showToast(`ปิด ${target.parNo} สำเร็จ`);
      } else {
        const newPar = await createParRecord({
          sourceType: target.sourceType,
          sourceRef: `ออกใหม่สืบเนื่องจาก ${target.parNo}`,
          clause: target.clause,
          activityType: target.activityType,
          part1Detail: `[ออกใหม่จากการทวนสอบไม่มีประสิทธิผล: ${target.parNo}] ${target.part1Detail}`,
          proposerName: currentUser.displayName,
          proposedDate: new Date().toISOString().slice(0, 10),
          responsiblePerson: target.responsiblePerson,
          linkedParentParNo: target.parNo,
        });
        if (isCloudMode) {
          try {
            await updateDoc(doc(db, 'parRecords', parId), {
              ...payload,
              linkedNewParNo: newPar.parNo,
              status: 'reissued',
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `parRecords/${parId}`);
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            pars: prev.pars.map((p) =>
              p.id === parId
                ? { ...p, ...payload, linkedNewParNo: newPar.parNo, status: 'reissued' }
                : p
            ),
          }));
        }
        await recordTrail('REISSUE_PAR', 'parRecords', target.parNo, `ทวนสอบ ${target.parNo} ไม่มีประสิทธิผล ออกฉบับใหม่ ${newPar.parNo}`);
        showToast(`ออก PAR ฉบับใหม่ ${newPar.parNo} แล้ว`);
      }
    },
    [pars, isCloudMode, createParRecord, currentUser.displayName, recordTrail, showToast]
  );

  // Equipment & Automatic Deviation Alert Engine
  const logEquipmentReading = useCallback(
    async (
      equipmentId: string,
      payload: {
        lastMeasuredValue: number;
        ptZScore?: number;
        lastCalDate: string;
        nextCalDate: string;
        remarks?: string;
      }
    ) => {
      const target = equipment.find((e) => e.id === equipmentId);
      if (!target) return;

      const todayISO = new Date().toISOString().slice(0, 10);
      const evaluation = evaluateEquipmentCompliance(
        {
          nextCalDate: payload.nextCalDate,
          nominalValue: target.nominalValue,
          tolerance: target.tolerance,
          lastMeasuredValue: payload.lastMeasuredValue,
          ptZScore: payload.ptZScore,
          unit: target.unit,
        },
        todayISO
      );

      const patch = stripUndefined({
        lastMeasuredValue: payload.lastMeasuredValue,
        ptZScore: payload.ptZScore,
        lastCalDate: payload.lastCalDate,
        nextCalDate: payload.nextCalDate,
        status: evaluation.status,
        remarks: payload.remarks ?? target.remarks,
        updatedBy: currentUser.uid,
      });

      if (isCloudMode && firebaseUser) {
        try {
          await updateDoc(doc(db, 'equipment', equipmentId), {
            ...patch,
            updatedBy: firebaseUser.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `equipment/${equipmentId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          equipment: prev.equipment.map((e) => (e.id === equipmentId ? { ...e, ...patch } : e)),
        }));
      }

      if (evaluation.shouldAlert) {
        const alertId = `alt-${Date.now()}`;
        const alertCode = `ALT-${getCurrentBuddhistYear()}-${String(alerts.length + 1).padStart(3, '0')}`;
        const alertObj: DeviationAlert = {
          id: alertId,
          alertCode,
          category:
            target.category === 'environment'
              ? 'environmental'
              : evaluation.reasons.some((r) => r.includes('Z-Score'))
                ? 'measurement_drift'
                : 'equipment_calibration',
          severity: evaluation.severity,
          title: `พบค่าเบี่ยงเบนของ ${target.code} (${target.name})`,
          description: evaluation.reasons.join(' · '),
          clause: target.clause,
          relatedCode: target.code,
          measuredValue: `${payload.lastMeasuredValue} ${target.unit}`,
          thresholdValue: `${target.nominalValue} ± ${target.tolerance} ${target.unit}`,
          status: 'active',
          createdBy: currentUser.uid,
        };

        if (isCloudMode && firebaseUser) {
          const { id: _id, ...rest } = alertObj;
          try {
            await setDoc(doc(db, 'deviationAlerts', alertId), {
              ...stripUndefined(rest),
              createdBy: firebaseUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `deviationAlerts/${alertId}`);
          }
        } else {
          setLocalState((prev) => ({ ...prev, alerts: [alertObj, ...prev.alerts] }));
        }
        showToast(`แจ้งเตือนอัตโนมัติ: ${target.code} พบค่าเบี่ยงเบนเกินข้อกำหนด`);
      } else {
        showToast(`บันทึกผลตรวจวัด ${target.code} เรียบร้อย (ผ่านเกณฑ์)`);
      }

      await recordTrail(
        'LOG_EQUIPMENT_READING',
        'equipment',
        target.code,
        `บันทึกค่าตรวจวัด ${payload.lastMeasuredValue} ${target.unit} สถานะ ${evaluation.status}`
      );
    },
    [equipment, alerts.length, currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      const target = alerts.find((a) => a.id === alertId);
      if (!target) return;

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'deviationAlerts', alertId), {
            status: 'acknowledged',
            acknowledgedBy: currentUser.displayName,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `deviationAlerts/${alertId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          alerts: prev.alerts.map((a) =>
            a.id === alertId
              ? { ...a, status: 'acknowledged', acknowledgedBy: currentUser.displayName }
              : a
          ),
        }));
      }
      await recordTrail('ACKNOWLEDGE_ALERT', 'deviationAlerts', target.alertCode, `รับทราบการแจ้งเตือน ${target.title}`);
      showToast(`รับทราบการแจ้งเตือน ${target.alertCode} แล้ว`);
    },
    [alerts, currentUser.displayName, isCloudMode, recordTrail, showToast]
  );

  const resolveAlertWithCar = useCallback(
    async (alertId: string, type: 'CAR' | 'NC' | 'PAR') => {
      const target = alerts.find((a) => a.id === alertId);
      if (!target) return;
      const todayStr = new Date().toISOString().slice(0, 10);

      let docNo = '';
      if (type === 'PAR') {
        const created = await createParRecord({
          sourceType: 'staff_observation',
          sourceRef: target.alertCode,
          clause: target.clause,
          activityType: 'testing',
          part1Detail: `${target.title} — ${target.description}`,
          proposerName: currentUser.displayName,
          proposedDate: todayStr,
        });
        docNo = created.parNo;
      } else {
        const created = await createCarRecord({
          recordType: type,
          sourceType: 'staff_observation',
          sourceRef: target.alertCode,
          part1Detail: `${target.title} — ${target.description}`,
          clause: target.clause,
          activityType: 'calibration',
          finderName: currentUser.displayName,
          foundDate: todayStr,
        });
        docNo = created.carNo;
      }

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'deviationAlerts', alertId), {
            status: 'resolved',
            resolvedCarNo: docNo,
            acknowledgedBy: currentUser.displayName,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `deviationAlerts/${alertId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          alerts: prev.alerts.map((a) =>
            a.id === alertId
              ? {
                  ...a,
                  status: 'resolved',
                  resolvedCarNo: docNo,
                  acknowledgedBy: currentUser.displayName,
                }
              : a
          ),
        }));
      }
    },
    [alerts, createCarRecord, createParRecord, currentUser.displayName, isCloudMode]
  );

  const updateUserRole = useCallback(
    async (uid: string, role: UserRole, isActive: boolean) => {
      if (uid === currentUser.uid) {
        showToast('ไม่สามารถเปลี่ยนระดับสิทธิ์หรือระงับบัญชีที่กำลังเข้าสู่ระบบอยู่ได้');
        return;
      }
      const target = users.find((u) => u.uid === uid);
      if (!target) return;

      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'users', uid), {
            role,
            isActive,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          users: prev.users.map((u) => (u.uid === uid ? { ...u, role, isActive } : u)),
        }));
      }
      await recordTrail(
        'UPDATE_USER_RBAC',
        'users',
        target.email,
        `Admin กำหนดสิทธิ์ผู้ใช้งาน ${target.displayName} เป็น ${role} (${isActive ? 'เปิดใช้งาน' : 'ระงับสิทธิ์'})`
      );
      showToast(`อัปเดตสิทธิ์ของ ${target.displayName} แล้ว`);
    },
    [currentUser.uid, users, isCloudMode, recordTrail, showToast]
  );

  const updateUserAccount = useCallback(
    async (
      uid: string,
      patch: { displayName: string; department: string; role: UserRole; isActive: boolean }
    ) => {
      const target = users.find((u) => u.uid === uid);
      if (!target) return;
      const isSelf = uid === currentUser.uid;
      const cleanName = patch.displayName.trim().slice(0, 120) || target.displayName;
      const cleanDept = patch.department.trim().slice(0, 120) || target.department;
      const nextRole = isSelf ? target.role : patch.role;
      const nextActive = isSelf ? target.isActive : patch.isActive;

      if (isCloudMode) {
        try {
          await updateDoc(
            doc(db, 'users', uid),
            isSelf
              ? {
                  displayName: cleanName,
                  department: cleanDept,
                  updatedAt: serverTimestamp(),
                }
              : {
                  displayName: cleanName,
                  department: cleanDept,
                  role: nextRole,
                  isActive: nextActive,
                  updatedAt: serverTimestamp(),
                }
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.uid === uid
              ? {
                  ...u,
                  displayName: cleanName,
                  department: cleanDept,
                  role: nextRole,
                  isActive: nextActive,
                }
              : u
          ),
        }));
      }

      await recordTrail(
        'UPDATE_USER_RBAC',
        'users',
        target.email,
        `Admin แก้ไขข้อมูลและบทบาทผู้ใช้ ${cleanName} (${target.email}) -> ${nextRole} (${nextActive ? 'เปิดใช้งาน' : 'ระงับสิทธิ์'})`
      );
      showToast(`บันทึกข้อมูลและบทบาทของ ${cleanName} แล้ว`);
    },
    [users, currentUser.uid, isCloudMode, recordTrail, showToast]
  );

  const assignUserRole = useCallback(
    async (input: {
      email: string;
      displayName: string;
      department: string;
      role: UserRole;
      isActive: boolean;
    }) => {
      const normalizedEmail = input.email.trim().toLowerCase().slice(0, 200);
      const cleanName = input.displayName.trim().slice(0, 120);
      const cleanDept = input.department.trim().slice(0, 120);
      if (!normalizedEmail || !cleanName || !cleanDept) return;

      const existingUser = users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
      if (existingUser) {
        if (existingUser.uid === currentUser.uid) {
          showToast('ไม่สามารถเปลี่ยนบทบาทของบัญชีที่กำลังเข้าสู่ระบบอยู่ได้');
          return;
        }
        await updateUserAccount(existingUser.uid, {
          displayName: cleanName,
          department: cleanDept,
          role: input.role,
          isActive: input.isActive,
        });
        return;
      }

      if (isCloudMode && firebaseUser) {
        const existingInvite = cloudInvites.find(
          (inv) => inv.email.trim().toLowerCase() === normalizedEmail
        );
        if (existingInvite) {
          try {
            await updateDoc(doc(db, 'roleInvites', existingInvite.id), {
              displayName: cleanName,
              department: cleanDept,
              role: input.role,
              isActive: input.isActive,
              assignedBy: firebaseUser.uid,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `roleInvites/${existingInvite.id}`);
          }
        } else {
          const inviteId = `inv-${Date.now()}`;
          try {
            await setDoc(doc(db, 'roleInvites', inviteId), {
              email: normalizedEmail,
              displayName: cleanName,
              department: cleanDept,
              role: input.role,
              isActive: input.isActive,
              assignedBy: firebaseUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `roleInvites/${inviteId}`);
          }
        }
        await recordTrail(
          'ASSIGN_USER_ROLE',
          'roleInvites',
          normalizedEmail,
          `Admin กำหนดบทบาทล่วงหน้าให้ ${cleanName} (${normalizedEmail}) เป็น ${input.role}`
        );
        showToast(`กำหนดบทบาทล่วงหน้าให้ ${cleanName} แล้ว`);
      } else {
        const newUser: UserProfile = {
          uid: `user-${Date.now()}`,
          email: normalizedEmail,
          displayName: cleanName,
          department: cleanDept,
          role: input.role,
          isActive: input.isActive,
        };
        setLocalState((prev) => ({ ...prev, users: [...prev.users, newUser] }));
        await recordTrail(
          'ASSIGN_USER_ROLE',
          'users',
          normalizedEmail,
          `Admin เพิ่มผู้ใช้และกำหนดบทบาทให้ ${cleanName} (${normalizedEmail}) เป็น ${input.role}`
        );
        showToast(`เพิ่มผู้ใช้งาน ${cleanName} และกำหนดบทบาทแล้ว`);
      }
    },
    [users, currentUser.uid, isCloudMode, firebaseUser, cloudInvites, updateUserAccount, recordTrail, showToast]
  );

  const updateRoleInvite = useCallback(
    async (
      inviteId: string,
      patch: { displayName: string; department: string; role: UserRole; isActive: boolean }
    ) => {
      const target = cloudInvites.find((inv) => inv.id === inviteId);
      if (!target || !isCloudMode || !firebaseUser) return;
      const cleanName = patch.displayName.trim().slice(0, 120) || target.displayName;
      const cleanDept = patch.department.trim().slice(0, 120) || target.department;
      try {
        await updateDoc(doc(db, 'roleInvites', inviteId), {
          displayName: cleanName,
          department: cleanDept,
          role: patch.role,
          isActive: patch.isActive,
          assignedBy: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `roleInvites/${inviteId}`);
      }
      await recordTrail(
        'UPDATE_ROLE_INVITE',
        'roleInvites',
        target.email,
        `Admin แก้ไขบทบาทที่กำหนดล่วงหน้าให้ ${cleanName} (${target.email}) เป็น ${patch.role}`
      );
      showToast(`อัปเดตบทบาทล่วงหน้าของ ${cleanName} แล้ว`);
    },
    [cloudInvites, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const deleteRoleInvite = useCallback(
    async (inviteId: string) => {
      const target = cloudInvites.find((inv) => inv.id === inviteId);
      if (!target || !isCloudMode) return;
      try {
        await deleteDoc(doc(db, 'roleInvites', inviteId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `roleInvites/${inviteId}`);
      }
      await recordTrail(
        'DELETE_ROLE_INVITE',
        'roleInvites',
        target.email,
        `Admin ลบรายการกำหนดบทบาทล่วงหน้า ${target.displayName} (${target.email})`
      );
      showToast(`ลบรายการกำหนดบทบาทล่วงหน้าของ ${target.displayName} แล้ว`);
    },
    [cloudInvites, isCloudMode, recordTrail, showToast]
  );

  // --- Full Admin Edit & Delete CRUD Handlers ---
  const updateProgramItem = useCallback(
    async (
      programId: string,
      patch: Partial<Pick<AuditProgramItem, 'sequence' | 'activity' | 'activityType' | 'remarks' | 'months' | 'status'>>
    ) => {
      const target = programs.find((p) => p.id === programId);
      if (!target) return;
      const normalizedPatch = {
        ...patch,
        ...(patch.sequence !== undefined
          ? { sequence: Math.max(1, Math.min(500, Math.trunc(Number(patch.sequence) || 1))) }
          : {}),
      };
      const cleanPatch = stripUndefined(normalizedPatch);
      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditPrograms', programId), {
            ...cleanPatch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditPrograms/${programId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          programs: prev.programs.map((p) => (p.id === programId ? { ...p, ...cleanPatch } : p)),
        }));
      }
      await recordTrail(
        'UPDATE_AUDIT_PROGRAM',
        'auditPrograms',
        `FM-LB-023 #${cleanPatch.sequence ?? target.sequence}`,
        `แก้ไขรายการแผนโปรแกรม "${cleanPatch.activity ?? target.activity}"`
      );
      showToast('บันทึกการแก้ไขโปรแกรมประจำปี (FM-LB-023) แล้ว');
    },
    [programs, isCloudMode, recordTrail, showToast]
  );

  const deleteProgramItem = useCallback(
    async (programId: string) => {
      const target = programs.find((p) => p.id === programId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'auditPrograms', programId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `auditPrograms/${programId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          programs: prev.programs.filter((p) => p.id !== programId),
        }));
      }
      await recordTrail(
        'DELETE_AUDIT_PROGRAM',
        'auditPrograms',
        `FM-LB-023 #${target.sequence}`,
        `ลบรายการแผนโปรแกรม "${target.activity}"`
      );
      showToast('ลบรายการใน FM-LB-023 แล้ว');
    },
    [programs, isCloudMode, recordTrail, showToast]
  );

  const updateScheduleItem = useCallback(
    async (
      scheduleId: string,
      patch: Partial<
        Pick<
          AuditScheduleItem,
          'auditRound' | 'auditDate' | 'timeRange' | 'activity' | 'activityType' | 'criteria' | 'auditorName' | 'auditeeName' | 'status'
        >
      >
    ) => {
      const target = schedules.find((s) => s.id === scheduleId);
      if (!target) return;
      const cleanPatch = stripUndefined(patch);
      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditSchedules', scheduleId), {
            ...cleanPatch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditSchedules/${scheduleId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          schedules: prev.schedules.map((s) => (s.id === scheduleId ? { ...s, ...cleanPatch } : s)),
        }));
      }
      await recordTrail(
        'UPDATE_AUDIT_SCHEDULE',
        'auditSchedules',
        `FM-LB-022 ${cleanPatch.auditRound ?? target.auditRound}`,
        `แก้ไขกำหนดการตรวจประเมิน "${cleanPatch.activity ?? target.activity}"`
      );
      showToast('บันทึกการแก้ไขกำหนดการตรวจ (FM-LB-022) แล้ว');
    },
    [schedules, isCloudMode, recordTrail, showToast]
  );

  const deleteScheduleItem = useCallback(
    async (scheduleId: string) => {
      const target = schedules.find((s) => s.id === scheduleId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'auditSchedules', scheduleId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `auditSchedules/${scheduleId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          schedules: prev.schedules.filter((s) => s.id !== scheduleId),
        }));
      }
      await recordTrail(
        'DELETE_AUDIT_SCHEDULE',
        'auditSchedules',
        `FM-LB-022 ${target.auditRound}`,
        `ลบกำหนดการตรวจประเมิน "${target.activity}"`
      );
      showToast('ลบกำหนดการตรวจใน FM-LB-022 แล้ว');
    },
    [schedules, isCloudMode, recordTrail, showToast]
  );

  const updateChecklistItem = useCallback(
    async (
      checklistId: string,
      patch: Partial<
        Pick<
          AuditChecklistItem,
          'auditRound' | 'department' | 'activity' | 'activityType' | 'auditMethod' | 'auditDate' | 'clause' | 'checkItem' | 'result' | 'detail' | 'auditeeName' | 'linkedDocNo'
        >
      >
    ) => {
      const target = checklists.find((c) => c.id === checklistId);
      if (!target) return;
      const cleanPatch = stripUndefined(patch);
      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'auditChecklists', checklistId), {
            ...cleanPatch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `auditChecklists/${checklistId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          checklists: prev.checklists.map((c) => (c.id === checklistId ? { ...c, ...cleanPatch } : c)),
        }));
      }
      await recordTrail(
        'UPDATE_CHECKLIST_ITEM',
        'auditChecklists',
        `FM-LB-024 Clause ${cleanPatch.clause ?? target.clause}`,
        `แก้ไขรายการตรวจ "${cleanPatch.checkItem ?? target.checkItem}"`
      );
      showToast('บันทึกการแก้ไขรายการตรวจ (FM-LB-024) แล้ว');
    },
    [checklists, isCloudMode, recordTrail, showToast]
  );

  const deleteChecklistItem = useCallback(
    async (checklistId: string) => {
      const target = checklists.find((c) => c.id === checklistId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'auditChecklists', checklistId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `auditChecklists/${checklistId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          checklists: prev.checklists.filter((c) => c.id !== checklistId),
        }));
      }
      await recordTrail(
        'DELETE_CHECKLIST_ITEM',
        'auditChecklists',
        `FM-LB-024 Clause ${target.clause}`,
        `ลบรายการตรวจติดตาม "${target.checkItem}"`
      );
      showToast('ลบรายการตรวจประเมินแล้ว');
    },
    [checklists, isCloudMode, recordTrail, showToast]
  );

  const updateCarItem = useCallback(
    async (
      carId: string,
      patch: Partial<
        Pick<
          CarRecord,
          'sourceType' | 'sourceRef' | 'clause' | 'activityType' | 'part1Detail' | 'finderName' | 'foundDate' | 'responsiblePerson' | 'status'
        >
      >
    ) => {
      const target = cars.find((c) => c.id === carId);
      if (!target) return;
      const cleanPatch = stripUndefined(patch);
      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'carRecords', carId), {
            ...cleanPatch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `carRecords/${carId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          cars: prev.cars.map((c) => (c.id === carId ? { ...c, ...cleanPatch } : c)),
        }));
      }
      await recordTrail('UPDATE_CAR_RECORD', 'carRecords', target.carNo, `แก้ไขข้อมูลหลักของใบ ${target.carNo}`);
      showToast(`บันทึกการแก้ไข ${target.carNo} แล้ว`);
    },
    [cars, isCloudMode, recordTrail, showToast]
  );

  const deleteCarItem = useCallback(
    async (carId: string) => {
      const target = cars.find((c) => c.id === carId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'carRecords', carId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `carRecords/${carId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          cars: prev.cars.filter((c) => c.id !== carId),
        }));
      }
      await recordTrail('DELETE_CAR_RECORD', 'carRecords', target.carNo, `ลบใบคำร้อง ${target.carNo} (${target.part1Detail.slice(0, 60)})`);
      showToast(`ลบใบ ${target.carNo} ออกจากบัญชีแล้ว`);
    },
    [cars, isCloudMode, recordTrail, showToast]
  );

  const updateParItem = useCallback(
    async (
      parId: string,
      patch: Partial<
        Pick<
          ParRecord,
          'sourceType' | 'sourceRef' | 'clause' | 'activityType' | 'part1Detail' | 'proposerName' | 'proposedDate' | 'responsiblePerson' | 'status'
        >
      >
    ) => {
      const target = pars.find((p) => p.id === parId);
      if (!target) return;
      const cleanPatch = stripUndefined(patch);
      if (isCloudMode) {
        try {
          await updateDoc(doc(db, 'parRecords', parId), {
            ...cleanPatch,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `parRecords/${parId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          pars: prev.pars.map((p) => (p.id === parId ? { ...p, ...cleanPatch } : p)),
        }));
      }
      await recordTrail('UPDATE_PAR_RECORD', 'parRecords', target.parNo, `แก้ไขข้อมูลหลักของใบ ${target.parNo}`);
      showToast(`บันทึกการแก้ไข ${target.parNo} แล้ว`);
    },
    [pars, isCloudMode, recordTrail, showToast]
  );

  const deleteParItem = useCallback(
    async (parId: string) => {
      const target = pars.find((p) => p.id === parId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'parRecords', parId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `parRecords/${parId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          pars: prev.pars.filter((p) => p.id !== parId),
        }));
      }
      await recordTrail('DELETE_PAR_RECORD', 'parRecords', target.parNo, `ลบใบปฏิบัติการป้องกัน ${target.parNo}`);
      showToast(`ลบใบ ${target.parNo} ออกจากบัญชีแล้ว`);
    },
    [pars, isCloudMode, recordTrail, showToast]
  );

  const addEquipmentItem = useCallback(
    async (
      input: Omit<EquipmentItem, 'id' | 'status' | 'updatedBy' | 'createdAt' | 'updatedAt'>
    ) => {
      const id = `eq-${Date.now()}`;
      const todayISO = new Date().toISOString().slice(0, 10);
      const evaluation = evaluateEquipmentCompliance(
        {
          nextCalDate: input.nextCalDate,
          nominalValue: input.nominalValue,
          tolerance: input.tolerance,
          lastMeasuredValue: input.lastMeasuredValue,
          ptZScore: input.ptZScore,
          unit: input.unit,
        },
        todayISO
      );
      const newEq: EquipmentItem = {
        ...input,
        id,
        status: evaluation.status,
        updatedBy: currentUser.uid,
      };
      if (isCloudMode && firebaseUser) {
        const { id: _id, ...rest } = newEq;
        try {
          await setDoc(doc(db, 'equipment', id), {
            ...stripUndefined(rest),
            updatedBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `equipment/${id}`);
        }
      } else {
        setLocalState((prev) => ({ ...prev, equipment: [newEq, ...prev.equipment] }));
      }
      await recordTrail('CREATE_EQUIPMENT', 'equipment', newEq.code, `เพิ่มเครื่องมือ/จุดตรวจวัด ${newEq.code} (${newEq.name})`);
      showToast(`เพิ่มเครื่องมือ ${newEq.code} เรียบร้อยแล้ว`);
    },
    [currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const updateEquipmentItem = useCallback(
    async (
      equipmentId: string,
      payload: Omit<EquipmentItem, 'id' | 'status' | 'updatedBy' | 'createdAt' | 'updatedAt'>
    ) => {
      const target = equipment.find((e) => e.id === equipmentId);
      if (!target) return;
      const todayISO = new Date().toISOString().slice(0, 10);
      const evaluation = evaluateEquipmentCompliance(
        {
          nextCalDate: payload.nextCalDate,
          nominalValue: payload.nominalValue,
          tolerance: payload.tolerance,
          lastMeasuredValue: payload.lastMeasuredValue,
          ptZScore: payload.ptZScore,
          unit: payload.unit,
        },
        todayISO
      );
      const patch = stripUndefined({
        ...payload,
        status: evaluation.status,
        updatedBy: currentUser.uid,
      });

      if (isCloudMode && firebaseUser) {
        try {
          await updateDoc(doc(db, 'equipment', equipmentId), {
            ...patch,
            updatedBy: firebaseUser.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `equipment/${equipmentId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          equipment: prev.equipment.map((e) => (e.id === equipmentId ? { ...e, ...patch } : e)),
        }));
      }
      await recordTrail('UPDATE_EQUIPMENT', 'equipment', payload.code, `แก้ไขข้อมูลเครื่องมือ ${payload.code} (${payload.name})`);
      showToast(`บันทึกการแก้ไขเครื่องมือ ${payload.code} แล้ว`);
    },
    [equipment, currentUser.uid, isCloudMode, firebaseUser, recordTrail, showToast]
  );

  const deleteEquipmentItem = useCallback(
    async (equipmentId: string) => {
      const target = equipment.find((e) => e.id === equipmentId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'equipment', equipmentId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `equipment/${equipmentId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          equipment: prev.equipment.filter((e) => e.id !== equipmentId),
        }));
      }
      await recordTrail('DELETE_EQUIPMENT', 'equipment', target.code, `ลบเครื่องมือ ${target.code} (${target.name})`);
      showToast(`ลบเครื่องมือ ${target.code} แล้ว`);
    },
    [equipment, isCloudMode, recordTrail, showToast]
  );

  const deleteAlert = useCallback(
    async (alertId: string) => {
      const target = alerts.find((a) => a.id === alertId);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'deviationAlerts', alertId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `deviationAlerts/${alertId}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          alerts: prev.alerts.filter((a) => a.id !== alertId),
        }));
      }
      await recordTrail('DELETE_ALERT', 'deviationAlerts', target.alertCode, `ลบการแจ้งเตือน ${target.alertCode}`);
      showToast(`ลบการแจ้งเตือน ${target.alertCode} แล้ว`);
    },
    [alerts, isCloudMode, recordTrail, showToast]
  );

  const deleteUserProfile = useCallback(
    async (uid: string) => {
      if (uid === currentUser.uid) {
        showToast('ไม่สามารถลบบัญชีผู้ใช้งานที่กำลังเข้าสู่ระบบอยู่ได้');
        return;
      }
      const target = users.find((u) => u.uid === uid);
      if (!target) return;
      if (isCloudMode) {
        try {
          await deleteDoc(doc(db, 'users', uid));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          users: prev.users.filter((u) => u.uid !== uid),
        }));
      }
      await recordTrail('DELETE_USER_ACCOUNT', 'users', target.email, `ลบบัญชีผู้ใช้ ${target.displayName} (${target.email})`);
      showToast(`ลบบัญชี ${target.displayName} ออกจากระบบแล้ว`);
    },
    [currentUser.uid, users, isCloudMode, recordTrail, showToast]
  );

  const roleInvites = isCloudMode ? cloudInvites : [];

  return {
    isCloudMode,
    isLoggedIn,
    authReady,
    cloudLoading,
    authError,
    toastMessage,
    currentUser,
    users,
    roleInvites,
    programs,
    schedules,
    checklists,
    cars,
    pars,
    equipment,
    alerts,
    trail,
    metrics,
    signInWithGoogle,
    signInSandbox,
    signOutCloud,
    setPreviewRole,
    clearAllWorkspaceData,
    resetSandboxData,
    toggleProgramMonth,
    approveProgramItem,
    approveAllProgramsForYear,
    startNewAnnualAuditPlan,
    addProgramItem,
    updateProgramItem,
    deleteProgramItem,
    addScheduleItem,
    updateScheduleStatus,
    updateScheduleItem,
    deleteScheduleItem,
    addChecklistItem,
    updateChecklistResult,
    updateChecklistItem,
    deleteChecklistItem,
    createCarRecord,
    respondCarPart2,
    verifyCarPart3,
    updateCarItem,
    deleteCarItem,
    createParRecord,
    respondParPart2,
    verifyParPart3,
    updateParItem,
    deleteParItem,
    addEquipmentItem,
    updateEquipmentItem,
    deleteEquipmentItem,
    logEquipmentReading,
    acknowledgeAlert,
    resolveAlertWithCar,
    deleteAlert,
    updateUserRole,
    updateUserAccount,
    assignUserRole,
    updateRoleInvite,
    deleteRoleInvite,
    deleteUserProfile,
  };
}
