/* ============================================================
   chambers.js — glass purification vessels + lab framework
   Three tanks in a row, each holding a water column whose level
   rises and settles, plus a slowly turning filter media bed. The
   movement is what tells you the facility is running.
   ============================================================ */

/** Shared layout — pipes and lamps line up against these. */
export const CHAMBER_LAYOUT = [
  { x: -10.5, z: -5.0, radius: 2.5, height: 7.2 },
  { x:   0.0, z: -9.0, radius: 3.0, height: 8.6 },
  { x:  10.0, z: -4.0, radius: 2.3, height: 6.6 }
];

export function buildChambers(THREE, scene, palette, quality) {
  const group = new THREE.Group();
  scene.add(group);

  const used = CHAMBER_LAYOUT.slice(0, quality.chambers);
  const glassMaterials = [];
  const waterMaterials = [];
  const chambers = [];

  used.forEach((spec, index) => {
    const chamber = new THREE.Group();
    chamber.position.set(spec.x, -3.4, spec.z);

    /* ---- glass shell ---- */
    const glassMat = makeGlass(THREE, palette, quality);
    glassMaterials.push(glassMat);

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius, spec.radius, spec.height, 44, 1, true),
      glassMat
    );
    shell.position.y = spec.height / 2;
    shell.renderOrder = 4;
    chamber.add(shell);

    /* ---- steel collars top and bottom ---- */
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x9fb8c9,
      metalness: 0.85,
      roughness: 0.32,
      envMapIntensity: 1.1
    });

    [0.12, spec.height - 0.12].forEach((y) => {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius + 0.04, 0.12, 8, 40),
        collarMat
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = y;
      chamber.add(collar);
    });

    /* ---- the water column inside ---- */
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.shallowWater),
      transparent: true,
      opacity: 0.42,
      roughness: 0.12,
      metalness: 0.0,
      transmission: quality.transmission ? 0.55 : 0,
      thickness: 1.4,
      depthWrite: false
    });
    waterMaterials.push(waterMat);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius - 0.12, spec.radius - 0.12, 1, 36, 1, false),
      waterMat
    );
    column.renderOrder = 3;
    chamber.add(column);

    /* ---- filter media bed, turns slowly ---- */
    const mediaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.lamp),
      transparent: true,
      opacity: 0.30,
      roughness: 0.6,
      metalness: 0.1,
      depthWrite: false
    });

    const media = new THREE.Mesh(
      new THREE.TorusKnotGeometry(spec.radius * 0.42, spec.radius * 0.11, 64, 8, 2, 3),
      mediaMat
    );
    media.position.y = spec.height * 0.34;
    media.renderOrder = 3;
    chamber.add(media);

    /* ---- inlet stub so pipes have somewhere to land ---- */
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10),
      collarMat
    );
    stub.rotation.z = Math.PI / 2;
    stub.position.set(spec.radius, spec.height * 0.72, 0);
    chamber.add(stub);

    group.add(chamber);

    chambers.push({
      spec,
      group: chamber,
      column,
      media,
      mediaMat,
      phase: index * 1.9,
      baseLevel: spec.height * 0.62
    });
  });

  /* ---- transparent framework the tanks sit in ---- */
  const frame = buildFramework(THREE, palette, used);
  group.add(frame.group);

  return {
    group,
    chambers,
    layout: used,

    update(time) {
      chambers.forEach((c) => {
        // level breathes between 0.94 and 1.06 of its base — a tank filling
        const level = c.baseLevel * (1 + Math.sin(time * 0.32 + c.phase) * 0.06);
        c.column.scale.y = level;
        c.column.position.y = level / 2;

        c.media.rotation.y = time * 0.18 + c.phase;
        c.media.rotation.x = Math.sin(time * 0.22 + c.phase) * 0.18;
        c.media.position.y = c.spec.height * 0.34 + Math.sin(time * 0.5 + c.phase) * 0.12;
      });

      frame.update(time);
    },

    applyPalette(palette) {
      glassMaterials.forEach((m) => {
        m.color.set(palette.glass);
        m.attenuationColor?.set(palette.shallowWater);
      });
      waterMaterials.forEach((m) => m.color.set(palette.shallowWater));
      chambers.forEach((c) => {
        c.mediaMat.color.set(palette.lamp);
        c.mediaMat.emissive?.set(palette.lamp);
      });
      frame.applyPalette(palette);
    },

    setFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = ((stage === 1 || stage === 2) && index === 0)
          || ((stage === 3 || stage === 4) && index === 1)
          || (stage === 5 && index === 2);
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.8 : 0;
        chamber.mediaMat.opacity = focused ? 0.62 : 0.30;
        chamber.column.material.opacity = focused ? 0.58 : 0.42;
      });
    },

    // PART 6: map the six lab controls onto the three existing treatment chambers.
    setLaboratoryFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = stage != null && Math.floor(stage / 2) === index;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 1.0 : 0;
        chamber.mediaMat.opacity = focused ? 0.72 : 0.24;
        chamber.column.material.opacity = focused ? 0.62 : 0.34;
      });
    },

    // PART 7: move the sample emphasis through the existing testing vessels.
    setQualityFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = stage != null && Math.floor(stage / 3) === index;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.72 : 0;
        chamber.mediaMat.opacity = focused ? 0.58 : 0.22;
        chamber.column.material.opacity = focused ? 0.54 : 0.30;
      });
    },

    // PART 8: the last chamber becomes the clean filling-side vessel.
    setHandlingFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = stage != null && index === chambers.length - 1;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.62 : 0;
        chamber.mediaMat.opacity = focused ? 0.48 : 0.18;
        chamber.column.material.opacity = focused ? 0.48 : 0.26;
      });
    },

    // PART 9: the final vessel reads as a protected storage sample.
    setStorageFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = stage != null && index === chambers.length - 1;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.48 : 0;
        chamber.mediaMat.opacity = focused ? 0.42 : 0.16;
        chamber.column.material.opacity = focused ? 0.42 : 0.24;
      });
    },

    // PART 9: material study stays grounded in the same contact vessel.
    setMaterialsFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = stage != null && index === chambers.length - 1;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.36 : 0;
      });
    },

    // PART 11: keep the final contact vessel present but visually quiet.
    setHabitsFocus(stage) {
      chambers.forEach((chamber, index) => {
        const focused = stage != null && index === chambers.length - 1;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.20 : 0;
        chamber.mediaMat.opacity = focused ? 0.30 : 0.12;
        chamber.column.material.opacity = focused ? 0.34 : 0.20;
      });
    },

    // PART 12: let the facility recede behind the final drop.
    setFinaleFocus(progress) {
      const amount = progress == null ? 0 : Math.max(0, Math.min(progress, 1));
      chambers.forEach((chamber, index) => {
        const focused = index === chambers.length - 1;
        chamber.mediaMat.emissive?.set(focused ? palette.lamp : 0x000000);
        chamber.mediaMat.emissiveIntensity = focused ? 0.16 * (1 - amount * 0.45) : 0;
        chamber.mediaMat.opacity = (focused ? 0.24 : 0.10) * (1 - amount * 0.35);
        chamber.column.material.opacity = (focused ? 0.28 : 0.14) * (1 - amount * 0.35);
      });
    },

    setEnvMap(envMap) {
      glassMaterials.forEach((m) => { m.envMap = envMap; m.needsUpdate = true; });
      waterMaterials.forEach((m) => { m.envMap = envMap; m.needsUpdate = true; });
    },

    dispose() {
      disposeTree(group);
      scene.remove(group);
    }
  };
}

