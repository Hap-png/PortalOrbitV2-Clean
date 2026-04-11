import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class Juno {
  constructor(scene, parentPlanet) {
    this.scene = scene;
    this.parentPlanet = parentPlanet;

    // IDENTIFIERS FOR THE SHIP'S COMPUTER
    this.targetName = "Juno";
    this.isPlanet = true;

    // MASSIVE grab radius so she can't outrun the cable during Time Surf!
    this.tetherDistance = 200;

    // THE PIVOT (Added to the main scene so she doesn't spawn in the Sun!)
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    // KEEP IT FLAT
    this.tiltPivot = new THREE.Group();
    this.tiltPivot.rotation.set(0, 0, 0);
    this.pivot.add(this.tiltPivot);

    // THE MESH (What the HUD tracks)
    this.mesh = new THREE.Group();
    this.tiltPivot.add(this.mesh);

    // --- BUILD THE PROBE ---
    this.buildProbe();
  }

  buildProbe() {
    const loader = new GLTFLoader();

    // --- THE SAFE AIMING WRAPPER ---
    this.aimWrapper = new THREE.Group();
    this.mesh.add(this.aimWrapper);

    // Tweak this dial! This tilts the whole spinning assembly.
    // Math.PI / 2 is 90 degrees. Math.PI is 180 degrees.
    this.aimWrapper.rotation.x = -Math.PI / 2;

    loader.load(
      "assets/models/juno.glb",
      (gltf) => {
        this.model = gltf.scene;
        this.model.scale.set(0.1, 0.1, 0.1); // <--- Tweak these three numbers

        // Add the model INSIDE the wrapper instead of the mesh
        this.aimWrapper.add(this.model);
      },
      undefined,
      (error) => {
        console.error("Error loading the Juno model:", error);
      },
    );
  }

  update(currentSimDays) {
    if (!this.parentPlanet) return;

    // 1. ORBITAL TIMING
    const orbitPeriod = 14;
    const angle = -(currentSimDays / orbitPeriod) * (Math.PI * 2);

    // 2. THE "Z-AXIS" DEEP SPACE EGG
    const depthRadius = 500;
    const polarRadius = 180;
    const offset = -350;

    // X is 0 so it stays in the center of your screen
    this.mesh.position.x = 0;
    this.mesh.position.y = Math.sin(angle) * polarRadius;
    this.mesh.position.z = Math.cos(angle) * depthRadius + offset;

    // 3. THE "STALKER" METHOD
    const jupiterPos = new THREE.Vector3();
    this.parentPlanet.mesh.getWorldPosition(jupiterPos);

    // Teleport the invisible anchor to Jupiter's exact location every frame
    this.pivot.position.copy(jupiterPos);

    // Face Jupiter without flipping at the poles
    this.mesh.up.set(1, 0, 0);
    this.mesh.lookAt(jupiterPos);

    // Spin the solar panels
    // Spin the solar panels based on absolute simulation time
    if (this.model) {
      // Crank this way up!
      // Try 100, 200, or even 500 until it looks right at normal 1x sim speed.
      const spinSpeed = 150;

      this.model.rotation.y = currentSimDays * spinSpeed;
    }
  }
}
