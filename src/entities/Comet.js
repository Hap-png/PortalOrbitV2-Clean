import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export class Comet {
    constructor(name, semiMajor, semiMinor, speed, tilt = 0) {
        this.name = name;
        this.targetName = name;
        this.speed = speed;
        this.semiMajor = semiMajor;
        this.semiMinor = semiMinor;
        this.tilt = tilt; 

        this.mesh = new THREE.Group();

        const loader = new GLTFLoader();

        // Load your lumpy Blender masterpiece!
        loader.load('assets/models/comet_new.glb?v=' + Math.random(), (gltf) => {
            const model = gltf.scene;
            
            // 1. Loop through every part of the model to change its "vibe"
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material.transparent = true;
                    child.material.opacity = 1; // <--- Lower this for more "ghostly"
                    child.material.blending = THREE.AdditiveBlending; // <--- This creates the "glow"
                    child.material.depthWrite = false; // <--- This blurs the overlapping spikes together
                    child.material.side = THREE.DoubleSide;
                }
            });

            model.scale.set(0.5, 0.5, 1.5); 
            this.mesh.add(model);
            console.log("Comet Ghostified!");
        });

        // (Keep your HUD Label and Orbit Logic below this...)
    
    // 4. The HUD Label
    this.uiLabel = document.createElement("div");
    this.uiLabel.style.position = "absolute";
    this.uiLabel.style.fontFamily = "monospace";
    this.uiLabel.style.fontWeight = "bold";
    this.uiLabel.style.color = "#00ffff";
    this.uiLabel.style.pointerEvents = "none";
    this.uiLabel.style.zIndex = "1";
    document.getElementById("nav-computer-layer").appendChild(this.uiLabel);

    // 5. Docking Safety
    this.isPlanet = true;
    this.tetherDistance = 15;
  }

  update(currentSimDays) {
    const t = currentSimDays * this.speed;

    // The Elliptical Math
    const x = Math.cos(t) * this.semiMajor;
    const z = Math.sin(t) * this.semiMinor;
    const y = Math.sin(t) * this.tilt;

    // Move the comet
    this.mesh.position.set(x, y, z);

    // THE MAGIC TRICK (Fixed): Look away from the Sun!
    // By aiming at double its current coordinates, the comet stares out into 
    // deep space, ensuring the tail is always blown perfectly away from the sun.
    this.mesh.lookAt(x * 2, y * 2, z * 2);
  }
}