/* ------------------------------------------------------------ */

function makeGlass(THREE, palette, quality) {
  if (quality.transmission) {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.glass),
      metalness: 0,
      roughness: 0.04,
      transmission: 0.94,
      thickness: 1.1,
      ior: 1.42,
      attenuationColor: new THREE.Color(palette.shallowWater),
      attenuationDistance: 6,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.3
    });
  }

  // Fallback glass: reflective and fresnel-ish without the transmission pass.
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.glass),
    metalness: 0,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.6
  });
}

/* Thin rails and walkways — reads as a facility without adding weight. */
function buildFramework(THREE, palette, layout) {
  const group = new THREE.Group();

  const railMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.glass),
    metalness: 0.6,
    roughness: 0.45,
    transparent: true,
    opacity: 0.22
  });

  const minX = Math.min(...layout.map((c) => c.x)) - 5;
  const maxX = Math.max(...layout.map((c) => c.x)) + 5;
  const span = maxX - minX;

  // two horizontal rails behind the tanks
  [-2.0, 2.6].forEach((y) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.09, 0.09), railMat);
    rail.position.set((minX + maxX) / 2, y, -13.5);
    group.add(rail);
  });

  // uprights
  for (let x = minX; x <= maxX; x += span / 6) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 9.5, 0.09), railMat);
    post.position.set(x, 1.0, -13.5);
    group.add(post);
  }

  // a low deck the tanks stand on
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(span, 0.12, 14),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.glass),
      metalness: 0.4,
      roughness: 0.6,
      transparent: true,
      opacity: 0.10,
      depthWrite: false
    })
  );
  deck.position.set((minX + maxX) / 2, -3.55, -6);
  group.add(deck);

  return {
    group,
    update() { /* static by design — the stillness makes the water read */ },
    applyPalette(palette) {
      railMat.color.set(palette.glass);
      deck.material.color.set(palette.glass);
    }
  };
}

function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach((m) => m.dispose());
    }
  });
}
