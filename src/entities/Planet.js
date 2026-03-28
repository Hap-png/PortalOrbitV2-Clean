import * as THREE from "three";

// --- REAL-WORLD ASTRONOMICAL DATA (In Days) ---
const REAL_ORBIT_DAYS = {
  Mercury: 88.0,
  Venus: 224.7,
  Earth: 365.256,
  Mars: 686.98,
  Jupiter: 4332.59,
  Saturn: 10759.22,
  Uranus: 30688.5,
  Neptune: 60182.0,
  Pluto: 90560.0,
  Moon: 27.322,
  Titan: 15.945,
  Io: 1.769,
  Europa: 3.551,
  Ganymede: 7.155,
  Callisto: 16.689,
  // --- THE NEW SATURN MOONS ---
  Mimas: 0.942, // Zips around in under a day!
  Enceladus: 1.37, // Just over a day
  Tethys: 1.888, // Almost two days
};

const REAL_INCLINATION_DEGREES = {
  Mercury: 7.0,
  Venus: 3.4,
  Earth: 0.0,
  Mars: 1.8,
  Jupiter: 1.3,
  Saturn: 2.5,
  Uranus: 0.8,
  Neptune: 1.8,
  Pluto: 17.2,
  Moon: 5.1,
  Io: 0.04,
  Europa: 0.47,
  Ganymede: 0.2,
  Callisto: 0.2,
  Mimas: 1.5,
  Enceladus: 0.0,
  Tethys: 1.1,
  Titan: 0.3,
};

const REAL_ROTATION_DAYS = {
  Mercury: 58.6,
  Venus: -243.0, // Retrograde!
  Earth: 0.997,
  Mars: 1.026,
  Jupiter: 0.41, // Fastest spinning planet!
  Saturn: 0.45,
  Uranus: -0.72, // Retrograde!
  Neptune: 0.67,
  Pluto: 5.39, // Retrograde!
  Moon: 27.322,
};

export class Planet {
  constructor(
    name,
    radius,
    texturePath,
    orbitRadius,
    fallbackOrbitSpeed,
    fallbackRotationSpeed,
    startingAngle = 0,
    tetherDistance = 150, // <--- 1. Add your 150km minimum floor here!
  ) {
    this.name = name;
    this.startingAngle = startingAngle;

    // --- NEW: Bake the Target and Tether directly into the planet ---
    this.targetName = name;
    this.tetherDistance = tetherDistance;

    // --- Grab the tilt and convert to radians ---
    this.inclinationRad =
      (REAL_INCLINATION_DEGREES[name] || 0) * (Math.PI / 180);

    this.orbitPeriod = REAL_ORBIT_DAYS[name] || 365 / fallbackOrbitSpeed;
    this.rotationPeriod = REAL_ROTATION_DAYS[name] || 1 / fallbackRotationSpeed;

    // 1. The Pivot: This sits at the center of the orbit
    this.pivot = new THREE.Group();

    // 2. The Orbit Group! This translates through space but does NOT spin.
    // We will attach the ship and moon to this so they aren't dragged by the day/night cycle.
    this.orbitGroup = new THREE.Group();
    this.orbitGroup.position.x = orbitRadius;
    this.pivot.add(this.orbitGroup);

    // 3. The Sphere: High-resolution geometry
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1,
    });

    if (texturePath) {
      const textureLoader = new THREE.TextureLoader();
      material.map = textureLoader.load(texturePath);

      // --- NEW: EARTH NIGHT LIGHTS ---
      if (name === "Earth") {
        material.emissiveMap = textureLoader.load(
          "assets/textures/earth_night.jpg",
        );
        // Sets the glow to a warm, realistic city-light color
        material.emissive = new THREE.Color(0xffffee);
        // Dial this up or down (e.g., 0.2 to 1.0) to change the brightness!
        material.emissiveIntensity = 0.2;
      }
    } else {
      material.color.setHex(Math.random() * 0xffffff);
    }

    // 4. The Mesh: Attach the visual planet to the NON-SPINNING Orbit Group
    this.mesh = new THREE.Mesh(geometry, material);
    this.orbitGroup.add(this.mesh);
  }

  update(currentSimDays) {
    if (this.orbitPeriod > 0) {
      // 1. Move around the circle (Your existing code)
      this.pivot.rotation.y =
        (currentSimDays / this.orbitPeriod) * (Math.PI * 2) +
        this.startingAngle;

      // 2. THE RESTORATION: Physically bob the planet up and down along the Y-axis!
      // This uses the orbit radius (position.x) and the current angle to calculate true height.
      this.orbitGroup.position.y =
        this.orbitGroup.position.x *
        Math.sin(this.pivot.rotation.y) *
        Math.tan(this.inclinationRad);
    }

    // 2. Spin the planet mesh on its own axis (Day/Night)
    if (this.rotationPeriod !== 0) {
      const rotationAngle =
        (currentSimDays / this.rotationPeriod) * (Math.PI * 2);

      if (this.name === "Earth") {
        // 1. J2000 epoch starts exactly at NOON UTC. Adding 0.5 shifts our math to start at midnight.
        const daysSinceMidnight = currentSimDays + 0.5;

        // 2. Extract just the fractional part of the current day (e.g., 0.5 = 12:00 PM)
        const timeOfDayFraction = daysSinceMidnight % 1;

        // 3. Convert that time fraction into a full 360-degree (2 PI) rotation
        const solarRotation = timeOfDayFraction * (Math.PI * 2);

        // 4. THE MASTER CALIBRATION OFFSET
        // Because the Earth's pivot is rotated by 1.2 radians in main.js,
        // the angle of the sun hitting the texture is physically shifted.
        // Adjust this single decimal to perfectly align the sunrise.
        const calibrationOffset = 0.0;

        this.mesh.rotation.y = solarRotation + calibrationOffset;
      } else if (
        [
          "Moon",
          "Titan",
          "Mimas",
          "Enceladus",
          "Tethys",
          "Io",
          "Europa",
          "Ganymede",
          "Callisto",
        ].includes(this.name)
      ) {
        // Perfect Tidal Lock: The pivot arm already handles the orbit rotation natively!
        // We just need a static offset number to aim the correct texture face at the planet.
        // Try Math.PI, or if it's off by 90 degrees, try Math.PI / 2 or -Math.PI / 2
        this.mesh.rotation.y = Math.PI;
      } else {
        // Normal rotation for all other planets
        this.mesh.rotation.y = rotationAngle;
      }
    }
  }
}
