export type StudioView = 'simulator' | 'infographics' | 'cpp' | 'workspace' | 'admin';

export type MaterialFinish = 'titanium' | 'anodized-cobalt' | 'ceramic-matte' | 'wireframe';

export type CameraPreset = 'isometric' | 'front' | 'top' | 'detail';

export interface SimParameter {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface InfographicNode {
  label: string;
  value: string;
  unit: string;
  detail: string;
}

export interface SimulationCase {
  id: string;
  indexLabel: string;
  title: string;
  domain: string;
  subtitle: string;
  summary: string;
  cppClassName: string;
  governingEquation: string;
  equations: { title: string; formula: string; explanation: string }[];
  concepts: { heading: string; body: string; keyTakeaway: string }[];
  infographicImage?: string;
  infographicNodes: InfographicNode[];
  parameters: SimParameter[];
  isCustom?: boolean;
}

export interface SimulationTelemetry {
  primaryMetricLabel: string;
  primaryMetricValue: number;
  primaryMetricUnit: string;
  secondaryMetricLabel: string;
  secondaryMetricValue: number;
  secondaryMetricUnit: string;
  energyJ: number;
  stabilityIndex: number;
  convergenceResidual: number;
  solverStepUs: number;
  curveSeries: { x: number; y1: number; y2: number }[];
}

export interface CppProjectFile {
  path: string;
  language: 'cpp' | 'cmake' | 'glsl';
  content: string;
}

export interface EncryptedBackupRecord {
  id: string;
  ownerId: string;
  caseId: string;
  title: string;
  algorithm: 'AES-256-GCM';
  iv: string;
  ciphertext: string;
  checksum: string;
  spreadsheetId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminReportRow {
  timestamp: string;
  userEmail: string;
  caseId: string;
  caseTitle: string;
  primaryValue: string;
  energyJ: string;
  stability: string;
  solverUs: string;
  backupChecksum: string;
}

export interface WorkspaceConfirmState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}
