import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SpaceStation {
    constructor(parentPlanet) {
        // 1. Create a pivot point at the center of Earth
        this.pivot = new THREE.Group();
        
        if (parentPlanet.orbitGroup) {
            parentPlanet.orbitGroup.add(this.pivot); 
        } else {
            parentPlanet.mesh.add(this.pivot);
        }

        // 2. NEW: The Tilt Container!
        // We push this out into orbit, and tilt it permanently 65 degrees.
        this.tiltContainer = new THREE.Group();
        this.tiltContainer.position.set(19, 0, 0); // Distance from Earth
        
        // Tilt the top of the station 65 degrees toward Earth. 
        // (Note: If it tilts sideways instead of toward Earth, change this '.z' to an '.x' or '.y')
        this.tiltContainer.rotation.z = THREE.MathUtils.degToRad(0); 
        
        this.pivot.add(this.tiltContainer);

        // 3. The Spinning Mesh
        // This goes INSIDE the tilted container, so it spins at that perfect 65-degree angle.
        this.mesh = new THREE.Group(); 
        this.tiltContainer.add(this.mesh);

        // 4. Define Real-World Time Periods (In Days)
        this.orbitPeriod = 0.06; // Orbit Earth every ~1.5 hours
        
        // SMALLER number = FASTER spin. 
        // 0.02 means it takes 0.02 simulated days to complete one rotation.
        this.spinPeriod = 0.005;  

        // 5. Load the 3D model
        const loader = new GLTFLoader();
        loader.load('assets/models/spacestation.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.5, 0.5, 0.5); 
            this.mesh.add(model);
        }, undefined, (error) => {
            console.error("Error loading the space station:", error);
        });
    }

    // We use 'deltaTime' here to match the rawDelta being sent from main.js
  update(currentSimDays) {
      // USE '=' NOT '+=' !
      this.pivot.rotation.y = (currentSimDays / this.orbitPeriod) * (Math.PI * 2);
      this.mesh.rotation.y = (currentSimDays / this.spinPeriod) * (Math.PI * 2);
  }
}