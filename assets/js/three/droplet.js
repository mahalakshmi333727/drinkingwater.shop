/* ============================================================
   droplet.js — the single glowing drop
   It hangs at the outlet, swells, falls, and lands in the tank —
   which is what triggers the ripple in the water shader. One
   complete cycle every few seconds, so it always reads as the
   end of the process rather than decoration.
   ============================================================ */

import { dropletVertex, dropletFragment, glowVertex, glowFragment } from './shaders.js';

const HANG_TIME = 3.4;   // seconds gathering at the nozzle
const FALL_TIME = 1.05;  // seconds in the air
const REST_TIME = 1.6;   // seconds before the next drop forms

export function buildDroplet(THREE, scene, palette, anchor, waterY) {
  const group = new THREE.Group();
  group.position.copy(anchor);
  scene.add(group);

  /* ---- the drop itself ---- */
  const bodyMat = new THREE.ShaderMaterial({
    vertexShader: dropletVertex,
    fragmentShader: dropletFragment,
    uniforms: {
      uCore: { value: new THREE.Color(palette.dropCore) },
      uRim: { value: new THREE.Color(palette.dropRim) },
      uTime: { value: 0 },
      uOpacity: { value: 1 }
    },
    transparent: true,
    depthWrite: false
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), bodyMat);
  body.renderOrder = 7;
  group.add(body);

  /* ---- halo ---- */
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    uniforms: {
      uColor: { value: new THREE.Color(palette.dropRim) },
      uOpacity: { value: 0.55 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), glowMat);
  glow.renderOrder = 7;
  group.add(glow);

  /* ---- a small light so the drop affects its surroundings ---- */
  const light = new THREE.PointLight(palette.dropRim, 2.4, 9, 2);
  group.add(light);

  const fallDistance = anchor.y - waterY;
  const cycle = HANG_TIME + FALL_TIME + REST_TIME;

  let lastCycleIndex = -1;
  let finaleProgress = null;
  let finaleImpacted = false;

  return {
    group,

    /**
     * @param {number} time     elapsed seconds
     * @param {THREE.Camera} camera  so the halo can face it
     * @param {function} onImpact    called once per landing, with (x, z)
     * @param {{x:number,z:number}} [drift]  optional small lateral offset
     *   from the anchor (Part 4's scroll journey uses this so the drop
     *   drifts forward as the journey nears its final chapter). Omit it
     *   and the drop hangs exactly at its anchor, as before.
     */
    update(time, camera, onImpact, drift) {
      bodyMat.uniforms.uTime.value = time;
      glow.quaternion.copy(camera.quaternion);

      if (finaleProgress != null) {
        const eased = finaleProgress * finaleProgress * (3 - 2 * finaleProgress);
        const startX = anchor.x - 3.8;
        const startY = anchor.y + 2.2;
        const startZ = anchor.z - 2.4;
        group.position.x = startX + (anchor.x - startX) * eased;
        group.position.y = startY + (waterY - startY) * eased;
        group.position.z = startZ + (anchor.z - startZ) * eased;

        const scale = 0.82 + finaleProgress * 0.28;
        body.scale.set(scale, scale * (1 + finaleProgress * 0.18), scale);
        glowMat.uniforms.uOpacity.value = 0.24 + finaleProgress * 0.28;
        light.intensity = 0.9 + finaleProgress * 1.2;

        if (finaleProgress >= 0.92 && !finaleImpacted) {
          finaleImpacted = true;
          onImpact?.(group.position.x, group.position.z);
        }
        return;
      }

      group.position.x = anchor.x + (drift ? drift.x : 0);
      group.position.z = anchor.z + (drift ? drift.z : 0);

      const cycleIndex = Math.floor(time / cycle);
      const t = time % cycle;

      if (t < HANG_TIME) {
        // gathering: swell and bob at the nozzle
        const k = t / HANG_TIME;
        const swell = 0.55 + k * 0.6;
        body.scale.set(swell, swell * (0.92 + k * 0.16), swell);
        group.position.y = anchor.y + Math.sin(time * 1.3) * 0.06;
        glowMat.uniforms.uOpacity.value = 0.30 + k * 0.35;
        light.intensity = 1.4 + k * 1.6;

      } else if (t < HANG_TIME + FALL_TIME) {
        // falling: accelerate, stretch along the axis of travel
        const k = (t - HANG_TIME) / FALL_TIME;
        const eased = k * k;
        group.position.y = anchor.y - fallDistance * eased;

        const stretch = 1 + k * 0.85;
        body.scale.set(1.15 / stretch, 1.15 * stretch, 1.15 / stretch);
        glowMat.uniforms.uOpacity.value = 0.65;
        light.intensity = 3.0;

        if (cycleIndex !== lastCycleIndex && k > 0.94) {
          lastCycleIndex = cycleIndex;
          onImpact?.(group.position.x, group.position.z);
        }

      } else {
        // landed: the drop is gone, only the afterglow remains
        const k = (t - HANG_TIME - FALL_TIME) / REST_TIME;
        group.position.y = waterY;
        const flat = 1.2 + k * 1.4;
        body.scale.set(flat, Math.max(0.02, 0.5 - k * 0.5), flat);
        glowMat.uniforms.uOpacity.value = Math.max(0, 0.6 * (1 - k));
        light.intensity = Math.max(0, 2.6 * (1 - k));
      }
    },

    applyPalette(palette) {
      bodyMat.uniforms.uCore.value.set(palette.dropCore);
      bodyMat.uniforms.uRim.value.set(palette.dropRim);
      glowMat.uniforms.uColor.value.set(palette.dropRim);
      light.color.set(palette.dropRim);
    },

    // PART 12: switch the existing drop into a scroll-controlled final passage.
    setFinaleProgress(progress) {
      if (progress == null) {
        finaleProgress = null;
        finaleImpacted = false;
        return;
      }
      const next = Math.min(Math.max(progress, 0), 1);
      if (finaleProgress == null || next < finaleProgress) finaleImpacted = false;
      finaleProgress = next;
    },

    dispose() {
      body.geometry.dispose();
      bodyMat.dispose();
      glow.geometry.dispose();
      glowMat.dispose();
      scene.remove(group);
    }
  };
}
