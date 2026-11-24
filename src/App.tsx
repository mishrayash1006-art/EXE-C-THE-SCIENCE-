/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { SIMULATION_CASES } from './data/simulationCases';
import {
  EncryptedBackupRecord,
  SimulationCase,
  StudioView,
  WorkspaceConfirmState,
} from './types/studio';
import { computeSimulationTelemetry } from './utils/physicsEngine';
import { initAuth, testConnection } from './lib/firebase';
import { subscribeUserBackups, upsertUserProfile } from './services/firestoreService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopNav } from './components/TopNav';
import { AuthModal } from './components/AuthModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ThreeViewport } from './components/ThreeViewport';
import { InfographicsView } from './components/InfographicsView';
import { CppEngineView } from './components/CppEngineView';
import { WorkspaceHubView } from './components/WorkspaceHubView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { LiveVoiceDrawer } from './components/LiveVoiceDrawer';

function buildDefaultParams(simCase: SimulationCase): Record<string, number> {
  const out: Record<string, number> = {};
  simCase.parameters.forEach((p) => {
    out[p.key] = p.defaultValue;
  });
  return out;
}

function StudioShell() {
  const [activeView, setActiveView] = useState<StudioView>('simulator');
  const [cases, setCases] = useState<SimulationCase[]>(SIMULATION_CASES);
  const [activeCaseId, setActiveCaseId] = useState<string>(SIMULATION_CASES[0].id);
  const [paramsByCase, setParamsByCase] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {};
    SIMULATION_CASES.forEach((c) => {
      init[c.id] = buildDefaultParams(c);
    });
    return init;
  });
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState<boolean>(false);

  const [backups, setBackups] = useState<EncryptedBackupRecord[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [lastSnapshotDataUrl, setLastSnapshotDataUrl] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<WorkspaceConfirmState>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  useEffect(() => {
    testConnection().catch(() => {});
    const unsub = initAuth(
      (signedUser, token) => {
        setUser(signedUser);
        if (token) setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setBackups([]);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserBackups(
      user.uid,
      (records) => setBackups(records),
      (err) => console.error('Backup subscription error:', err.message)
    );
    return () => unsub();
  }, [user]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || cases[0],
    [cases, activeCaseId]
  );

  const activeParams = useMemo(
    () => paramsByCase[activeCase.id] || buildDefaultParams(activeCase),
    [paramsByCase, activeCase]
  );

  const telemetry = useMemo(
    () => computeSimulationTelemetry(activeCase.id, activeParams, elapsedSec),
    [activeCase.id, activeParams, elapsedSec]
  );

  const handleParamChange = useCallback(
    (key: string, value: number) => {
      setParamsByCase((prev) => ({
        ...prev,
        [activeCase.id]: {
          ...(prev[activeCase.id] || buildDefaultParams(activeCase)),
          [key]: value,
        },
      }));
    },
    [activeCase]
  );

  const handleResetParams = useCallback(() => {
    setParamsByCase((prev) => ({
      ...prev,
      [activeCase.id]: buildDefaultParams(activeCase),
    }));
  }, [activeCase]);

  const handleSignedIn = async (
    signedUser: User,
    provider: 'google.com' | 'apple.com' | 'microsoft.com',
    token?: string
  ) => {
    setUser(signedUser);
    if (token) setAccessToken(token);
    try {
      await upsertUserProfile(signedUser, provider, spreadsheetId || undefined);
    } catch {
      // Profile sync failure is surfaced via console/Firestore rules
    }
  };

  const handleSpreadsheetLinked = async (sheetId: string) => {
    setSpreadsheetId(sheetId);
    if (user) {
      const providerId =
        (user.providerData?.[0]?.providerId as 'google.com' | 'apple.com' | 'microsoft.com') ||
        'google.com';
      await upsertUserProfile(user, providerId, sheetId).catch(() => {});
    }
  };

  const handleRestoreParams = (caseId: string, restoredParams: Record<string, number>) => {
    const exists = cases.some((c) => c.id === caseId);
    if (exists) setActiveCaseId(caseId);
    setParamsByCase((prev) => ({
      ...prev,
      [caseId]: restoredParams,
    }));
    setActiveView('simulator');
  };

  const handleAddCustomCase = (newCase: SimulationCase) => {
    setCases((prev) => [...prev, newCase]);
    setParamsByCase((prev) => ({
      ...prev,
      [newCase.id]: buildDefaultParams(newCase),
    }));
    setActiveCaseId(newCase.id);
    setActiveView('simulator');
  };

  const handleCaptureSnapshot = (dataUrl: string) => {
    setLastSnapshotDataUrl(dataUrl);
    setActiveView('infographics');
  };

  const openConfirmModal = (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<void> | void;
  }) => {
    setConfirmState({
      isOpen: true,
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel,
      destructive: opts.destructive,
      onConfirm: opts.onConfirm,
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F17] text-slate-100 overflow-hidden">
      <TopNav
        activeView={activeView}
        onSelectView={setActiveView}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="flex-1 min-h-0 flex flex-col">
        {activeView === 'simulator' && (
          <ThreeViewport
            cases={cases}
            activeCase={activeCase}
            onSelectCase={setActiveCaseId}
            params={activeParams}
            onParamChange={handleParamChange}
            onResetParams={handleResetParams}
            telemetry={telemetry}
            onTickElapsed={setElapsedSec}
            onCaptureSnapshot={handleCaptureSnapshot}
          />
        )}

        {activeView === 'infographics' && (
          <InfographicsView
            cases={cases}
            activeCase={activeCase}
            onSelectCase={setActiveCaseId}
            params={activeParams}
            telemetry={telemetry}
            lastSnapshotDataUrl={lastSnapshotDataUrl}
            onOpenVoiceDrawer={() => setVoiceDrawerOpen(true)}
          />
        )}

        {activeView === 'cpp' && (
          <CppEngineView
            activeCase={activeCase}
            params={activeParams}
            accessToken={accessToken}
            onRequestAuth={() => setAuthModalOpen(true)}
            onRequestConfirm={openConfirmModal}
          />
        )}

        {activeView === 'workspace' && (
          <WorkspaceHubView
            accessToken={accessToken}
            userEmail={user?.email || null}
            activeCase={activeCase}
            telemetry={telemetry}
            spreadsheetId={spreadsheetId}
            onSpreadsheetLinked={handleSpreadsheetLinked}
            onRequestAuth={() => setAuthModalOpen(true)}
            onRequestConfirm={openConfirmModal}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboardView
            user={user}
            accessToken={accessToken}
            activeCase={activeCase}
            params={activeParams}
            telemetry={telemetry}
            backups={backups}
            spreadsheetId={spreadsheetId}
            onSpreadsheetLinked={handleSpreadsheetLinked}
            onRestoreParams={handleRestoreParams}
            onAddCustomCase={handleAddCustomCase}
            onRequestAuth={() => setAuthModalOpen(true)}
            onRequestConfirm={openConfirmModal}
          />
        )}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        hasWorkspaceToken={Boolean(accessToken)}
        onSignedIn={handleSignedIn}
      />

      <ConfirmModal
        state={confirmState}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      <LiveVoiceDrawer
        isOpen={voiceDrawerOpen}
        onClose={() => setVoiceDrawerOpen(false)}
        caseTitle={activeCase.title}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioShell />
    </ErrorBoundary>
  );
}
