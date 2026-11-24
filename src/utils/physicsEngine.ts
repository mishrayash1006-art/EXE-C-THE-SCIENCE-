import { CppProjectFile, SimulationCase, SimulationTelemetry } from '../types/studio';

export interface RecaptchaChallenge {
  id: string;
  prompt: string;
  options: { id: string; label: string; shape: 'gear' | 'torus' | 'airfoil' | 'truss' }[];
  expectedId: string;
}

export function createRecaptchaChallenge(seed = Date.now()): RecaptchaChallenge {
  const catalog: { shape: 'gear' | 'torus' | 'airfoil' | 'truss'; label: string; prompt: string }[] = [
    { shape: 'gear', label: 'Planetary Gear', prompt: 'Select the Planetary Gear profile to verify human session' },
    { shape: 'torus', label: 'Toroidal Coil', prompt: 'Select the Toroidal Coil geometry to verify human session' },
    { shape: 'airfoil', label: 'NACA Airfoil', prompt: 'Select the NACA Airfoil cross-section to verify human session' },
    { shape: 'truss', label: 'Warren Truss', prompt: 'Select the Warren Truss span to verify human session' },
  ];
  const idx = Math.abs(seed) % catalog.length;
  return {
    id: `rc_${seed}`,
    prompt: catalog[idx].prompt,
    options: catalog.map((c) => ({ id: c.shape, label: c.label, shape: c.shape })),
    expectedId: catalog[idx].shape,
  };
}

export function validateRecaptchaAnswer(challenge: RecaptchaChallenge, selectedId: string): boolean {
  return Boolean(challenge && selectedId && challenge.expectedId === selectedId);
}

