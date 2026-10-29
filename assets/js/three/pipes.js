/* ============================================================
   pipes.js — transparent transfer lines
   Each run is two coaxial tubes: a glass shell and an inner core
   carrying pulses of light. The pulses always travel source →
   chamber → chamber → outlet, so the direction of treatment is
   legible at a glance.
   ============================================================ */

import { flowVertex, flowFragment } from './shaders.js';

export function buildPipes(THREE, scene, palette, quality, layout) {
  const group = new THREE.Group();
  scene.add(group);

  const routes = planRoutes(THREE, layout);
  const flows = [];
  const shellMaterials = [];

  routes.forEach((route, index) => {
    const curve = new THREE.CatmullRomCurve3(route.points, false, 'catmullrom', 0.4);

    /* ---- glass shell ---- */
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.glass),
      metalness: 0,
      roughness: 0.10,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: quality.transmission ? 0.20 : 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.4
    });
    shellMaterials.push(shellMat);

    const shell = new THREE.Mesh(
      new THREE.TubeGeometry(curve, quality.pipeSegments, route.radius, quality.pipeRadialSegments, false),
      shellMat
    );
    shell.renderOrder = 4;
    group.add(shell);

    /* ---- inner flow ---- */
    const flowMat = new THREE.ShaderMaterial({
      vertexShader: flowVertex,
      fragmentShader: flowFragment,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: route.speed },
        uSegments: { value: route.pulses },
        uColor: { value: new THREE.Color(palette.lamp) },
        uOpacity: { value: 0.9 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const core = new THREE.Mesh(
      new THREE.TubeGeometry(curve, quality.pipeSegments, route.radius * 0.62, Math.max(6, quality.pipeRadialSegments - 2), false),
      flowMat
    );
    core.renderOrder = 5;
    group.add(core);

    flows.push({ material: flowMat, baseOpacity: 0.9, offset: index * 0.6 });

    /* ---- couplings where the run meets a vessel ---- */
    const couplingMat = new THREE.MeshStandardMaterial({
      color: 0x9fb8c9,
      metalness: 0.85,
      roughness: 0.34
    });

    [0, 1].forEach((t) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(route.radius * 1.25, route.radius * 0.28, 6, 18),
        couplingMat
      );
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      ring.position.copy(point);
      ring.lookAt(point.clone().add(tangent));
      group.add(ring);
    });
  });

  return {
    group,

    update(time) {
      flows.forEach((flow) => {
        flow.material.uniforms.uTime.value = time + flow.offset;
      });
    },

    applyPalette(palette) {
      flows.forEach((flow) => flow.material.uniforms.uColor.value.set(palette.lamp));
      shellMaterials.forEach((m) => m.color.set(palette.glass));
    },

    setFocus(stage) {
      flows.forEach((flow, index) => {
        const focused = (stage === 0 && index === 0)
          || (stage >= 1 && stage <= 5 && index === Math.min(stage, flows.length - 1))
          || (stage === 6 && index === flows.length - 1);
        flow.material.uniforms.uOpacity.value = focused ? 1.35 : 0.34;
      });
    },

    // PART 6: each lab stage follows the next visible transfer run.
    setLaboratoryFocus(stage) {
      const activeRoute = [0, 0, 1, 1, 2, 3][stage] ?? -1;
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = index === activeRoute ? 1.45 : 0.22;
      });
    },

    // PART 7: route the quality sample through the next measurement point.
    setQualityFocus(stage) {
      const activeRoute = [0, 0, 1, 1, 2, 2, 3][stage] ?? -1;
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = index === activeRoute ? 1.2 : 0.25;
      });
    },

    // PART 8: the outlet route reads as the controlled filling line.
    setHandlingFocus(stage) {
      const activeRoute = stage == null ? -1 : stage === 0 ? 2 : 3;
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = index === activeRoute ? 1.15 : 0.20;
      });
    },

    // PART 9: storage and materials remain on the clean outlet path.
    setStorageFocus(stage) {
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = index === 3 ? 0.95 : 0.16;
      });
    },

    setMaterialsFocus(stage) {
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = index === 3 ? 0.85 : 0.14;
      });
    },

    // PART 11: retain the outlet cue without returning to laboratory intensity.
    setHabitsFocus(stage) {
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = index === 3 ? 0.52 : 0.10;
      });
    },

    // PART 12: keep only a quiet suggestion of the outlet route.
    setFinaleFocus(progress) {
      const amount = progress == null ? 0 : Math.max(0, Math.min(progress, 1));
      flows.forEach((flow, index) => {
        flow.material.uniforms.uOpacity.value = (index === 3 ? 0.30 : 0.06) * (1 - amount * 0.35);
      });
    },

    setEnvMap(envMap) {
      shellMaterials.forEach((m) => { m.envMap = envMap; m.needsUpdate = true; });
    },

    dispose() {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      scene.remove(group);
    }
  };
}

/* ------------------------------------------------------------
   Route planning
   Intake from off-stage left, then chamber to chamber, then an
   outlet that returns to the tank surface.
   ------------------------------------------------------------ */
function planRoutes(THREE, layout) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const base = -3.4;
  const routes = [];

  const top = (c) => base + c.height * 0.72;

  // intake
  const first = layout[0];
  routes.push({
    radius: 0.30,
    speed: 0.34,
    pulses: 5,
    points: [
      V(first.x - 16, top(first) + 3.4, first.z - 2),
      V(first.x - 9, top(first) + 2.2, first.z - 1),
      V(first.x - 4.5, top(first) + 0.9, first.z),
      V(first.x - first.radius - 0.2, top(first), first.z)
    ]
  });

  // chamber to chamber
  for (let i = 0; i < layout.length - 1; i += 1) {
    const a = layout[i];
    const b = layout[i + 1];
    const midY = Math.max(top(a), top(b)) + 1.5;

    routes.push({
      radius: 0.26,
      speed: 0.30,
      pulses: 4,
      points: [
        V(a.x + a.radius + 0.1, top(a), a.z),
        V(a.x + a.radius + 1.6, top(a) + 0.7, a.z + 0.4),
        V((a.x + b.x) / 2, midY, (a.z + b.z) / 2 + 0.6),
        V(b.x - b.radius - 1.6, top(b) + 0.7, b.z + 0.4),
        V(b.x - b.radius - 0.1, top(b), b.z)
      ]
    });
  }

  // outlet, returning treated water to the surface
  const last = layout[layout.length - 1];
  routes.push({
    radius: 0.24,
    speed: 0.42,
    pulses: 6,
    points: [
      V(last.x + last.radius + 0.1, top(last), last.z),
      V(last.x + 3.6, top(last) - 0.6, last.z + 1.6),
      V(last.x + 5.2, base + 2.6, last.z + 4.2),
      V(last.x + 5.6, base + 0.5, last.z + 6.0)
    ]
  });

  return routes;
}
