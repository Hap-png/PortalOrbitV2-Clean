import * as THREE from "three";

// --- REAL-WORLD ASTRONOMICAL DATA (In Days) ---
const REAL_ORBIT_DAYS = {
  Saturn: 10759.22,
  Uranus: 30688.5,
};

const REAL_ROTATION_DAYS = {
  Saturn: 0.45,
  Uranus: -0.72, // Retrograde!
};

export class RingedPlanet {
  constructor(
    name,
    radius,
    texturePath,
    ringTexturePath,
    innerRingRadius,
    outerRingRadius,
    orbitRadius,
    fallbackOrbitSpeed,
    fallbackRotationSpeed,
  ) {
    this.name = name;
    // Inside your RingedPlanet constructor:
    this.targetName = name;
    // You can pass tetherDistance as a parameter, or calculate it based on the rings
    this.tetherDistance = 400;

    this.orbitPeriod = REAL_ORBIT_DAYS[name] || 365 / fallbackOrbitSpeed;
    this.rotationPeriod = REAL_ROTATION_DAYS[name] || 1 / fallbackRotationSpeed;

    // 1. The Pivot
    this.pivot = new THREE.Group();

    // 2. The Orbit Group (Translates but doesn't spin - safe for tethering!)
    this.orbitGroup = new THREE.Group();
    this.orbitGroup.position.x = orbitRadius;
    this.pivot.add(this.orbitGroup);

    // 3. The Tilt Container (Saturn is tilted about 26.7 degrees)
    this.tiltContainer = new THREE.Group();
    this.tiltContainer.rotation.z = THREE.MathUtils.degToRad(35);
    this.orbitGroup.add(this.tiltContainer);

    // 4. The Planet Sphere
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1,
    });

    if (texturePath) {
      material.map = new THREE.TextureLoader().load(texturePath);
    } else {
      material.color.setHex(Math.random() * 0xffffff);
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true; // <--- ADD THIS
    this.mesh.receiveShadow = true; // <--- ADD THIS
    this.tiltContainer.add(this.mesh);

    // 5. The Rings! (The V1 Barcode Method)
    if (ringTexturePath) {
      // 1. The Geometry (128 slices around for perfect roundness, 64 steps outward)
      const ringGeo = new THREE.RingGeometry(
        innerRingRadius,
        outerRingRadius,
        128,
        64,
      );

      // --- THE TRUE RADIAL UV FIX ---
      // Unrolls the barcode in a perfect circle from the inside out
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const radius = Math.sqrt(x * x + y * y);
        const u =
          (radius - innerRingRadius) / (outerRingRadius - innerRingRadius);
        uv.setXY(i, u, 0.5);
      }

      // 2. Load the texture AND clamp the edges to kill the black seams!
      const ringTex = new THREE.TextureLoader().load(
        "assets/textures/saturn_rings.png",
      );
      ringTex.wrapS = THREE.ClampToEdgeWrapping;
      ringTex.wrapT = THREE.ClampToEdgeWrapping;

      // 3. The Material
      const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        color: 0xe2bf7d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: true, // <--- THIS FIXES THE X-RAY BUG!
      });

      this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMesh.rotation.x = Math.PI / 2;

      // --- SHADOWS DISABLED FOR BEAUTY ---
      // this.ringMesh.castShadow = true;
      // this.ringMesh.receiveShadow = true;

      this.tiltContainer.add(this.ringMesh);
    }
  }

  update(currentSimDays) {
    // Sweep the invisible pivot arm around the sun
    if (this.orbitPeriod > 0) {
      this.pivot.rotation.y =
        (currentSimDays / this.orbitPeriod) * (Math.PI * 2);
    }

    // Spin the planet mesh on its own axis (Day/Night)
    // The ring stays static around the planet, just like in real life!
    if (this.rotationPeriod !== 0) {
      this.mesh.rotation.y =
        (currentSimDays / this.rotationPeriod) * (Math.PI * 2);
    }
  }
}
