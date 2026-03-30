import * as THREE from "three";

export class Star {
  constructor(name, radius, texturePath, rotationPeriod) {
    this.name = name;
    this.targetName = name;

    // Let's call it rotationPeriod (in days) so it matches your Planets!
    this.rotationPeriod = rotationPeriod;

    // THE FIX 1: Dropped geometry segments from 64 to 32 for a massive GPU save
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    // Perfectly optimized material choice!
    const material = new THREE.MeshBasicMaterial();

    if (texturePath) {
      const textureLoader = new THREE.TextureLoader();
      material.map = textureLoader.load(texturePath);
    } else {
      material.color.setHex(0xffaa00);
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name;
    this.orbitGroup = this.mesh;
  }

  update(currentSimDays) {
    // THE FIX 2: Use the rotationPeriod passed from main.js instead of hardcoding 25!
    if (this.rotationPeriod > 0) {
      this.mesh.rotation.y =
        (currentSimDays / this.rotationPeriod) * (Math.PI * 2);
    }
  }
}
