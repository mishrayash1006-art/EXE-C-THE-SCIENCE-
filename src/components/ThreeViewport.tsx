import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  CameraPreset,
  MaterialFinish,
  SimulationCase,
  SimulationTelemetry,
} from '../types/studio';

interface ThreeViewportProps {
  cases: SimulationCase[];
  activeCase: SimulationCase;
  onSelectCase: (caseId: string) => void;
  params: Record<string, number>;
  onParamChange: (key: string, value: number) => void;
  onResetParams: () => void;
  telemetry: SimulationTelemetry;
  onTickElapsed: (elapsedSec: number) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
}

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  isometric: { pos: [5.4, 3.8, 5.8], target: [0, 0.2, 0] },
  front: { pos: [0, 1.1, 7.2], target: [0, 0.2, 0] },
  top: { pos: [0.01, 8.2, 0.01], target: [0, 0, 0] },
  detail: { pos: [2.7, 1.9, 3.0], target: [0, 0.2, 0] },
};

const FINISH_CONFIG: Record<
  MaterialFinish,
  { color: number; accent: number; metalness: number; roughness: number; wireframe: boolean; label: string }
> = {
  titanium: { color: 0x94a3b8, accent: 0x38bdf8, metalness: 0.88, roughness: 0.26, wireframe: false, label: 'Machined Titanium' },
  'anodized-cobalt': { color: 0x2563eb, accent: 0xf59e0b, metalness: 0.82, roughness: 0.22, wireframe: false, label: 'Anodized Cobalt' },
  'ceramic-matte': { color: 0xe2e8f0, accent: 0x0ea5e9, metalness: 0.14, roughness: 0.72, wireframe: false, label: 'Technical Ceramic' },
  wireframe: { color: 0x38bdf8, accent: 0xfbbf24, metalness: 0.35, roughness: 0.45, wireframe: true, label: 'Mesh Wireframe' },
};

function makePart(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  explodeOffset: [number, number, number],
  name: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.userData.basePosition = new THREE.Vector3(...position);
  mesh.userData.explodeOffset = new THREE.Vector3(...explodeOffset);
  mesh.name = name;
  return mesh;
}

function buildGearMesh(
  radius: number,
  thickness: number,
  teeth: number,
  mat: THREE.Material,
  toothMat: THREE.Material,
  name: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 28), mat);
  group.add(body);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.36, radius * 0.36, thickness * 1.45, 18),
    toothMat
  );
  group.add(hub);

  const toothGeo = new THREE.BoxGeometry(radius * 0.22, thickness * 0.92, radius * 0.26);
  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, toothMat);
    t.position.set(Math.cos(angle) * (radius + radius * 0.08), 0, Math.sin(angle) * (radius + radius * 0.08));
    t.rotation.y = -angle;
    group.add(t);
  }
  return group;
}

