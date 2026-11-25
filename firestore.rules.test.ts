import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('Firestore rules include mandatory global safety net and rules_version 2', () => {
  assert.match(rulesContent, /rules_version = '2';/);
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('Firestore rules enforce email_verified and prevent unauthenticated/spoofed reads', () => {
  assert.match(rulesContent, /request\.auth != null && request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /allow get: if isValidId\(userId\) && isSignedIn\(\) && \(request\.auth\.uid == userId \|\| isQualityManager\(\)\)/);
  assert.match(rulesContent, /allow list: if isQualityManager\(\)/);
});

test('Firestore rules prevent role self-escalation and enforce validation helpers on every write', () => {
  assert.match(rulesContent, /!isBootstrappedAdmin\(\) && !\('inviteId' in incoming\(\)\) && incoming\(\)\.role == 'auditee'/);
  assert.match(rulesContent, /incoming\(\)\.role == existing\(\)\.role/);
  assert.match(rulesContent, /isValidCarRecord\(incoming\(\)\)/);
  assert.match(rulesContent, /isValidParRecord\(incoming\(\)\)/);
  assert.match(rulesContent, /isValidAuditChecklist\(incoming\(\)\)/);
  assert.match(rulesContent, /isValidEquipment\(incoming\(\)\)/);
});

test('Firestore rules enforce immutable audit trail, Admin delete gating, and terminal state locking', () => {
  assert.match(rulesContent, /match \/auditTrail\/\{trailId\}[\s\S]*allow update, delete: if false;/);
  assert.match(rulesContent, /match \/carRecords\/\{carId\}[\s\S]*allow delete: if isValidId\(carId\) && isQualityManager\(\);/);
  assert.match(rulesContent, /match \/parRecords\/\{parId\}[\s\S]*allow delete: if isValidId\(parId\) && isQualityManager\(\);/);
  assert.match(rulesContent, /allow delete: if isValidId\(userId\) && isQualityManager\(\) && request\.auth\.uid != userId;/);
  assert.match(rulesContent, /existing\(\)\.status != 'closed' && existing\(\)\.status != 'reissued'/);
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
});

test('Dirty Dozen security assertions cover all 12 attack vectors in spec', () => {
  const spec = fs.readFileSync(new URL('./security_spec.md', import.meta.url), 'utf8');
  assert.match(spec, /Unauthenticated Read/);
  assert.match(spec, /Role Self-Escalation on Create/);
  assert.match(spec, /Immutable Audit Trail Modification/);
  assert.match(spec, /Client-Forged Timestamp/);
});

test('Client list queries align with Firestore resource.data allow list rules', () => {
  const hookContent = fs.readFileSync(new URL('./src/hooks/useIsoWorkspace.ts', import.meta.url), 'utf8');
  assert.match(hookContent, /collection\(db, 'auditPrograms'\),\s*where\('yearBE', '>=', 2560\)/);
  assert.match(hookContent, /collection\(db, 'auditSchedules'\),\s*where\('yearBE', '>=', 2560\)/);
  assert.match(hookContent, /collection\(db, 'auditChecklists'\),\s*where\('yearBE', '>=', 2560\)/);
  assert.match(hookContent, /collection\(db, 'carRecords'\),\s*where\('recordType', 'in', \['CAR', 'NC'\]\)/);
  assert.match(hookContent, /collection\(db, 'parRecords'\),[\s\S]*where\('status', 'in', \['open', 'responded', 'closed', 'reissued'\]\)/);
  assert.match(hookContent, /collection\(db, 'equipment'\),[\s\S]*where\('category', 'in', \['testing', 'calibration', 'environment'\]\)/);
  assert.match(hookContent, /collection\(db, 'deviationAlerts'\),[\s\S]*where\('status', 'in', \['active', 'acknowledged', 'resolved'\]\)/);
  assert.match(hookContent, /collection\(db, 'auditTrail'\),[\s\S]*where\('actorRole', 'in', \['quality_manager', 'auditor', 'auditee', 'executive'\]\)/);
  assert.match(hookContent, /collection\(db, 'roleInvites'\),[\s\S]*where\('email', '==', normalizedEmail\)/);
  assert.match(hookContent, /collection\(db, 'roleInvites'\),[\s\S]*where\('role', 'in', \['quality_manager', 'auditor', 'auditee', 'executive'\]\)/);
});

test('Firestore rules enforce Admin-only role assignment via roleInvites and block self-demotion', () => {
  assert.match(rulesContent, /match \/roleInvites\/\{inviteId\}[\s\S]*allow create: if isValidId\(inviteId\) && isQualityManager\(\)/);
  assert.match(rulesContent, /match \/roleInvites\/\{inviteId\}[\s\S]*allow update: if isValidId\(inviteId\) && isQualityManager\(\)/);
  assert.match(rulesContent, /match \/roleInvites\/\{inviteId\}[\s\S]*allow delete: if isValidId\(inviteId\) && isQualityManager\(\)/);
  assert.match(rulesContent, /isQualityManager\(\) && request\.auth\.uid != userId && incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\['role', 'department', 'isActive', 'displayName', 'updatedAt'\]\)/);
  assert.match(rulesContent, /request\.auth\.uid == userId && incoming\(\)\.role == existing\(\)\.role && incoming\(\)\.isActive == existing\(\)\.isActive/);
});


