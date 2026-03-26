import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class Cassini {
  constructor(scene, parentPlanet, moons = []) {
    this.scene = scene;
    this.parentPlanet = parentPlanet;
    this.moons = moons;

    // --- ADD THIS TEST LINE ---
    console.log("Cassini's Target List:", this.moons);

    this.targetName = "Cassini";
    this.isPlanet = true;
    this.tetherDistance = 2500; // Even bigger for Saturn's massive scale

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.tiltPivot = new THREE.Group();
    this.pivot.add(this.tiltPivot);

    this.mesh = new THREE.Group();
    this.tiltPivot.add(this.mesh);

    this.buildProbe();
  }

  buildProbe() {
    const loader = new GLTFLoader();

    // The Aiming Wrapper (Keeps instruments pointed at Saturn)
    this.aimWrapper = new THREE.Group();
    this.mesh.add(this.aimWrapper);
    this.aimWrapper.rotation.x = -Math.PI / 2;

    loader.load(
      "assets/models/cassini_huygens.glb",
      (gltf) => {
        this.model = gltf.scene;
        this.model.scale.set(0.005, 0.005, 0.005); // Same starting scale as Juno
        this.aimWrapper.add(this.model);
      },
      undefined,
      (error) => console.error("Error loading Cassini:", error),
    );
  }

  update(currentSimDays) {
    if (!this.parentPlanet) return;

    // 1. ORBITAL TIMING
    const orbitPeriod = 20;
    const currentOrbit = Math.floor(currentSimDays / orbitPeriod);
    const angle = -(currentSimDays / orbitPeriod) * (Math.PI * 2);

    // 2. THE GRAND TOUR ITINERARY (Using the exact moon distances we built)
    // Alternates between a close moon and a 900km deep-space Titan flyby!
    const moonDistances = [190, 900, 240, 900, 310, 900];
    const currentTargetDistance =
      moonDistances[currentOrbit % moonDistances.length];

    // 3. THE SAFE TARGETING COMPUTER
    const skimDistance = 150; // Always skim Saturn safely

    // Calculate the stretch using our guaranteed numbers
    const depthRadius = (currentTargetDistance + skimDistance) / 2;
    const offset = skimDistance - depthRadius;

    // 4. APPLY POSITIONS
    this.mesh.position.x = 0;
    this.mesh.position.y = Math.sin(angle) * 180; // polarRadius
    this.mesh.position.z = Math.cos(angle) * depthRadius + offset;

    // THE STALKER LOCK
    const saturnPos = new THREE.Vector3();
    this.parentPlanet.mesh.getWorldPosition(saturnPos);
    this.pivot.position.copy(saturnPos);

    // THE GENTLE PETAL SWEEP (No more centrifuge!)
    this.pivot.rotation.y = currentSimDays * 0.05;

    // ANTI-GIMBAL FLIP
    this.mesh.up.set(1, 0, 0);
    this.mesh.lookAt(saturnPos);

    // Slow spin for stability
    if (this.model) {
      this.model.rotation.y += 0.01;
    }
  }
}