function buildCompositeCaseModel(
  caseId: string,
  primaryMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial
): { root: THREE.Group; animate: (elapsed: number, params: Record<string, number>) => void } {
  const root = new THREE.Group();

  if (caseId === 'planetary-gearbox') {
    const ringGeo = new THREE.TorusGeometry(2.35, 0.24, 18, 48);
    const ring = makePart(ringGeo, darkMat, [0, 0, 0], [0, 1.35, 0], 'ring-gear');
    ring.rotation.x = Math.PI / 2;
    root.add(ring);

    const ringFlange = makePart(
      new THREE.CylinderGeometry(2.62, 2.62, 0.22, 48, 1, false),
      darkMat,
      [0, -0.26, 0],
      [0, -1.2, 0],
      'ring-housing'
    );
    root.add(ringFlange);

    const sun = buildGearMesh(0.75, 0.48, 12, primaryMat, accentMat, 'sun-gear');
    sun.userData.basePosition = new THREE.Vector3(0, 0, 0);
    sun.userData.explodeOffset = new THREE.Vector3(0, 1.1, 0);
    root.add(sun);

    const carrierGroup = new THREE.Group();
    carrierGroup.userData.basePosition = new THREE.Vector3(0, 0, 0);
    carrierGroup.userData.explodeOffset = new THREE.Vector3(0, -0.7, 0);
    const carrierPlate = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.12, 32), darkMat);
    carrierPlate.position.y = -0.34;
    carrierGroup.add(carrierPlate);

    const planets: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const p = buildGearMesh(0.55, 0.42, 10, accentMat, primaryMat, `planet-${i}`);
      p.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
      p.userData.orbitAngle = a;
      carrierGroup.add(p);
      planets.push(p);
    }
    root.add(carrierGroup);

    const inputShaft = makePart(
      new THREE.CylinderGeometry(0.22, 0.22, 2.2, 20),
      accentMat,
      [0, 0.65, 0],
      [0, 2.0, 0],
      'input-shaft'
    );
    root.add(inputShaft);

    return {
      root,
      animate: (elapsed, params) => {
        const rpmScale = (params.rpm ?? 1200) / 1200;
        const ratio = 1 + (params.ringTeeth ?? 54) / Math.max(6, params.sunTeeth ?? 18);
        sun.rotation.y = elapsed * 2.2 * rpmScale;
        carrierGroup.rotation.y = (elapsed * 2.2 * rpmScale) / ratio;
        planets.forEach((p, idx) => {
          p.rotation.y = -elapsed * 3.1 * rpmScale + idx * 0.4;
        });
      },
    };
  }

  if (caseId === 'navier-stokes-airfoil') {
    const shape = new THREE.Shape();
    shape.moveTo(-1.8, 0);
    shape.bezierCurveTo(-1.1, 0.56, 0.3, 0.48, 1.8, -0.02);
    shape.bezierCurveTo(0.4, -0.18, -1.0, -0.22, -1.8, 0);

    const wingGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 2.6,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    wingGeo.center();

    const wingGroup = new THREE.Group();
    wingGroup.userData.basePosition = new THREE.Vector3(0, 0.2, 0);
    wingGroup.userData.explodeOffset = new THREE.Vector3(0, 0.9, 0);
    const wingMat = primaryMat.clone();
    wingMat.map = null;
    wingMat.roughness = 0.22;
    wingMat.needsUpdate = true;
    const wingMesh = new THREE.Mesh(wingGeo, wingMat);
    wingGroup.add(wingMesh);

    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.0, 16), accentMat);
    spar.rotation.x = Math.PI / 2;
    wingGroup.add(spar);

    const tipPlateL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 0.06), darkMat);
    tipPlateL.position.z = 1.42;
    wingGroup.add(tipPlateL);

    const tipPlateR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 0.06), darkMat);
    tipPlateR.position.z = -1.42;
    wingGroup.add(tipPlateR);
    root.add(wingGroup);

    const mountBase = makePart(
      new THREE.CylinderGeometry(0.85, 1.15, 0.24, 28),
      darkMat,
      [0, -1.25, 0],
      [0, -1.2, 0],
      'tunnel-base'
    );
    root.add(mountBase);

    const strut = makePart(
      new THREE.CylinderGeometry(0.09, 0.14, 1.35, 16),
      darkMat,
      [0, -0.55, 0],
      [0, -0.6, 0],
      'tunnel-strut'
    );
    root.add(strut);

    const streamlines: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const z = -1.1 + i * 0.44;
      const y = -0.35 + (i % 3) * 0.42;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.1, y, z),
        new THREE.Vector3(-1.2, y + 0.28, z),
        new THREE.Vector3(0.4, y + 0.38, z),
        new THREE.Vector3(2.9, y - 0.14, z),
      ]);
      const tube = makePart(
        new THREE.TubeGeometry(curve, 28, 0.028, 8, false),
        accentMat,
        [0, 0.2, 0],
        [0, (i - 2.5) * 0.35, (i - 2.5) * 0.25],
        `streamline-${i}`
      );
      root.add(tube);
      streamlines.push(tube);
    }

    return {
      root,
      animate: (elapsed, params) => {
        const aoaRad = ((params.angleAttack ?? 6.5) * Math.PI) / 180;
        const velFactor = (params.flowVelocity ?? 48) / 48;
        wingGroup.rotation.z = -aoaRad;
        streamlines.forEach((s, idx) => {
          s.position.y = 0.2 + Math.sin(elapsed * 3.0 * velFactor + idx) * 0.08;
        });
      },
    };
  }

  if (caseId === 'lorentz-cyclotron') {
    const plasmaRing = makePart(
      new THREE.TorusGeometry(1.75, 0.26, 20, 48),
      accentMat,
      [0, 0.2, 0],
      [0, 0.9, 0],
      'plasma-core'
    );
    plasmaRing.rotation.x = Math.PI / 2;
    root.add(plasmaRing);

    const vacuumBase = makePart(
      new THREE.CylinderGeometry(2.3, 2.5, 0.2, 40),
      darkMat,
      [0, -1.15, 0],
      [0, -1.2, 0],
      'cryostat-base'
    );
    root.add(vacuumBase);

    const centralSolenoid = makePart(
      new THREE.CylinderGeometry(0.55, 0.55, 1.9, 24),
      primaryMat,
      [0, 0.05, 0],
      [0, 1.5, 0],
      'central-solenoid'
    );
    root.add(centralSolenoid);

    const coils: THREE.Mesh[] = [];
    const coilGeo = new THREE.TorusGeometry(0.68, 0.085, 12, 24);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const coil = makePart(
        coilGeo,
        primaryMat,
        [Math.cos(angle) * 1.75, 0.2, Math.sin(angle) * 1.75],
        [Math.cos(angle) * 1.1, 0.2, Math.sin(angle) * 1.1],
        `tf-coil-${i}`
      );
      coil.rotation.y = -angle;
      root.add(coil);
      coils.push(coil);
    }

    const particles: THREE.Mesh[] = [];
    const particleGeo = new THREE.SphereGeometry(0.09, 14, 14);
    for (let i = 0; i < 6; i++) {
      const p = makePart(particleGeo, accentMat, [1.75, 0.2, 0], [0, 0.5, 0], `ion-${i}`);
      root.add(p);
      particles.push(p);
    }

    return {
      root,
      animate: (elapsed, params) => {
        const bField = params.bField ?? 2.4;
        const vel = params.particleVel ?? 4.5;
        particles.forEach((p, idx) => {
          const theta = elapsed * vel * 0.65 + (idx * Math.PI) / 3;
          const gyro = elapsed * bField * 4.2 + idx;
          const minorR = 0.28 / Math.max(0.6, bField * 0.5);
          const majorR = 1.75 + Math.cos(gyro) * minorR;
          p.position.set(
            Math.cos(theta) * majorR,
            0.2 + Math.sin(gyro) * minorR,
            Math.sin(theta) * majorR
          );
        });
      },
    };
  }

  if (caseId === 'fem-truss-bridge') {
    const deck = makePart(
      new THREE.BoxGeometry(5.8, 0.16, 1.35),
      darkMat,
      [0, -0.35, 0],
      [0, -0.9, 0],
      'bridge-deck'
    );
    root.add(deck);

    const pierL = makePart(
      new THREE.BoxGeometry(0.55, 1.3, 1.5),
      darkMat,
      [-2.75, -1.0, 0],
      [-0.8, -0.8, 0],
      'pier-left'
    );
    const pierR = makePart(
      new THREE.BoxGeometry(0.55, 1.3, 1.5),
      darkMat,
      [2.75, -1.0, 0],
      [0.8, -0.8, 0],
      'pier-right'
    );
    root.add(pierL, pierR);

    const trussGroup = new THREE.Group();
    trussGroup.userData.basePosition = new THREE.Vector3(0, 0.35, 0);
    trussGroup.userData.explodeOffset = new THREE.Vector3(0, 1.0, 0);

    for (const zSide of [-0.58, 0.58]) {
      const topChord = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 0.1), primaryMat);
      topChord.position.set(0, 0.72, zSide);
      trussGroup.add(topChord);

      const botChord = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 0.1), primaryMat);
      botChord.position.set(0, -0.62, zSide);
      trussGroup.add(botChord);

      for (let b = 0; b < 6; b++) {
        const x0 = -2.4 + b * 0.8;
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.55, 10), accentMat);
        strut.position.set(x0 + 0.4, 0.05, zSide);
        strut.rotation.z = b % 2 === 0 ? 0.32 : -0.32;
        trussGroup.add(strut);
      }
    }
    root.add(trussGroup);

    const loadCone = makePart(
      new THREE.ConeGeometry(0.28, 0.75, 16),
      accentMat,
      [0, 1.65, 0],
      [0, 1.8, 0],
      'load-vector'
    );
    loadCone.rotation.x = Math.PI;
    root.add(loadCone);

    return {
      root,
      animate: (elapsed, params) => {
        const loadKn = params.loadKn ?? 180;
        const youngs = params.youngsGpa ?? 210;
        const damping = params.damping ?? 0.04;
        const amp = Math.min(0.28, (loadKn / Math.max(70, youngs)) * 0.16);
        const osc = Math.sin(elapsed * 5.2) * Math.exp(-damping * 1.5) * amp;
        trussGroup.position.y = 0.35 + osc;
        loadCone.position.y = 1.65 + osc * 1.4;
      },
    };
  }

  if (caseId === 'kepler-three-body') {
    const star = makePart(
      new THREE.SphereGeometry(0.62, 28, 28),
      accentMat,
      [-0.45, 0.2, 0],
      [0, 0.8, 0],
      'primary-star'
    );
    root.add(star);

    const secondary = makePart(
      new THREE.SphereGeometry(0.32, 24, 24),
      primaryMat,
      [1.7, 0.2, 0],
      [0.8, 0.4, 0],
      'secondary-planet'
    );
    root.add(secondary);

    const probe = makePart(
      new THREE.OctahedronGeometry(0.18, 0),
      accentMat,
      [0.6, 0.7, 1.4],
      [-0.8, 1.0, 0.6],
      'lagrange-probe'
    );
    root.add(probe);

    const orbitRing1 = makePart(
      new THREE.TorusGeometry(2.15, 0.025, 10, 64),
      darkMat,
      [0, 0.2, 0],
      [0, -0.5, 0],
      'orbit-track-1'
    );
    orbitRing1.rotation.x = Math.PI / 2;
    root.add(orbitRing1);

    const orbitRing2 = makePart(
      new THREE.TorusGeometry(1.45, 0.022, 10, 48),
      primaryMat,
      [0, 0.2, 0],
      [0, -1.0, 0],
      'orbit-track-2'
    );
    orbitRing2.rotation.x = Math.PI / 2;
    orbitRing2.rotation.y = 0.25;
    root.add(orbitRing2);

    const baryCenter = makePart(
      new THREE.CylinderGeometry(0.06, 0.06, 1.6, 12),
      darkMat,
      [0, -0.45, 0],
      [0, -1.2, 0],
      'barycenter-axis'
    );
    root.add(baryCenter);

    return {
      root,
      animate: (elapsed, params) => {
        const massRatio = params.massRatio ?? 0.35;
        const speed = params.orbitalSpeed ?? 1.05;
        const ecc = params.eccentricity ?? 0.18;
        const t = elapsed * speed;
        const r1 = 0.75 * massRatio;
        const r2 = 2.1 * (1 - ecc * 0.35 * Math.cos(t));
        star.position.set(-Math.cos(t) * r1, 0.2, -Math.sin(t) * r1);
        secondary.position.set(Math.cos(t) * r2, 0.2, Math.sin(t) * r2);
        probe.position.set(
          Math.cos(t + Math.PI / 3) * 1.95,
          0.2 + Math.sin(t * 2) * 0.38,
          Math.sin(t + Math.PI / 3) * 1.95
        );
        probe.rotation.y = elapsed * 2.4;
      },
    };
  }

  // Default: lidar-raymarch-terrain (and any custom imported simulation case)
  const terrainGeo = new THREE.PlaneGeometry(5.0, 5.0, 28, 28);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = Math.sin(x * 1.35) * Math.cos(z * 1.2) * 0.65 + Math.sin((x + z) * 0.8) * 0.25;
    posAttr.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  const terrainMesh = makePart(
    terrainGeo,
    primaryMat,
    [0, -0.45, 0],
    [0, -1.0, 0],
    'terrain-dem'
  );
  root.add(terrainMesh);

  const plinth = makePart(
    new THREE.BoxGeometry(5.1, 0.22, 5.1),
    darkMat,
    [0, -1.25, 0],
    [0, -1.6, 0],
    'terrain-plinth'
  );
  root.add(plinth);

  const droneGroup = new THREE.Group();
  droneGroup.userData.basePosition = new THREE.Vector3(0, 1.55, 0);
  droneGroup.userData.explodeOffset = new THREE.Vector3(0, 1.3, 0);
  const droneBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.48), accentMat);
  droneGroup.add(droneBody);
  const gimbal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 16), darkMat);
  gimbal.position.y = -0.2;
  droneGroup.add(gimbal);
  for (const [rx, rz] of [
    [-0.48, -0.36],
    [0.48, -0.36],
    [-0.48, 0.36],
    [0.48, 0.36],
  ]) {
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 14), primaryMat);
    rotor.position.set(rx, 0.14, rz);
    droneGroup.add(rotor);
  }
  root.add(droneGroup);

  const scanRays: THREE.Mesh[] = [];
  for (let i = -2; i <= 2; i++) {
    const ray = makePart(
      new THREE.CylinderGeometry(0.015, 0.045, 1.95, 8),
      accentMat,
      [i * 0.45, 0.55, 0],
      [i * 0.25, 0.5, 0],
      `lidar-ray-${i}`
    );
    ray.rotation.z = i * 0.22;
    root.add(ray);
    scanRays.push(ray);
  }

  return {
    root,
    animate: (elapsed, params) => {
      const gain = params.elevationGain ?? 2.2;
      const scale = params.terrainScale ?? 1.4;
      droneGroup.position.x = Math.sin(elapsed * 0.85) * 1.15;
      droneGroup.position.y = 1.55 + Math.cos(elapsed * 1.4) * 0.08;
      terrainMesh.scale.y = Math.max(0.45, gain / 2.2);
      scanRays.forEach((ray, idx) => {
        ray.position.x = droneGroup.position.x + (idx - 2) * 0.42;
        ray.rotation.x = Math.sin(elapsed * 2.5 * scale + idx * 0.2) * 0.15;
      });
    },
  };
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  cases,
  activeCase,
  onSelectCase,
  params,
  onParamChange,
  onResetParams,
  telemetry,
  onTickElapsed,
  onCaptureSnapshot,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const qp = new URLSearchParams(window.location.search);
    return qp.get('autostart') !== '0';
  });
  const [exploded, setExploded] = useState<number>(0);
  const [finish, setFinish] = useState<MaterialFinish>('titanium');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [dockExpanded, setDockExpanded] = useState<boolean>(true);
  const [webglError, setWebglError] = useState<string | null>(null);

  const isPlayingRef = useRef(isPlaying);
  const explodedRef = useRef(exploded);
  const paramsRef = useRef(params);
  const elapsedRef = useRef(0);
  const onTickRef = useRef(onTickElapsed);
  const captureFnRef = useRef<(() => string | null) | null>(null);
  const resetCameraRef = useRef<((preset: CameraPreset) => void) | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    explodedRef.current = exploded;
  }, [exploded]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    onTickRef.current = onTickElapsed;
  }, [onTickElapsed]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('WebGL context could not be initialized in this browser environment.');
      return;
    }

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuRenderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(gpuRenderer);

    if (isSoftwareGl) {
      renderer.dispose();
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'default' });
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth || 1024, mount.clientHeight || 640);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.032);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(
      45,
      (mount.clientWidth || 1024) / (mount.clientHeight || 640),
      0.1,
      100
    );
    const initPreset = CAMERA_PRESETS.isometric;
    camera.position.set(...initPreset.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 18;
    controls.update();

    resetCameraRef.current = (preset: CameraPreset) => {
      const cfg = CAMERA_PRESETS[preset];
      camera.position.set(...cfg.pos);
      controls.target.set(...cfg.target);
      controls.update();
    };

    // Three-point studio lighting + architectural floor grid
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(6, 9, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-7, 4, -5);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(18, 36, 0x1e3a5f, 0x131d2e);
    grid.position.y = -1.38;
    scene.add(grid);

    const floorMesh = new THREE.Mesh(
      new THREE.CircleGeometry(9.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1422, roughness: 0.9, metalness: 0.1 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.39;
    scene.add(floorMesh);

    const texLoader = new THREE.TextureLoader();
    const metalTex = texLoader.load('/src/assets/images/metal_machined_texture_1795497634409.jpg');
    metalTex.colorSpace = THREE.SRGBColorSpace;
    metalTex.wrapS = THREE.RepeatWrapping;
    metalTex.wrapT = THREE.RepeatWrapping;
    metalTex.repeat.set(2, 2);
    metalTex.anisotropy = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const finishCfg = FINISH_CONFIG[finish];
    const primaryMat = new THREE.MeshStandardMaterial({
      color: finishCfg.color,
      metalness: finishCfg.metalness,
      roughness: finishCfg.roughness,
      wireframe: finishCfg.wireframe,
      map: finishCfg.wireframe ? null : metalTex,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: finishCfg.accent,
      metalness: 0.65,
      roughness: 0.25,
      wireframe: finishCfg.wireframe,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.55,
      wireframe: finishCfg.wireframe,
    });

    const built = buildCompositeCaseModel(activeCase.id, primaryMat, accentMat, darkMat);
    scene.add(built.root);

    captureFnRef.current = () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    };

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 1024;
      const h = mount.clientHeight || 640;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let disposed = false;
    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastClock = performance.now();
    let smoothedExplode = explodedRef.current;
    let lastTelemetryPush = 0;

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastClock) / 1000));
      lastClock = now;

      if (isPlayingRef.current) {
        elapsedRef.current += dt;
        built.animate(elapsedRef.current, paramsRef.current);
        if (now - lastTelemetryPush > 120) {
          lastTelemetryPush = now;
          onTickRef.current(elapsedRef.current);
        }
      }

      smoothedExplode = THREE.MathUtils.damp(smoothedExplode, explodedRef.current, 6, dt);
      built.root.children.forEach((child) => {
        const base = child.userData.basePosition as THREE.Vector3 | undefined;
        const offset = child.userData.explodeOffset as THREE.Vector3 | undefined;
        if (base && offset) {
          child.position.set(
            base.x + offset.x * smoothedExplode,
            base.y + offset.y * smoothedExplode,
            base.z + offset.z * smoothedExplode
          );
        }
      });

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        timeoutId = setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(tick);
        }, 32);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
          else m.material?.dispose();
        }
      });
      metalTex.dispose();
      envTarget.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [activeCase.id, finish]);

  const handlePresetClick = (preset: CameraPreset) => {
    setCameraPreset(preset);
    resetCameraRef.current?.(preset);
  };

  const handleCapture = () => {
    const img = captureFnRef.current?.();
    if (img && onCaptureSnapshot) {
      onCaptureSnapshot(img);
    }
  };

  return (
    <div className="relative flex-1 min-h-0 w-full bg-[#0B0F17] overflow-hidden select-none">
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} data-testid="three-canvas-mount" className="absolute inset-0 w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B0F17] p-6 z-20">
          <div className="max-w-md rounded-xl bg-[#121927] border border-red-500/30 p-5 text-sm text-red-200">
            {webglError}
          </div>
        </div>
      )}

      {/* Top-left compact Case Selector & Title Bar */}
      <div className="absolute top-4 left-4 z-10 max-w-md bg-[#0D131F]/95 border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-sky-400 uppercase tracking-wider">
              Case {activeCase.indexLabel} · {activeCase.domain}
            </div>
            <select
              aria-label="Select 3D simulation case"
              data-testid="case-selector"
              value={activeCase.id}
              onChange={(e) => onSelectCase(e.target.value)}
              className="mt-0.5 bg-transparent text-slate-100 font-display font-semibold text-sm focus:outline-none cursor-pointer pr-4"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0D131F] text-slate-100">
                  {c.indexLabel} — {c.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleCapture}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-xs font-medium text-sky-200 cursor-pointer shrink-0"
            title="Capture 3D viewport snapshot for Gemini visual inspection"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyze Frame</span>
          </button>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (No backdrop-filter over WebGL) */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-6xl bg-[#0D131F]/95 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
          {/* Header / Quick Transport Strip */}
          <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="sim-play-pause"
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Simulate'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetParams();
                  setExploded(0);
                  handlePresetClick('isometric');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-slate-800">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <label htmlFor="exploded-slider" className="text-xs text-slate-300">
                  Explode
                </label>
                <input
                  id="exploded-slider"
                  data-testid="exploded-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={exploded}
                  onChange={(e) => setExploded(Number(e.target.value))}
                  className="w-20 accent-sky-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Live Compact Tabular Telemetry Readout */}
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
              <div>
                <span className="text-slate-400 mr-1.5">{telemetry.primaryMetricLabel}:</span>
                <span className="text-sky-300 font-semibold" data-testid="telemetry-primary">
                  {telemetry.primaryMetricValue} {telemetry.primaryMetricUnit}
                </span>
              </div>
              <div className="hidden md:block">
                <span className="text-slate-400 mr-1.5">{telemetry.secondaryMetricLabel}:</span>
                <span className="text-slate-200 font-semibold">
                  {telemetry.secondaryMetricValue} {telemetry.secondaryMetricUnit}
                </span>
              </div>
              <div className="hidden lg:block">
                <span className="text-slate-400 mr-1.5">Stability:</span>
                <span className="text-emerald-400 font-semibold">{telemetry.stabilityIndex}%</span>
              </div>
              <div className="hidden xl:block">
                <span className="text-slate-400 mr-1.5">Step:</span>
                <span className="text-amber-300 font-semibold">{telemetry.solverStepUs} µs</span>
              </div>

              <button
                type="button"
                onClick={() => setDockExpanded((d) => !d)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-xs">{dockExpanded ? 'Hide' : 'Controls'}</span>
                {dockExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expandable Parameter Sliders + Camera & PBR Material Controls */}
          {dockExpanded && (
            <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {activeCase.parameters.map((param) => {
                  const val = params[param.key] ?? param.defaultValue;
                  return (
                    <div key={param.key} className="bg-[#121B2B] border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-1 text-[11px] mb-1">
                        <span className="text-slate-300 leading-tight">{param.label}</span>
                        <span className="font-mono tabular-nums text-sky-300 shrink-0">
                          {val} {param.unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        aria-label={param.label}
                        data-testid={`param-${param.key}`}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={val}
                        onChange={(e) => onParamChange(param.key, Number(e.target.value))}
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2 justify-end">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Camera className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  {(['isometric', 'front', 'top', 'detail'] as CameraPreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className={`px-2 py-1 rounded text-xs capitalize cursor-pointer transition-colors ${
                        cameraPreset === preset
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-transparent'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(FINISH_CONFIG) as MaterialFinish[]).map((matKey) => (
                    <button
                      key={matKey}
                      type="button"
                      onClick={() => setFinish(matKey)}
                      className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                        finish === matKey
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-transparent'
                      }`}
                    >
                      {FINISH_CONFIG[matKey].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
