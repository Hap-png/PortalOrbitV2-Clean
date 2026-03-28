import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class CustomStation {
  // We changed rotationSpeed back to spinSpeed right here:
  constructor(name, modelPath, parentPlanet, scaleFactor, orbitRadius, orbitSpeed, spinSpeed, startingAngle = 0, tetherDistance = 150) {
    this.name = name;
    
    // The new automatic tags
    this.targetName = name;
    this.tetherDistance = tetherDistance;

    this.orbitGroup = new THREE.Group();
    // Set the starting position here! (Math.PI is a half-circle)
    this.orbitGroup.rotation.y = startingAngle;

    parentPlanet.orbitGroup.add(this.orbitGroup);

    // 2. Create the Invisible Anchor (Nav Computer Target)
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.mesh.position.set(orbitRadius, 0, 0);
    this.orbitGroup.add(this.mesh);

    // 3. Create the HUD Label
    this.uiLabel = document.createElement("div");
    this.uiLabel.style.position = "absolute";
    this.uiLabel.style.fontFamily = "monospace";
    this.uiLabel.style.fontWeight = "bold";
    this.uiLabel.style.pointerEvents = "none";
    this.uiLabel.style.textAlign = "center";
    this.uiLabel.style.zIndex = "1";
    document.getElementById("nav-computer-layer").appendChild(this.uiLabel);

    this.orbitSpeed = orbitSpeed;
    this.spinSpeed = spinSpeed;
    this.visibleModel = null;

    // 4. Load the Blender Model
    const loader = new GLTFLoader();
    loader.load(modelPath, (gltf) => {
      this.visibleModel = gltf.scene;
      this.visibleModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.visibleModel.position.set(orbitRadius, 0, 0);
      this.orbitGroup.add(this.visibleModel);

      // --- ADD THIS LINE SO YOUR METALLIC PAINT JOB APPLIES! ---
      if (this.onLoad) this.onLoad();
    });
  }

  // Use deltaTime so it stops when the game is paused!
  update(currentSimDays) {
    this.orbitGroup.rotation.y = currentSimDays * this.orbitSpeed;

    if (this.visibleModel) {
      // Check how this specific station likes to spin!
      if (this.spinAxis === "x") {
        this.visibleModel.rotation.x = currentSimDays * this.spinSpeed;
        this.visibleModel.rotation.y = Math.PI / 2; // Lock the steering wheel
      } else if (this.spinAxis === "z") {
        this.visibleModel.rotation.z = currentSimDays * this.spinSpeed;
      } else {
        // Default: Spin like a normal top on the Y-axis
        this.visibleModel.rotation.y = currentSimDays * this.spinSpeed;
      }
    }
  }
} // <--- This is the final closing brace for the whole Class!
