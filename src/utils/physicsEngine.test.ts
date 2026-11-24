import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSimulationTelemetry,
  createRecaptchaChallenge,
  generateCppProjectFiles,
  validateBlueprintPayload,
  validateRecaptchaAnswer,
} from './physicsEngine';
import { SIMULATION_CASES } from '../data/simulationCases';

test('planetary gearbox computes accurate Willis torque multiplication', () => {
  const telemetry = computeSimulationTelemetry(
    'planetary-gearbox',
    { rpm: 1200, sunTeeth: 18, ringTeeth: 54, loadNm: 50 },
    0
  );
  // ratio = 1 + 54/18 = 4.0; torque = 50 * 4 * 0.965 = 193.0
  assert.equal(telemetry.primaryMetricValue, 193);
  assert.equal(telemetry.secondaryMetricValue, 300);
  assert.equal(telemetry.curveSeries.length, 25);
});

test('navier-stokes airfoil models stall lift reduction at high angle of attack', () => {
  const optimal = computeSimulationTelemetry(
    'navier-stokes-airfoil',
    { flowVelocity: 60, angleAttack: 8, viscosity: 1.5 },
    0
  );
  const stalled = computeSimulationTelemetry(
    'navier-stokes-airfoil',
    { flowVelocity: 60, angleAttack: 20, viscosity: 1.5 },
    0
  );
  assert.ok(stalled.stabilityIndex < optimal.stabilityIndex);
});

test('lorentz cyclotron shrinks Larmor radius when magnetic flux increases', () => {
  const lowB = computeSimulationTelemetry(
    'lorentz-cyclotron',
    { bField: 1.0, eField: 100, particleVel: 4.0 },
    0
  );
  const highB = computeSimulationTelemetry(
    'lorentz-cyclotron',
    { bField: 4.0, eField: 100, particleVel: 4.0 },
    0
  );
  assert.ok(highB.primaryMetricValue < lowB.primaryMetricValue);
  assert.ok(highB.secondaryMetricValue > lowB.secondaryMetricValue);
});

test('C++20 generator outputs CMakeLists, SimCore.hpp, Solver.cpp, main.cpp, and pbr.frag', () => {
  const simCase = SIMULATION_CASES[0];
  const files = generateCppProjectFiles(simCase, { rpm: 1800, sunTeeth: 18, ringTeeth: 54, loadNm: 60 });
  assert.equal(files.length, 5);
  assert.ok(files.some((f) => f.path === 'CMakeLists.txt' && f.content.includes('CMAKE_CXX_STANDARD 20')));
  assert.ok(files.some((f) => f.path === 'include/SimCore.hpp' && f.content.includes('1800.0000')));
});

test('reCAPTCHA challenge validates matching selection and rejects mismatch', () => {
  const challenge = createRecaptchaChallenge(101);
  assert.equal(validateRecaptchaAnswer(challenge, challenge.expectedId), true);
  assert.equal(validateRecaptchaAnswer(challenge, 'invalid-shape'), false);
});

test('Firestore blueprint payload validator enforces AES-256-GCM and length bounds', () => {
  const good = validateBlueprintPayload({
    ownerId: 'user_123',
    caseId: 'planetary-gearbox',
    title: 'Gearbox Run 1',
    algorithm: 'AES-256-GCM',
    iv: 'abcdefgh1234',
    ciphertext: '0123456789abcdef0123456789abcdef',
    checksum: 'abcdef0123456789abcdef0123456789',
  });
  assert.equal(good.valid, true);

  const badAlgo = validateBlueprintPayload({
    ownerId: 'user_123',
    caseId: 'planetary-gearbox',
    title: 'Gearbox Run 1',
    algorithm: 'NONE',
    iv: 'abcdefgh1234',
    ciphertext: '0123456789abcdef0123456789abcdef',
    checksum: 'abcdef0123456789abcdef0123456789',
  });
  assert.equal(badAlgo.valid, false);
});
