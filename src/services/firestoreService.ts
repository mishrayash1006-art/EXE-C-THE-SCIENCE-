import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  Unsubscribe,
  getDoc,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { EncryptedBackupRecord, SimulationCase } from '../types/studio';
import { validateBlueprintPayload } from '../utils/physicsEngine';

export async function upsertUserProfile(
  user: User,
  provider: 'google.com' | 'apple.com' | 'microsoft.com',
  defaultSpreadsheetId?: string
): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = (user.displayName || user.email || 'Engineer').slice(0, 120);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        provider,
        ...(defaultSpreadsheetId ? { defaultSpreadsheetId: defaultSpreadsheetId.slice(0, 128) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          displayName,
          ...(defaultSpreadsheetId ? { defaultSpreadsheetId: defaultSpreadsheetId.slice(0, 128) } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveEncryptedBackup(
  uid: string,
  caseId: string,
  title: string,
  encrypted: { algorithm: 'AES-256-GCM'; iv: string; ciphertext: string; checksum: string },
  spreadsheetId?: string
): Promise<string> {
  const safeCaseId = caseId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'custom';
  const safeTitle = title.trim().slice(0, 120) || 'Simulation Backup';
  const validation = validateBlueprintPayload({
    ownerId: uid,
    caseId: safeCaseId,
    title: safeTitle,
    ...encrypted,
  });
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid encrypted backup payload');
  }

  const backupId = `bkp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `simulation_backups/${backupId}`;
  try {
    await setDoc(doc(db, 'simulation_backups', backupId), {
      ownerId: uid,
      caseId: safeCaseId,
      title: safeTitle,
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      checksum: encrypted.checksum,
      ...(spreadsheetId ? { spreadsheetId: spreadsheetId.slice(0, 128) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return backupId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserBackups(
  uid: string,
  onData: (records: EncryptedBackupRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'simulation_backups';
  const q = query(
    collection(db, path),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: EncryptedBackupRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? ''),
          caseId: String(data.caseId ?? ''),
          title: String(data.title ?? ''),
          algorithm: 'AES-256-GCM',
          iv: String(data.iv ?? ''),
          ciphertext: String(data.ciphertext ?? ''),
          checksum: String(data.checksum ?? ''),
          spreadsheetId: data.spreadsheetId ? String(data.spreadsheetId) : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined,
        };
      });
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function deleteEncryptedBackup(backupId: string): Promise<void> {
  const path = `simulation_backups/${backupId}`;
  try {
    await deleteDoc(doc(db, 'simulation_backups', backupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCustomSimulationCase(uid: string, simCase: SimulationCase): Promise<void> {
  const safeId = simCase.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `simulation_cases/${safeId}`;
  try {
    await setDoc(doc(db, 'simulation_cases', safeId), {
      ownerId: uid,
      title: simCase.title.slice(0, 120),
      domain: simCase.domain.slice(0, 64),
      summary: simCase.summary.slice(0, 2000),
      cppClass: simCase.cppClassName.slice(0, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