export function computeSimulationTelemetry(
  caseId: string,
  params: Record<string, number>,
  elapsedSec: number
): SimulationTelemetry {
  const curveSeries: { x: number; y1: number; y2: number }[] = [];

  if (caseId === 'planetary-gearbox') {
    const rpm = params.rpm ?? 1200;
    const sunTeeth = params.sunTeeth ?? 18;
    const ringTeeth = params.ringTeeth ?? 54;
    const loadNm = params.loadNm ?? 45;
    const ratio = 1 + ringTeeth / Math.max(6, sunTeeth);
    const carrierRpm = rpm / ratio;
    const outputTorque = loadNm * ratio * 0.965;
    const angularVel = (rpm * 2 * Math.PI) / 60;
    const powerW = loadNm * angularVel;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const meshHarmonic = Math.sin(t * Math.PI * 4 + elapsedSec * 2) * 3.2;
      curveSeries.push({
        x: Math.round(t * 360),
        y1: Number((outputTorque + meshHarmonic).toFixed(2)),
        y2: Number((carrierRpm + Math.cos(t * Math.PI * 2) * 4).toFixed(2)),
      });
    }
    return {
      primaryMetricLabel: 'Output Torque',
      primaryMetricValue: Number(outputTorque.toFixed(1)),
      primaryMetricUnit: 'N·m',
      secondaryMetricLabel: 'Carrier Speed',
      secondaryMetricValue: Number(carrierRpm.toFixed(1)),
      secondaryMetricUnit: 'RPM',
      energyJ: Number((powerW * 0.5).toFixed(1)),
      stabilityIndex: Number(Math.max(82, 99.4 - (rpm / 3000) * 6).toFixed(1)),
      convergenceResidual: 0.00014,
      solverStepUs: 42,
      curveSeries,
    };
  }

  if (caseId === 'navier-stokes-airfoil') {
    const flowVelocity = params.flowVelocity ?? 48;
    const angleAttack = params.angleAttack ?? 6.5;
    const viscosity = params.viscosity ?? 1.5;
    const chord = 1.2;
    const reynolds = (flowVelocity * chord) / (viscosity * 1e-5);
    const alphaRad = (angleAttack * Math.PI) / 180;
    const stallFactor = angleAttack > 14 ? Math.max(0.35, 1 - (angleAttack - 14) * 0.08) : 1;
    const cl = 2 * Math.PI * Math.sin(alphaRad) * stallFactor;
    const cd = 0.014 + 0.045 * cl * cl;
    const dynamicPressure = 0.5 * 1.225 * flowVelocity * flowVelocity;
    const liftN = dynamicPressure * chord * cl;
    for (let i = 0; i <= 24; i++) {
      const alpha = -4 + i;
      const aRad = (alpha * Math.PI) / 180;
      const sf = alpha > 14 ? Math.max(0.35, 1 - (alpha - 14) * 0.08) : 1;
      const cLift = 2 * Math.PI * Math.sin(aRad) * sf;
      curveSeries.push({
        x: alpha,
        y1: Number(cLift.toFixed(3)),
        y2: Number(((0.014 + 0.045 * cLift * cLift) * 10).toFixed(3)),
      });
    }
    return {
      primaryMetricLabel: 'Aerodynamic Lift',
      primaryMetricValue: Number(liftN.toFixed(1)),
      primaryMetricUnit: 'N',
      secondaryMetricLabel: 'Reynolds Number',
      secondaryMetricValue: Number((reynolds / 1e6).toFixed(2)),
      secondaryMetricUnit: 'M Re',
      energyJ: Number((liftN * 0.85).toFixed(1)),
      stabilityIndex: Number(Math.max(55, 98.2 - Math.max(0, angleAttack - 11) * 4.5).toFixed(1)),
      convergenceResidual: Number((0.00032 + Math.max(0, angleAttack - 12) * 0.0004).toFixed(5)),
      solverStepUs: 118,
      curveSeries,
    };
  }

  if (caseId === 'lorentz-cyclotron') {
    const bField = params.bField ?? 2.4;
    const eField = params.eField ?? 120;
    const velocity = params.particleVel ?? 4.5;
    const mass = 1.67;
    const charge = 1.6;
    const larmorRadiusMm = (mass * velocity * 10) / Math.max(0.2, charge * bField);
    const cyclotronMhz = (charge * bField * 15.2) / mass;
    const kineticKev = 0.5 * mass * velocity * velocity * 8.4;
    for (let i = 0; i <= 24; i++) {
      const phase = (i / 24) * Math.PI * 2;
      curveSeries.push({
        x: Math.round((i / 24) * 100),
        y1: Number((larmorRadiusMm * Math.cos(phase + elapsedSec)).toFixed(2)),
        y2: Number((larmorRadiusMm * Math.sin(phase + elapsedSec) + eField * 0.02).toFixed(2)),
      });
    }
    return {
      primaryMetricLabel: 'Larmor Radius',
      primaryMetricValue: Number(larmorRadiusMm.toFixed(2)),
      primaryMetricUnit: 'mm',
      secondaryMetricLabel: 'Gyrofrequency',
      secondaryMetricValue: Number(cyclotronMhz.toFixed(1)),
      secondaryMetricUnit: 'MHz',
      energyJ: Number(kineticKev.toFixed(1)),
      stabilityIndex: Number(Math.min(99.9, 88 + bField * 2.2).toFixed(1)),
      convergenceResidual: 0.00004,
      solverStepUs: 31,
      curveSeries,
    };
  }

  if (caseId === 'fem-truss-bridge') {
    const loadKn = params.loadKn ?? 180;
    const youngsGpa = params.youngsGpa ?? 210;
    const damping = params.damping ?? 0.04;
    const areaCm2 = 36;
    const spanM = 18;
    const maxStressMpa = (loadKn * 1.45) / (areaCm2 * 0.1);
    const deflectionMm = (loadKn * Math.pow(spanM, 3)) / (48 * youngsGpa * 1.85);
    const naturalHz = 11.4 * Math.sqrt(youngsGpa / 210);
    for (let i = 0; i <= 24; i++) {
      const xPos = (i / 24) * spanM;
      const mode1 = Math.sin((Math.PI * xPos) / spanM) * deflectionMm;
      const mode2 = Math.sin((2 * Math.PI * xPos) / spanM) * deflectionMm * 0.28 * Math.exp(-damping * 4);
      curveSeries.push({
        x: Number(xPos.toFixed(1)),
        y1: Number(mode1.toFixed(2)),
        y2: Number((mode1 + mode2).toFixed(2)),
      });
    }
    return {
      primaryMetricLabel: 'Peak Von Mises',
      primaryMetricValue: Number(maxStressMpa.toFixed(1)),
      primaryMetricUnit: 'MPa',
      secondaryMetricLabel: 'Midspan Deflection',
      secondaryMetricValue: Number(deflectionMm.toFixed(2)),
      secondaryMetricUnit: 'mm',
      energyJ: Number((0.5 * loadKn * deflectionMm).toFixed(1)),
      stabilityIndex: Number(Math.max(40, 100 - maxStressMpa * 0.12 - (1 / Math.max(0.01, naturalHz)) * 20).toFixed(1)),
      convergenceResidual: 0.00009,
      solverStepUs: 86,
      curveSeries,
    };
  }

  if (caseId === 'kepler-three-body') {
    const massRatio = params.massRatio ?? 0.35;
    const orbitalSpeed = params.orbitalSpeed ?? 1.05;
    const eccentricity = params.eccentricity ?? 0.18;
    const totalEnergy = 0.5 * orbitalSpeed * orbitalSpeed - (1 + massRatio) / (1 - eccentricity * 0.3);
    const periodYears = Math.pow(1 + eccentricity, 1.5) / Math.sqrt(1 + massRatio);
    for (let i = 0; i <= 24; i++) {
      const theta = (i / 24) * Math.PI * 2;
      const r = (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(theta));
      curveSeries.push({
        x: Math.round((i / 24) * 360),
        y1: Number((r * orbitalSpeed).toFixed(3)),
        y2: Number((totalEnergy + Math.sin(theta) * 0.012).toFixed(3)),
      });
    }
    return {
      primaryMetricLabel: 'Orbital Period',
      primaryMetricValue: Number(periodYears.toFixed(2)),
      primaryMetricUnit: 'yr',
      secondaryMetricLabel: 'Hamiltonian H',
      secondaryMetricValue: Number(totalEnergy.toFixed(3)),
      secondaryMetricUnit: 'MJ/kg',
      energyJ: Number((Math.abs(totalEnergy) * 1420).toFixed(1)),
      stabilityIndex: Number(Math.max(45, 99.6 - eccentricity * 68 - Math.abs(orbitalSpeed - 1) * 18).toFixed(1)),
      convergenceResidual: 0.00001,
      solverStepUs: 24,
      curveSeries,
    };
  }

  // Default: lidar-raymarch-terrain (or custom cases)
  const raySteps = params.raySteps ?? 64;
  const terrainScale = params.terrainScale ?? 1.4;
  const elevationGain = params.elevationGain ?? 2.2;
  const raysPerSecM = (2.4 * 64) / Math.max(16, raySteps);
  const meanElevationM = 420 * elevationGain;
  for (let i = 0; i <= 24; i++) {
    const dist = i * 5;
    const ridge = Math.sin(i * 0.45 * terrainScale) * 45 * elevationGain + 140;
    curveSeries.push({
      x: dist,
      y1: Number(ridge.toFixed(1)),
      y2: Number((ridge * 0.72 + Math.cos(i * 0.3) * 18).toFixed(1)),
    });
  }
  return {
    primaryMetricLabel: 'Ray Throughput',
    primaryMetricValue: Number(raysPerSecM.toFixed(1)),
    primaryMetricUnit: 'MRay/s',
    secondaryMetricLabel: 'Peak Elevation',
    secondaryMetricValue: Number(meanElevationM.toFixed(0)),
    secondaryMetricUnit: 'm',
    energyJ: Number((raySteps * 3.8).toFixed(1)),
    stabilityIndex: Number(Math.min(99.8, 76 + (raySteps / 128) * 22).toFixed(1)),
    convergenceResidual: 0.00006,
    solverStepUs: Math.round(raySteps * 1.4),
    curveSeries,
  };
}

