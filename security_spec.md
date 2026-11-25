# Security Specification — ISO/IEC 17025 Internal Quality Audit System

## 1. Data Invariants & RBAC Laws
1. **Default-Deny Gate**: Unauthenticated or unverified (`email_verified != true`) requests have zero read/write access to any collection.
2. **RBAC Role Integrity (No Self-Escalation)**: Users may register their own initial `users/{userId}` document ONLY with `role == 'auditee'` (unless bootstrapped as admin `documentscontrol892@gmail.com`). Users can never modify their own `role` or `isActive` flag. Only `quality_manager` can assign/change roles (`quality_manager`, `auditor`, `auditee`, `executive`).
3. **PII Isolation**: User documents containing `email` may only be read (`get`) by the owning user (`request.auth.uid == userId`) or `quality_manager`. `list` on `/users` is restricted to `quality_manager`.
4. **Tiered Identity Logic on Audit Workflows**:
   - `auditPrograms` (FM-LB-023) & `auditSchedules` (FM-LB-022): `quality_manager` (Admin) has full create/edit/delete access; `executive` may approve `auditPrograms`; `auditor` may update schedule execution status; `auditee` has read access.
   - `auditChecklists` (FM-LB-024): `quality_manager` (Admin) has full create/edit/delete access; `auditor` may create/update checklist findings; `auditee` and `executive` have read access.
   - `carRecords` (FM-LB-011/012) & `parRecords` (FM-LB-013/014):
     - Create: `quality_manager` (any valid workflow status for historical/seed records) or `auditor` (must start in `status == 'open'` and `verificationResult == 'pending'`).
     - Delete: Strictly `quality_manager` (Admin).
     - Part 2 Response Update (`rootCause`, `correctiveAction`, `preventiveAction`, `riskScore`, `status: 'responded'`): `auditee` (when current status is `'open'`) or `quality_manager`/`auditor`.
     - Part 3 Verification & Close/Reissue (`verificationResult`, `status: 'closed' | 'reissued'`): Strictly `quality_manager` or `auditor`. Terminal `'closed'` or `'reissued'` states are locked against further edits unless overridden by `quality_manager` (Admin).
   - `equipment` & `deviationAlerts`: `quality_manager` (Admin) has full create/edit/delete access; `auditor` can add/update equipment & resolve alerts; `auditee` can log measured readings or acknowledge alerts.
   - `users` & `roleInvites`: `quality_manager` (Admin) is the sole authority to assign, edit, suspend, or pre-assign user roles (`quality_manager`, `auditor`, `auditee`, `executive`). Newly signing-in staff receive their Admin pre-assigned role from `/roleInvites` if matched by verified email, or default to `auditee`; Admin cannot demote/delete their own active Admin account.
   - `auditTrail`: Append-only (`allow create` by authenticated active staff where `actorUid == request.auth.uid`; `allow update, delete: if false` unconditionally for everyone including `quality_manager` to preserve ISO/IEC 17025 traceability).
5. **Temporal Integrity & Path Hardening**: All `createdAt` / `updatedAt` timestamps must equal `request.time`, and all document IDs must satisfy `^[a-zA-Z0-9_-]+$` with `.size() <= 128`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/carRecords` without `request.auth`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create `/carRecords/car-1`.
3. **Role Self-Escalation on Create**: New user attempts `setDoc(/users/{uid}, { role: 'quality_manager', ... })`.
4. **Role Self-Escalation on Update**: Existing `auditee` updates `/users/{uid}` changing `role` to `'auditor'`.
5. **PII Cross-User Read**: `auditee` A attempts `getDoc(/users/{auditeeB})`.
6. **Shadow Ghost Field Injection**: `auditor` creates `/auditChecklists/chk-1` with extra field `isBypassed: true`.
7. **Author UID Spoofing**: `auditor` creates `/carRecords/car-2` with `createdBy: 'other-uid'`.
8. **Auditee Closing Own CAR**: `auditee` attempts to update `/carRecords/car-1` setting `status: 'closed'` and `verificationResult: 'effective'`.
9. **Terminal State Tampering**: `auditor` attempts to modify a CAR whose `status == 'closed'`.
10. **Immutable Audit Trail Modification**: `quality_manager` attempts `updateDoc` or `deleteDoc` on `/auditTrail/trail-1`.
11. **Oversized String / Denial-of-Wallet Poisoning**: `auditor` submits `part1Detail` exceeding 2000 chars or document ID containing `/../` or > 128 chars.
12. **Client-Forged Timestamp**: User submits `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
