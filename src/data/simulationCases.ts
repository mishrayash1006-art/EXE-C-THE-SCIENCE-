import { SimulationCase } from '../types/studio';

export const SIMULATION_CASES: SimulationCase[] = [
  {
    id: 'planetary-gearbox',
    indexLabel: '01',
    title: 'Epicyclic Planetary Gearbox',
    domain: 'Rigid-Body Kinematics',
    subtitle: 'Sun, planet carrier, and internal ring gear torque multiplication',
    summary:
      'Models involute spur gear meshing, planetary carrier angular velocity ratios, and contact stress distribution across hardened titanium teeth.',
    cppClassName: 'PlanetaryGearboxSolver',
    governingEquation: 'ω_sun + (N_ring / N_sun) · ω_ring = (1 + N_ring / N_sun) · ω_carrier',
    equations: [
      {
        title: 'Willis Epicyclic Ratio',
        formula: 'i = 1 + (Z_ring / Z_sun)',
        explanation:
          'When the outer ring gear is stationary, input torque at the central sun gear multiplies across the planet carrier proportional to the ring-to-sun tooth ratio.',
      },
      {
        title: 'Hertzian Contact Stress',
        formula: 'σ_H = Z_E · √(F_t · (u + 1) / (b · d_1 · u))',
        explanation:
          'Evaluates localized compressive stress at the pitch line where involute tooth flanks transmit tangential load.',
      },
    ],
    concepts: [
      {
        heading: 'Load Sharing Across Planets',
        body: 'Distributing input torque across three or four symmetric planet gears divides tangential tooth force, allowing compact axial packaging with high torsional stiffness.',
        keyTakeaway: 'Three planet gears cut individual tooth bending stress by up to 66% compared to a single-mesh pinion.',
      },
      {
        heading: 'Phase-Locked Involute Meshing',
        body: 'To assemble cleanly without interference, (Z_sun + Z_ring) must be evenly divisible by the number of planet gears.',
        keyTakeaway: 'Maintaining integer pitch-circle symmetry prevents cyclic vibration harmonics at high RPM.',
      },
    ],
    infographicNodes: [
      { label: 'Transmission Ratio', value: '4.00 : 1', unit: 'Ratio', detail: 'Fixed-ring reduction stage' },
      { label: 'Mesh Efficiency', value: '96.5', unit: '%', detail: 'Synthetic elastohydrodynamic film' },
      { label: 'Planet Count', value: '3', unit: 'Units', detail: '120° balanced phase spacing' },
      { label: 'Material Grade', value: 'Ti-6Al-4V', unit: 'Alloy', detail: 'CNC machined gear blanks' },
    ],
    parameters: [
      { key: 'rpm', label: 'Sun Input Speed', unit: 'RPM', min: 200, max: 3000, step: 50, defaultValue: 1200 },
      { key: 'sunTeeth', label: 'Sun Gear Teeth', unit: 'T', min: 12, max: 30, step: 3, defaultValue: 18 },
      { key: 'ringTeeth', label: 'Ring Gear Teeth', unit: 'T', min: 36, max: 72, step: 6, defaultValue: 54 },
      { key: 'loadNm', label: 'Input Torque', unit: 'N·m', min: 10, max: 120, step: 5, defaultValue: 45 },
    ],
  },
  {
    id: 'navier-stokes-airfoil',
    indexLabel: '02',
    title: 'Navier-Stokes Airfoil Vortex',
    domain: 'Fluid Aerodynamics',
    subtitle: 'Incompressible boundary-layer separation and Kutta-Joukowski lift',
    summary:
      'Simulates 3D airflow streamlines past a cambered NACA airfoil section, tracking laminar-to-turbulent transition, trailing vortices, and stall onset.',
    cppClassName: 'NavierStokesAirfoilSolver',
    governingEquation: 'ρ(∂u/∂t + u·∇u) = -∇p + μ∇²u + f',
    equations: [
      {
        title: 'Kutta-Joukowski Lift Theorem',
        formula: 'L′ = ρ_∞ · V_∞ · Γ',
        explanation:
          'Net aerodynamic lift per unit span scales linearly with fluid density, freestream velocity, and bound circulation around the airfoil.',
      },
      {
        title: 'Reynolds Number',
        formula: 'Re = (ρ · V · c) / μ',
        explanation:
          'Quantifies inertial-to-viscous force balance to predict boundary layer transition and wake vortex shedding.',
      },
    ],
    concepts: [
      {
        heading: 'Adverse Pressure Gradient & Stall',
        body: 'Beyond the critical angle of attack (~14°), upper-surface flow loses kinetic energy and detaches from the trailing edge, collapsing lift and spiking form drag.',
        keyTakeaway: 'Keeping angle of attack between 4° and 11° maximizes lift-to-drag efficiency.',
      },
      {
        heading: 'Trailing-Edge Vortex Shedding',
        body: 'Asymmetric pressure between upper suction and lower pressure surfaces generates counter-rotating wake eddies modeled via curl-free potential + vorticity particles.',
        keyTakeaway: 'Wake turbulence intensity rises quadratically with lift coefficient.',
      },
    ],
    infographicImage: '/src/assets/images/infographic_fluid_aerodynamics_1795497636020.jpg',
    infographicNodes: [
      { label: 'Profile Family', value: 'NACA 2412', unit: 'Section', detail: '2% camber at 40% chord' },
      { label: 'Critical Stall', value: '14.2', unit: 'deg', detail: 'Boundary separation threshold' },
      { label: 'Air Density', value: '1.225', unit: 'kg/m³', detail: 'ISA sea-level standard' },
      { label: 'Chord Length', value: '1.20', unit: 'm', detail: 'Reference span unit' },
    ],
    parameters: [
      { key: 'flowVelocity', label: 'Freestream Velocity', unit: 'm/s', min: 15, max: 110, step: 5, defaultValue: 48 },
      { key: 'angleAttack', label: 'Angle of Attack', unit: 'deg', min: -4, max: 20, step: 0.5, defaultValue: 6.5 },
      { key: 'viscosity', label: 'Kinematic Viscosity', unit: '10⁻⁵ m²/s', min: 0.5, max: 4.0, step: 0.1, defaultValue: 1.5 },
    ],
  },
  {
    id: 'lorentz-cyclotron',
    indexLabel: '03',
    title: 'Toroidal Lorentz Cyclotron',
    domain: 'Electromagnetics',
    subtitle: 'Helical charged-particle confinement under crossed E and B fields',
    summary:
      'Integrates relativistic Boris-pusher particle orbits inside a segmented toroidal solenoid, visualizing magnetic flux rings and Larmor gyration.',
    cppClassName: 'LorentzCyclotronSolver',
    governingEquation: 'F = q(E + v × B)',
    equations: [
      {
        title: 'Larmor Gyroradius',
        formula: 'r_L = (m · v_⊥) / (|q| · B)',
        explanation:
          'Stronger axial magnetic induction B tightens helical confinement, shrinking orbital radius for high-velocity ions.',
      },
      {
        title: 'Cyclotron Frequency',
        formula: 'ω_c = (|q| · B) / m',
        explanation:
          'In the non-relativistic regime, gyrofrequency depends solely on charge-to-mass ratio and magnetic flux density.',
      },
    ],
    concepts: [
      {
        heading: 'Magnetic Mirror & Toroidal Drift',
        body: 'Because magnetic field lines curve around the torus, radial field gradients induce vertical curvature drift neutralized by poloidal twist.',
        keyTakeaway: 'Helical field winding prevents charge separation and wall impact.',
      },
      {
        heading: 'Symplectic Boris Integration',
        body: 'Unlike standard Euler integration, the Boris algorithm preserves phase-space volume and prevents artificial energy gain over millions of gyro-periods.',
        keyTakeaway: 'Energy error remains bounded even with large C++ time steps.',
      },
    ],
    infographicImage: '/src/assets/images/infographic_electromagnetic_orbit_1795497636503.jpg',
    infographicNodes: [
      { label: 'Integrator', value: 'Boris', unit: 'Symplectic', detail: 'Exact rotation in B-field' },
      { label: 'Toroidal Coils', value: '16', unit: 'Coils', detail: 'Copper-niobium superconductor' },
      { label: 'Peak Flux', value: '5.0', unit: 'Tesla', detail: 'Axial confinement envelope' },
      { label: 'Time Step', value: '0.31', unit: 'ns', detail: 'Sub-gyroperiod resolution' },
    ],
    parameters: [
      { key: 'bField', label: 'Magnetic Flux B', unit: 'T', min: 0.5, max: 5.0, step: 0.1, defaultValue: 2.4 },
      { key: 'eField', label: 'RF Accelerating E', unit: 'kV/m', min: 20, max: 300, step: 10, defaultValue: 120 },
      { key: 'particleVel', label: 'Injection Velocity', unit: '10⁶ m/s', min: 1.0, max: 10.0, step: 0.5, defaultValue: 4.5 },
    ],
  },
  {
    id: 'fem-truss-bridge',
    indexLabel: '04',
    title: 'FEM Warren Truss Harmonics',
    domain: 'Structural Mechanics',
    subtitle: '3D stiffness matrix assembly, nodal displacement, and modal resonance',
    summary:
      'Assembles a global finite-element stiffness matrix across articulated Warren truss bays, highlighting axial tension, compression, and dynamic mode shapes.',
    cppClassName: 'FemTrussModalSolver',
    governingEquation: '[M]{ü} + [C]{u̇} + [K]{u} = {F(t)}',
    equations: [
      {
        title: 'Axial Element Stiffness',
        formula: 'k_e = (E · A) / L',
        explanation:
          'Each diagonal strut resists axial elongation proportional to Young’s modulus E and cross-sectional area A.',
      },
      {
        title: 'First Bending Natural Frequency',
        formula: 'f_1 = (π / 2L²) · √(E · I / ρA)',
        explanation:
          'Determines whether harmonic traffic or wind gusts excite structural resonance.',
      },
    ],
    concepts: [
      {
        heading: 'Triangulated Load Path Efficiency',
        body: 'Pin-jointed triangles convert transverse bending moments into pure axial compression in top chords and tension in bottom chords.',
        keyTakeaway: 'Eliminating bending inside individual struts raises stiffness-to-weight ratio dramatically.',
      },
      {
        heading: 'Rayleigh Damping Envelope',
        body: 'Viscous structural damping attenuates higher-order modal oscillations before cyclic fatigue micro-cracks propagate.',
        keyTakeaway: 'Increasing damping from 2% to 6% cuts peak resonant amplitude by nearly two-thirds.',
      },
    ],
    infographicNodes: [
      { label: 'Span Geometry', value: '18.0', unit: 'm', detail: '6-bay triangulated Warren truss' },
      { label: 'Section Area', value: '36.0', unit: 'cm²', detail: 'Hollow box structural members' },
      { label: 'Yield Limit', value: '355', unit: 'MPa', detail: 'S355 structural steel baseline' },
      { label: 'DOF Count', value: '42', unit: 'Nodes', detail: '3D global stiffness assembly' },
    ],
    parameters: [
      { key: 'loadKn', label: 'Midspan Point Load', unit: 'kN', min: 40, max: 450, step: 10, defaultValue: 180 },
      { key: 'youngsGpa', label: 'Young’s Modulus E', unit: 'GPa', min: 70, max: 400, step: 10, defaultValue: 210 },
      { key: 'damping', label: 'Damping Ratio ζ', unit: 'ratio', min: 0.01, max: 0.15, step: 0.01, defaultValue: 0.04 },
    ],
  },
  {
    id: 'kepler-three-body',
    indexLabel: '05',
    title: 'Symplectic 3-Body Astrodynamics',
    domain: 'Orbital Mechanics',
    subtitle: 'Gravitational N-body trajectories, Lagrange stability, and Hamiltonian drift',
    summary:
      'Integrates coupled inverse-square gravitational interactions among primary, secondary, and probe bodies using 4th-order Runge-Kutta and symplectic splitting.',
    cppClassName: 'ThreeBodyAstrodynamicsSolver',
    governingEquation: 'd²r_i/dt² = -G · Σ_{j≠i} m_j (r_i - r_j) / |r_i - r_j|³',
    equations: [
      {
        title: 'Vis-Viva Orbital Equation',
        formula: 'v² = μ · (2/r - 1/a)',
        explanation:
          'Relates instantaneous orbital speed to radial distance and semi-major axis along any conic trajectory.',
      },
      {
        title: 'Jacobi Constant',
        formula: 'C_J = 2Ω(x, y) - (ẋ² + ẏ² + ż²)',
        explanation:
          'Conserved quantity in the rotating frame governing zero-velocity forbidden regions around L1–L5.',
      },
    ],
    concepts: [
      {
        heading: 'Hill Sphere & Lagrange Equilibria',
        body: 'In the restricted three-body problem, L4 and L5 form equilateral triangles with the primaries and remain linearly stable when mass ratio μ < 0.0385.',
        keyTakeaway: 'Trojan stability depends directly on primary-to-secondary mass ratio.',
      },
      {
        heading: 'Energy Drift Control',
        body: 'Long-horizon orbital propagation requires symplectic or adaptive RK4 stepping to prevent planets from spiraling artificially outward.',
        keyTakeaway: 'Hamiltonian conservation verifies numerical accuracy over multi-year epochs.',
      },
    ],
    infographicNodes: [
      { label: 'Integrator', value: 'RK4', unit: '4th-Order', detail: 'O(dt⁴) local truncation error' },
      { label: 'Frame', value: 'Barycentric', unit: 'Inertial', detail: 'Center-of-mass anchored' },
      { label: 'Lagrange Points', value: 'L1 – L5', unit: 'Equilibria', detail: 'Effective potential extrema' },
      { label: 'Step Latency', value: '24', unit: 'µs', detail: 'Vectorized SIMD kernel' },
    ],
    parameters: [
      { key: 'massRatio', label: 'Secondary Mass Ratio', unit: 'M₂/M₁', min: 0.05, max: 0.85, step: 0.05, defaultValue: 0.35 },
      { key: 'orbitalSpeed', label: 'Tangential Velocity', unit: 'v₀', min: 0.65, max: 1.45, step: 0.05, defaultValue: 1.05 },
      { key: 'eccentricity', label: 'Orbital Eccentricity', unit: 'e', min: 0.0, max: 0.6, step: 0.02, defaultValue: 0.18 },
    ],
  },
  {
    id: 'lidar-raymarch-terrain',
    indexLabel: '06',
    title: 'Ray-Marched LiDAR Terrain',
    domain: 'Geospatial & SDF',
    subtitle: 'Signed Distance Field sphere tracing and topographic elevation meshing',
    summary:
      'Executes real-time procedural SDF ray-marching and multi-beam LiDAR scan sweeps across sculpted ridge topography with elevation contour synthesis.',
    cppClassName: 'LidarTerrainRaymarchSolver',
    governingEquation: 'p_{k+1} = p_k + d_SDF(p_k) · r̂',
    equations: [
      {
        title: 'Lipschitz Sphere Tracing',
        formula: 't_{n+1} = t_n + f(r_0 + t_n d̂) / L',
        explanation:
          'Advances each ray safely by the exact distance to the nearest surface without overshooting steep canyon walls.',
      },
      {
        title: 'Central-Difference Surface Normal',
        formula: 'n̂ = normalize(∇f(p))',
        explanation:
          'Computes analytic shading normals from four tetrahedral SDF samples in constant time.',
      },
    ],
    concepts: [
      {
        heading: 'Over-Relaxation & Horizon Precision',
        body: 'Stepping by the signed distance bound guarantees zero surface tunneling while converging in under 64 iterations per primary ray.',
        keyTakeaway: 'Bounding ray steps by Lipschitz factor prevents grazing-angle artifacts.',
      },
      {
        heading: 'Multi-Return Point Cloud Extraction',
        body: 'Simulated airborne LiDAR sweeps sample terrain elevation along polar scan angles to reconstruct digital elevation models (DEMs).',
        keyTakeaway: 'Higher ray step budgets resolve narrow ridge crests and cliff overhangs.',
      },
    ],
    infographicNodes: [
      { label: 'Traversal', value: 'SDF', unit: 'Sphere Trace', detail: 'Zero-mesh implicit surface' },
      { label: 'Scan Swath', value: '120°', unit: 'FOV', detail: 'Airborne LiDAR sweep arc' },
      { label: 'Vertical Datum', value: 'WGS-84', unit: 'Geoid', detail: 'Elevation contour reference' },
      { label: 'Shader Target', value: 'GLSL 4.6', unit: 'Compute', detail: 'Parallel fragment dispatch' },
    ],
    parameters: [
      { key: 'raySteps', label: 'Max Ray-March Steps', unit: 'steps', min: 16, max: 128, step: 8, defaultValue: 64 },
      { key: 'terrainScale', label: 'Frequency Scale', unit: 'x', min: 0.6, max: 2.8, step: 0.1, defaultValue: 1.4 },
      { key: 'elevationGain', label: 'Relief Amplitude', unit: 'x', min: 0.8, max: 4.0, step: 0.2, defaultValue: 2.2 },
    ],
  },
];