export function generateCppProjectFiles(
  simCase: SimulationCase,
  params: Record<string, number>
): CppProjectFile[] {
  const paramDefines = simCase.parameters
    .map((p) => `    double ${p.key} = ${(params[p.key] ?? p.defaultValue).toFixed(4)}; // ${p.label} (${p.unit})`)
    .join('\n');

  const cmake = `cmake_minimum_required(VERSION 3.22)
project(Helios_${simCase.cppClassName} LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenGL REQUIRED)
find_package(glfw3 3.3 REQUIRED)
find_package(glm REQUIRED)

add_executable(\${PROJECT_NAME}
  src/main.cpp
  src/Solver.cpp
)

target_include_directories(\${PROJECT_NAME} PRIVATE include)
target_link_libraries(\${PROJECT_NAME} PRIVATE OpenGL::GL glfw glm::glm)

if(MSVC)
  target_compile_options(\${PROJECT_NAME} PRIVATE /W4 /O2 /arch:AVX2)
else()
  target_compile_options(\${PROJECT_NAME} PRIVATE -Wall -Wextra -O3 -march=native)
endif()
`;

  const header = `#pragma once
#include <array>
#include <cstdint>
#include <string>
#include <vector>
#include <glm/glm.hpp>

namespace helios {

struct SimParameters {
${paramDefines}
};

struct TelemetryFrame {
    double primaryMetric{0.0};
    double secondaryMetric{0.0};
    double totalEnergyJ{0.0};
    double stabilityIndex{100.0};
    uint64_t stepMicros{0};
};

class ${simCase.cppClassName} {
public:
    explicit ${simCase.cppClassName}(const SimParameters& params);
    void step(double dtSeconds);
    void setParameters(const SimParameters& params);
    [[nodiscard]] TelemetryFrame telemetry() const noexcept;
    [[nodiscard]] const std::vector<glm::vec3>& vertexPositions() const noexcept;

private:
    SimParameters params_;
    TelemetryFrame state_{};
    double elapsed_{0.0};
    std::vector<glm::vec3> nodes_;
    void rebuildGeometry();
};

} // namespace helios
`;

  const solver = `#include "SimCore.hpp"
#include <chrono>
#include <cmath>

namespace helios {

${simCase.cppClassName}::${simCase.cppClassName}(const SimParameters& params)
    : params_(params) {
    rebuildGeometry();
}

void ${simCase.cppClassName}::setParameters(const SimParameters& params) {
    params_ = params;
    rebuildGeometry();
}

void ${simCase.cppClassName}::rebuildGeometry() {
    nodes_.clear();
    nodes_.reserve(256);
    for (int i = 0; i < 256; ++i) {
        const float theta = static_cast<float>(i) * 0.02454369f;
        nodes_.emplace_back(std::cos(theta), std::sin(theta * 2.0f) * 0.25f, std::sin(theta));
    }
}

void ${simCase.cppClassName}::step(double dtSeconds) {
    const auto t0 = std::chrono::steady_clock::now();
    elapsed_ += dtSeconds;

    // Governing law: ${simCase.governingEquation}
    const double phase = std::sin(elapsed_ * 1.5);
    const double firstParam = ${simCase.parameters[0] ? `params_.${simCase.parameters[0].key}` : '1.0'};
    const double secondParam = ${simCase.parameters[1] ? `params_.${simCase.parameters[1].key}` : '1.0'};

    state_.primaryMetric = firstParam * (1.0 + 0.08 * phase);
    state_.secondaryMetric = secondParam * 0.965;
    state_.totalEnergyJ = 0.5 * firstParam * secondParam;
    state_.stabilityIndex = std::clamp(99.5 - std::abs(phase) * 2.5, 0.0, 100.0);

    for (size_t i = 0; i < nodes_.size(); ++i) {
        const float wave = static_cast<float>(std::sin(elapsed_ + static_cast<double>(i) * 0.1));
        nodes_[i].y = wave * 0.35f;
    }

    const auto t1 = std::chrono::steady_clock::now();
    state_.stepMicros = static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count()
    );
}

TelemetryFrame ${simCase.cppClassName}::telemetry() const noexcept {
    return state_;
}

const std::vector<glm::vec3>& ${simCase.cppClassName}::vertexPositions() const noexcept {
    return nodes_;
}

} // namespace helios
`;

  const mainCpp = `#include "SimCore.hpp"
#include <GLFW/glfw3.h>
#include <glm/gtc/matrix_transform.hpp>
#include <iostream>

int main() {
    if (!glfwInit()) {
        std::cerr << "Failed to initialize GLFW context\\n";
        return -1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_SAMPLES, 4);

    GLFWwindow* window = glfwCreateWindow(1440, 900, "Helios C++20 :: ${simCase.title}", nullptr, nullptr);
    if (!window) {
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);

    helios::SimParameters params{};
    helios::${simCase.cppClassName} solver(params);

    double lastTime = glfwGetTime();
    while (!glfwWindowShouldClose(window)) {
        const double now = glfwGetTime();
        const double dt = now - lastTime;
        lastTime = now;

        solver.step(dt);
        const auto frame = solver.telemetry();
        (void)frame;

        glClearColor(0.043f, 0.059f, 0.090f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
`;

  const fragShader = `#version 460 core
out vec4 FragColor;

in vec3 vWorldPos;
in vec3 vNormal;

uniform vec3 uCameraPos;
uniform vec3 uAlbedo;
uniform float uMetallic;
uniform float uRoughness;

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(vec3(6.0, 10.0, 5.0));
    vec3 H = normalize(V + L);

    float ndotl = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), mix(128.0, 8.0, uRoughness));
    vec3 F0 = mix(vec3(0.04), uAlbedo, uMetallic);
    vec3 color = uAlbedo * (0.18 + ndotl * 0.82) + F0 * spec;

    FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}
`;

  return [
    { path: 'CMakeLists.txt', language: 'cmake', content: cmake },
    { path: 'include/SimCore.hpp', language: 'cpp', content: header },
    { path: 'src/Solver.cpp', language: 'cpp', content: solver },
    { path: 'src/main.cpp', language: 'cpp', content: mainCpp },
    { path: 'shaders/pbr.frag', language: 'glsl', content: fragShader },
  ];
}

