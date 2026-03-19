import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CustomStation {
    // Added startingAngle to the end of the parameters (default is 0)
    constructor(name, modelPath, parentPlanet, scaleFactor, orbitRadius, orbitSpeed = 0.001, spinSpeed = 0.005, startingAngle = 0) {
        this.name = name;
        this.targetName = name;
        
        this.orbitGroup = new THREE.Group();
        // Set the starting position here! (Math.PI is a half-circle)
        this.orbitGroup.rotation.y = startingAngle; 
        
        parentPlanet.orbitGroup.add(this.orbitGroup);

        // 2. Create the Invisible Anchor (Nav Computer Target)
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.mesh.position.set(orbitRadius, 0, 0);
        this.orbitGroup.add(this.mesh);

        // 3. Create the HUD Label
        this.uiLabel = document.createElement('div');
        this.uiLabel.style.position = 'absolute';
        this.uiLabel.style.fontFamily = 'monospace';
        this.uiLabel.style.fontWeight = 'bold';
        this.uiLabel.style.pointerEvents = 'none';
        this.uiLabel.style.textAlign = 'center';
        this.uiLabel.style.zIndex = '1';
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
        });
    }

    // Use deltaTime so it stops when the game is paused!
    update(currentSimDays) {
        // USE '=' NOT '+=' ! This locks it perfectly to the timeline.
        this.orbitGroup.rotation.y = currentSimDays * this.orbitSpeed;
        
        if (this.visibleModel) {
            this.visibleModel.rotation.y = currentSimDays * this.spinSpeed;
        }
    }
} // <--- This is the final closing brace for the whole Class!