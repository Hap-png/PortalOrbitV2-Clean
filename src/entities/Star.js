import * as THREE from 'three';

export class Star {
    constructor(name, radius, texturePath, rotationSpeed) {
        this.name = name;
        this.targetName = name; // <--- THE FIX: This is what the Nav Computer reads!
        this.rotationSpeed = rotationSpeed;

        // The geometry for the giant sphere
        const geometry = new THREE.SphereGeometry(radius, 64, 64);

        // MeshBasicMaterial is the secret: it ignores shadows and always glows!
        const material = new THREE.MeshBasicMaterial();

        if (texturePath) {
            const textureLoader = new THREE.TextureLoader();
            material.map = textureLoader.load(texturePath);
        } else {
            material.color.setHex(0xffaa00); // Fallback orange color
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = name; // <--- ADD THIS LINE!
        // THE FIX: Point the orbitGroup directly to the mesh so the HUD knows where to draw the text!
        this.orbitGroup = this.mesh;
    }

    // Stars don't orbit, but they do spin!
    update(currentSimDays) {
        // The Sun rotates roughly once every 25 days
        this.mesh.rotation.y = (currentSimDays / 25.0) * (Math.PI * 2);
    }
}