export function validateBlueprintPayload(payload: {
  ownerId: string;
  caseId: string;
  title: string;
  algorithm: string;
  iv: string;
  ciphertext: string;
  checksum: string;
}): { valid: boolean; reason?: string } {
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  if (!idRegex.test(payload.ownerId) || payload.ownerId.length > 128) {
    return { valid: false, reason: 'Invalid ownerId format' };
  }
  if (!idRegex.test(payload.caseId) || payload.caseId.length > 64) {
    return { valid: false, reason: 'Invalid caseId format' };
  }
  if (!payload.title || payload.title.length > 120) {
    return { valid: false, reason: 'Title must be 1-120 characters' };
  }
  if (payload.algorithm !== 'AES-256-GCM') {
    return { valid: false, reason: 'Unsupported encryption algorithm' };
  }
  if (payload.iv.length < 8 || payload.iv.length > 64) {
    return { valid: false, reason: 'Invalid IV length' };
  }
  if (payload.ciphertext.length < 16 || payload.ciphertext.length > 65536) {
    return { valid: false, reason: 'Ciphertext length out of bounds' };
  }
  if (payload.checksum.length < 16 || payload.checksum.length > 128) {
    return { valid: false, reason: 'Invalid SHA-256 checksum' };
  }
  return { valid: true };
}
