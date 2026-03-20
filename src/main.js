import * as THREE from "three";
import { Planet } from "./entities/Planet.js";
import { SpaceStation } from "./entities/SpaceStation.js";
import { Star } from "./entities/Star.js";
import { PlayerShip } from "./entities/PlayerShip.js"; // <-- NEW IMPORT
import { TimeManager } from "./systems/TimeManager.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RingedPlanet } from "./entities/RingedPlanet.js";
import { CustomStation } from "./entities/CustomStation.js";
import { Comet } from "./entities/Comet.js";

let backgroundMusic;

// --- 1. SCENE SETUP ---
const scene = new THREE.Scene();

// Changed the near clipping plane from 0.1 to 0.001!
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.001,
  1000000,
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  logarithmicDepthBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- TURN ON SHADOWS ---
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Add this right after you create your camera and renderer!
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // This gives the camera that smooth, cinematic glide when you let go of the mouse
controls.dampingFactor = 0.05;
controls.minDistance = 0.1; // Prevents you from accidentally zooming inside the ship's hull
controls.maxDistance = 50; // Prevents you from zooming out past the planets

// We need a variable to track the ship's movement frame-by-frame
const previousShipPosition = new THREE.Vector3();
const previousShipQuaternion = new THREE.Quaternion(); // <-- ADD THIS NEW LINE

// --- 2. LIGHTING ---
// Crisp ice-blue for a high-tech "Vacuum of Space" feel
const ambientLight = new THREE.AmbientLight(0xddeeff, 0.3);
scene.add(ambientLight);

// (Only one sunLight allowed!)
const sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 0);
scene.add(sunLight);

// --- MAKE THE SUN CAST SHADOWS ---
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.001;

// THE FIX: Tell the shadow camera to see all the way to the outer planets!
sunLight.shadow.camera.near = 0.1;
sunLight.shadow.camera.far = 1000000;

// --- 3. THE SOLAR SYSTEM ---
const planets = [];
const timeManager = new TimeManager();

// --- THE ROTATABLE CUBE MAP SKYBOX ---
const textureLoader = new THREE.TextureLoader();
textureLoader.setPath("assets/textures/");

// 1. Paint the 6 inside walls of the box
const skyboxMaterials = [
  new THREE.MeshBasicMaterial({
    map: textureLoader.load("px.jpg"),
    side: THREE.BackSide,
  }), // Right
  new THREE.MeshBasicMaterial({
    map: textureLoader.load("nx.jpg"),
    side: THREE.BackSide,
  }), // Left
  new THREE.MeshBasicMaterial({
    map: textureLoader.load("py.jpg"),
    side: THREE.BackSide,
  }), // Top
  new THREE.MeshBasicMaterial({
    map: textureLoader.load("ny.jpg"),
    side: THREE.BackSide,
  }), // Bottom
  new THREE.MeshBasicMaterial({
    map: textureLoader.load("pz.jpg"),
    side: THREE.BackSide,
  }), // Front
  new THREE.MeshBasicMaterial({
    map: textureLoader.load("nz.jpg"),
    side: THREE.BackSide,
  }), // Back
];

// 2. Construct the massive hollow box
const skyboxGeometry = new THREE.BoxGeometry(1000000, 1000000, 1000000);
const skyboxMesh = new THREE.Mesh(skyboxGeometry, skyboxMaterials);

// 3. Tilt the galaxy 60 degrees!
skyboxMesh.rotation.x = THREE.MathUtils.degToRad(60);

scene.add(skyboxMesh);

// Drop the Player Ship into the scene!
const ship = new PlayerShip(camera, renderer.domElement, scene);

// Move the ship out of the Sun and into deep space
ship.mesh.position.set(100, 0, 0);

// --- INSTANT CAMERA SETUP ---
// Spawn the camera much closer to the new micro-sized ship
camera.position.set(
  ship.mesh.position.x,
  ship.mesh.position.y + 0.2, // Pushed down to get level with the hull
  ship.mesh.position.z + 0.5, // Pushed in close to the engines
);

controls.target.copy(ship.mesh.position);
controls.update();
previousShipPosition.copy(ship.mesh.position);

// Create the Sun
const sun = new Star("Sun", 40, "assets/textures/sun.jpg", 0.02);
scene.add(sun.mesh);

// Create Earth & Moon
// Create Earth
const earth = new Planet(
  "Earth",
  10,
  "assets/textures/earth.jpg",
  2000,
  0.5,
  1.0, // Added back the rotation speed you were missing
  1.7, // THE REAL 2026 ANGLE
);

// DELETE THIS LINE: earth.pivot.rotation.y = 1.2;
// It was overwriting your 2026 position!
earth.targetName = "Earth";
scene.add(earth.pivot);
planets.push(earth);
//earth.uiLabel.style.marginTop = "40px";

// --- HUBBLE (Layered & Stable) ---
const hubble = new CustomStation(
  "Hubble",
  "assets/models/hubble.glb",
  earth,
  0.08, // Scale
  40.0, // Orbit Radius
  2.5, // <--- THE GAS PEDAL: Orbit Speed (was 0.0005)
  0.5, // <--- THE SPIN: Spin Speed (was 0.0005)
  Math.PI, // Starting Angle
);

// Add the docking safety parameters
hubble.targetName = "Hubble";
hubble.isPlanet = true;
hubble.tetherDistance = 25;

// Push the REAL Hubble into the Nav Computer list!
planets.push(hubble);
console.log("Hubble is now a valid docking target!");

// --- THE MOON (Outer Layer) ---
// Moving it to 100 makes the Earth-Moon system feel much more vast
const moon = new Planet(
  "Moon",
  0.5,
  "assets/textures/moon.jpg",
  100,
  0.05,
  0, // The spin speed
  2.5, // The real 2026 angle
);
moon.targetName = "Moon";
moon.tetherDistance = 15;
earth.orbitGroup.add(moon.pivot);
planets.push(moon);

// --- THE ROGUE COMET ---
// Name, Long Radius (400), Short Radius (80), Speed (0.01), Up/Down Tilt (40)
const halleys = new Comet("Halley's Comet", 400.0, 80.0, 0.01, 40.0);

// Because the comet doesn't use a pivot group, we add its mesh directly to the scene
scene.add(halleys.mesh);

// Push it to the Nav Computer!
planets.push(halleys);

//const earthStation = new SpaceStation(earth);
// 1. DISABLE THE GREYBOX (Don't delete it, just comment it out!)
const earthStation = new SpaceStation(earth);
// --- STEP 3: STATION OFFSET ---
// This swings the station to the "side" of Earth so labels don't overlap
earthStation.pivot.rotation.y = Math.PI / 2;

// Safety: Update its matrix so the tether doesn't panic
earthStation.pivot.updateMatrixWorld(true);

// --- ACTIVATE STATION RADAR BEACON ---
earthStation.targetName = "Space Station";
earthStation.tetherDistance = 30; // <-- ADD THIS LINE! Forces you to get super close!

// Create the HTML text element for the station
const stationLabel = document.createElement("div");
stationLabel.className = "planet-label";
stationLabel.style.position = "absolute";
stationLabel.style.color = "white";
stationLabel.style.marginTop = "-40px";
stationLabel.style.fontFamily = "monospace";
stationLabel.style.pointerEvents = "none";
document.getElementById("nav-computer-layer").appendChild(stationLabel);

// Attach the label and push the station into the Nav Computer's tracking list!
earthStation.uiLabel = stationLabel;
planets.push(earthStation);

// Create Mars
const mars = new Planet(
  "Mars",
  1.5,
  "assets/textures/mars.jpg",
  4000,
  0.3,
  3.5,
);
// ... after the Mars Planet constructor ...
mars.targetName = "Mars"; // Move this up
mars.pivot.rotation.y = 4.0;
scene.add(mars.pivot);
planets.push(mars); // Push it last so the label engine sees the name immediately

// --- DEPLOY STATIONS ---

// 1. Re-deploy the Mars Station
const marsOutpost = new CustomStation(
  "Mars Station",
  "assets/models/marss01.glb",
  mars,
  0.1, // Scale
  8.0, // Orbit Radius (Pushed out to 8 so it clears the planet)
  2.0, // <--- NEW: Orbit Speed (Much faster!)
  5.0, // <--- NEW: Spin Speed
);
planets.push(marsOutpost);

// --- THE INNER PLANETS ---
const mercury = new Planet(
  "Mercury",
  3.8,
  "assets/textures/mercury.jpg",
  800,
  0.8,
  4.4,
);
mercury.pivot.rotation.y = 5.0; // Random starting angle
scene.add(mercury.pivot);
planets.push(mercury);
mercury.targetName = "Mercury";

const venus = new Planet(
  "Venus",
  9.5,
  "assets/textures/venus.jpg",
  1400,
  0.6,
  3.1,
);
venus.pivot.rotation.y = 3.14;
scene.add(venus.pivot);
planets.push(venus);
venus.targetName = "Venus";

// (Earth and Mars are already here in your code)

// --- THE GAS GIANTS ---
const jupiter = new Planet(
  "Jupiter",
  70,
  "assets/textures/jupiter.jpg",
  10000,
  0.1,
  0.6,
);
jupiter.pivot.rotation.y = 1.5;
scene.add(jupiter.pivot);
planets.push(jupiter);
jupiter.targetName = "Jupiter";
// --- JUPITER'S MOONS ---
// 1. Io (Volcanic Moon - Closest!)
const io = new Planet("Io", 0.9, "assets/textures/io.jpg", 150, 0.15, 1.2);
io.pivot.rotation.y = 4.5;
jupiter.orbitGroup.add(io.pivot);
planets.push(io);
io.targetName = "Io";

// --- Make Io "Latchable" ---
io.targetName = "Io";
io.tetherDistance = 15; // Nice and close for the volcanic moon
planets.push(io);

// 2. Europa (Ice Moon - Further out!)
const europa = new Planet(
  "Europa",
  0.8,
  "assets/textures/jupiter_europa.png",
  250,
  0.1,
  3.5,
);

// Force the material to be visible and ignore transparency issues
europa.mesh.material.transparent = false;
europa.mesh.material.needsUpdate = true;

europa.pivot.rotation.y = 1.2;
jupiter.orbitGroup.add(europa.pivot);
planets.push(europa);
europa.targetName = "Europa";

// --- Make Europa "Latchable" ---
europa.targetName = "Europa";
europa.tetherDistance = 15; // Perfect for ice-crust inspections
planets.push(europa);

// 3. Ganymede (The Giant Moon - Furthest of the three!)
const ganymede = new Planet(
  "Ganymede",
  3,
  "assets/textures/jupiter_ganymede.jpg",
  170,
  0.05,
  5.0,
);
ganymede.pivot.rotation.y = 2.8;
jupiter.orbitGroup.add(ganymede.pivot);
planets.push(ganymede);
ganymede.targetName = "Ganymede";

// --- Make Ganymede "Latchable" ---
ganymede.targetName = "Ganymede";
ganymede.tetherDistance = 25; // Closer than a planet since the moon is smaller
planets.push(ganymede);

// Callisto: The furthest out of the main four
const callisto = new Planet(
  "Callisto",
  1.1,
  "assets/textures/jupiter_callisto.jpg", // Using your filename!
  550, // Nice and far out
  0.02,
  0.5,
);

callisto.targetName = "Callisto";
callisto.tetherDistance = 20;
jupiter.orbitGroup.add(callisto.pivot);
planets.push(callisto);

// --- 1. PLANET SETUP: SATURN ---
const saturn = new RingedPlanet(
  "Saturn",
  60, // Planet Radius
  "assets/textures/saturn.jpg",
  "assets/textures/saturn_rings.png",
  80, // Inner Ring Radius (Was 35, now 80)
  150, // Outer Ring Radius (Was 70, now 150)
  18000, // Orbit Distance
  0.05, // Orbit Speed
  3.4, // Rotation Speed
);

// Apply Photoshop-ready material settings
if (saturn.mesh) {
  saturn.mesh.material.roughness = 1.0;
  saturn.mesh.material.metalness = 0.0;
  saturn.mesh.material.color.setHex(0xffffff);
}

saturn.pivot.rotation.y = 0.5;
saturn.targetName = "Saturn";
saturn.tetherDistance = 400;
scene.add(saturn.pivot);
planets.push(saturn);

// --- SATURN'S MOON ---
// Titan (The Hazy Giant)
const titan = new Planet(
  "Titan",
  3.0,
  "assets/textures/saturn_titan.png", // <--- The correct file name and extension!
  280,
  0.02,
  0.02,
);
titan.pivot.rotation.y = 0.8;
saturn.orbitGroup.add(titan.pivot);
planets.push(titan);
titan.targetName = "Titan";

// --- Make Titan "Latchable" ---
titan.targetName = "Titan";
titan.tetherDistance = 40; // A bit more room for the hazy giant
planets.push(titan);

// --- 2. LIGHTING: PLANET SHINE ---
const planetShine = new THREE.PointLight(0xffe4b5, 1.2, 0);
planetShine.position.set(20000, 10000, 80000);
scene.add(planetShine);

// --- 3. STATION SETUP: SATURN PRIME ---
const saturnBase = new CustomStation(
  "Saturn Prime",
  "assets/models/satss01.glb",
  saturn,
  1.0, // Scale
  200.0, // Orbit Radius (Safely out of the rings!)
  0.5, // <--- Orbit Speed (Changed from 0 so it actually moves!)
  1.0, // <--- Spin Speed (Changed from 0.0005 so it spins nicely!)
  Math.PI, // <--- Starting Angle (Keep it!)
);
planets.push(saturnBase);

// Add the Metallic Shine to Saturn Prime once the model loads
saturnBase.onLoad = () => {
  saturnBase.mesh.rotation.y = 3.14;
  saturnBase.mesh.traverse((child) => {
    if (child.isMesh) {
      child.material.metalness = 0.8; // High metal feel
      child.material.roughness = 0.2; // Shiny finish
    }
  });
};

planets.push(saturnBase);

const uranus = new Planet(
  "Uranus",
  20,
  "assets/textures/uranus.jpg",
  35000,
  0.02,
  0.9,
);
uranus.pivot.rotation.y = 4.2;
scene.add(uranus.pivot);
planets.push(uranus);
uranus.targetName = "Uranus";

const neptune = new Planet(
  "Neptune",
  19,
  "assets/textures/neptune.jpg",
  55000,
  0.01,
  6.1,
);
neptune.pivot.rotation.y = 2.8;
scene.add(neptune.pivot);
planets.push(neptune);
neptune.targetName = "Neptune";

// --- THE OUTER RIM ---
const pluto = new Planet(
  "Pluto",
  1.8,
  "assets/textures/pluto.png",
  75000,
  0.005,
  0.5,
);
pluto.pivot.rotation.y = 6.0;
scene.add(pluto.pivot);
planets.push(pluto);
pluto.targetName = "Pluto";

timeManager.updateUI();

// --- THE MISSING LINK ---
const clock = new THREE.Clock();

// --- THE ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.1);

  // 1. UPDATE THE CLOCK
  timeManager.update(rawDelta);
  const currentSimDays = timeManager.getDaysSinceJ2000();

  // 4. UPDATE THE SHIP (Only once!)
  ship.update(delta);

  // 3. THE MASTER ENGINE: Move the universe forward in time!
  planets.forEach((p) => {
    if (p.update) p.update(currentSimDays);
  });

  // Move the Custom Stations AT THE EXACT SAME TIME
  // --- THE IRON-CLAD CLOCK FIX ---
  if (typeof earthStation !== "undefined") earthStation.update(currentSimDays);
  if (typeof marsOutpost !== "undefined") marsOutpost.update(currentSimDays);
  if (typeof saturnBase !== "undefined") saturnBase.update(currentSimDays);

  if (typeof hubble !== "undefined") hubble.update(currentSimDays);
  else if (window.hubble) window.hubble.update(currentSimDays);

  // FIX THE JITTER: Force the 3D world to calculate new coordinates immediately!
  scene.updateMatrixWorld(true);

  // --- THE PURE MATH ORBITAL BOLT ---
  if (ship.tetherTarget) {
    // 1. Superglue the radar
    if (
      timeManager &&
      Math.abs(timeManager.timeWarp) > 1.5 &&
      ship.lastTarget
    ) {
      ship.tetherTarget = ship.lastTarget;
    } else {
      ship.lastTarget = ship.tetherTarget;
    }

    //const tracker =
    //ship.tetherTarget.mesh ||
    //ship.tetherTarget.pivot ||
    //ship.tetherTarget.group;

    const tracker =
      ship.tetherTarget.orbitGroup ||
      ship.tetherTarget.mesh ||
      ship.tetherTarget.pivot ||
      ship.tetherTarget.group;

    if (tracker) {
      const currentPos = new THREE.Vector3();
      const currentQuat = new THREE.Quaternion();
      tracker.getWorldPosition(currentPos);
      tracker.getWorldQuaternion(currentQuat);

      const isWarping = timeManager && Math.abs(timeManager.timeWarp) > 1.5;

      if (isWarping) {
        // Initialize memory on the very first frame of warp
        if (!ship.warpPosMemory) {
          ship.warpPosMemory = currentPos.clone();
          ship.warpQuatMemory = currentQuat.clone();
        }

        // 2. THE PURE MATH BOLT: Calculate exactly how much Hubble rotated this frame
        const deltaQuat = currentQuat
          .clone()
          .multiply(ship.warpQuatMemory.clone().invert());

        // 3. Find our ship's offset distance from Hubble
        const offset = ship.mesh.position.clone().sub(ship.warpPosMemory);

        // 4. Swing our offset by Hubble's rotation! (This curves your orbit around Earth)
        offset.applyQuaternion(deltaQuat);

        // 5. Move the ship to the new curved position
        ship.mesh.position.copy(currentPos.clone().add(offset));

        // 6. Turn the ship's nose by the exact same amount so the view NEVER changes!
        ship.mesh.quaternion.premultiply(deltaQuat);

        // 7. Save this frame's position/rotation for the next frame
        ship.warpPosMemory.copy(currentPos);
        ship.warpQuatMemory.copy(currentQuat);
      } else {
        // Not warping. Erase the math memory so you can fly normally.
        ship.warpPosMemory = null;
        ship.warpQuatMemory = null;

        // Safe Distance Check
        const limit = ship.tetherTarget.tetherDistance || 4000;
        if (ship.mesh.position.distanceTo(currentPos) > limit) {
          ship.tetherTarget = null;
          ship.isDocking = false;
          ship.isUndocking = false;
        }
      }
    }
  } else {
    ship.lastTarget = null;
    ship.warpPosMemory = null;
    ship.warpQuatMemory = null;
  }

  // --- RESET WARP LOCK EVERY FRAME ---
  ship.hasWarpLock = false;

  // --- NAV COMPUTER: UI SETUP ---
  // 1. Create the dedicated layer for labels (so it doesn't hide the clock!)
  // Grab the glass layer we built in the HTML
  const navContainer = document.getElementById("nav-computer-layer");

  // --- 2. The Label Factory: Build a tag for every planet in your list ---
  planets.forEach((planet) => {
    // 1. If it has a name but no label, build it
    if (planet.targetName && !planet.uiLabel) {
      const label = document.createElement("div");
      label.className = "planet-label"; // Links to your style.css
      label.textContent = planet.targetName;

      // 2. FORCE absolute positioning right at birth
      label.style.position = "absolute";
      label.style.zIndex = "100";
      label.style.pointerEvents = "none";

      navContainer.appendChild(label);
      planet.uiLabel = label;
      console.log("Created HUD label for:", planet.targetName);
    }
  });

  // --- NAV COMPUTER: RADAR TRACKING ---

  // Reset the warp lock every frame. We only turn it on if we have a Winner!
  ship.hasWarpLock = false;

  // STEP 1: Find the ONE object closest to the dead-center of the crosshairs
  let bestTarget = null;
  let smallestAngle = 0.3; // This is your original aim cone size

  planets.forEach((planet) => {
    // 1. Get Coordinates
    const planetWorldPos = new THREE.Vector3();
    const tracker =
      planet.orbitGroup ||
      planet.pivot ||
      planet.group ||
      planet.mesh ||
      planet;

    if (tracker && tracker.getWorldPosition) {
      tracker.getWorldPosition(planetWorldPos);
    } else {
      planetWorldPos.copy(planet.position || new THREE.Vector3());
    }

    // 2. Calculate Angle and Distance
    const shipForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(ship.mesh.quaternion)
      .normalize();
    const directionToPlanet = new THREE.Vector3()
      .subVectors(planetWorldPos, ship.mesh.position)
      .normalize();

    const angle = shipForward.angleTo(directionToPlanet);
    const distance = ship.mesh.position.distanceTo(planetWorldPos);

    // Save these so we don't calculate them twice in Step 2!
    planet.savedWorldPos = planetWorldPos;
    planet.savedDistance = distance;

    // 3. THE TIE-BREAKER: Is it closer to the center than the last one we checked?
    if (angle < smallestAngle) {
      smallestAngle = angle; // Shrink the cone to beat!
      bestTarget = planet; // Crown the new winner
    }
  });

  // STEP 2: Paint the HUD!
  planets.forEach((planet) => {
    if (!planet.uiLabel) return;

    // Calculate Screen Position
    const screenPos = planet.savedWorldPos.clone();
    screenPos.project(camera);

    if (screenPos.z > 1) {
      planet.uiLabel.style.display = "none";
      return;
    }

    // Position the text
    planet.uiLabel.style.display = "block";
    planet.uiLabel.style.position = "absolute";
    planet.uiLabel.style.zIndex = "99999";

    if (!planet.uiLabel.innerText) {
      planet.uiLabel.innerText = planet.targetName || "Target";
    }

    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

    planet.uiLabel.style.left = `${x}px`;
    planet.uiLabel.style.top = `${y}px`;
    planet.uiLabel.style.transform = "translate(-50%, -50%)";

    const grabDistance = planet.tetherDistance || 300;
    planet.uiLabel.innerText = `${planet.targetName}\n${planet.savedDistance.toFixed(0)} km`;

    // --- APPLY COLORS BASED ON THE WINNER ---
    if (planet === bestTarget) {
      if (planet.savedDistance > grabDistance) {
        // 1. GREEN HUD (Locked, but too far to park)
        planet.uiLabel.style.color = "#00ff00";
        planet.uiLabel.style.textShadow = "0 0 15px #00ff00";
        planet.uiLabel.style.fontSize = "32px";
        planet.uiLabel.style.zIndex = "10";
        ship.hasWarpLock = true; // Engage warp drive!
      } else {
        // 2. ORANGE HUD (Tether Zone!)
        planet.uiLabel.style.color = "#ffaa00";
        planet.uiLabel.style.textShadow = "0 0 15px #ffaa00";
        planet.uiLabel.style.fontSize = "32px";
        planet.uiLabel.style.zIndex = "10";
        ship.hasWarpLock = true; // Engage warp drive!

        // Anchor the tether
        if (ship.tetherTarget !== planet && !ship.isDocking) {
          ship.tetherTarget = planet;
          if (!planet.prevPos) planet.prevPos = new THREE.Vector3();
          const tracker =
            planet.orbitGroup || planet.pivot || planet.group || planet.mesh;
          if (tracker) tracker.getWorldPosition(planet.prevPos);
        }
      }
    } else {
      // 3. BACKGROUND HUD (Your original Blue styling for un-aligned targets)
      planet.uiLabel.style.color = "#0088ff";
      planet.uiLabel.style.textShadow = "0 0 5px #0088ff";
      planet.uiLabel.style.fontSize = "24px";
      planet.uiLabel.style.zIndex = "1";
    }
  });

  // Update Hubble specifically if it's not in the planets array
  //if (window.hubble) {
  //window.hubble.update(currentSimDays);
  //}

  // FIX THE JITTER: Force the 3D world to update its coordinates right now!
  //scene.updateMatrixWorld();

  // --- NEW AUTOMATED TRACTOR BEAM ---
  // Now the tractor beam works on everything in the planets list!
  if (ship.tetherTarget && ship.isDocking) {
    // ONLY run the math if the beam is actively pulling you in
    if (ship.isDocking) {
      const target = ship.tetherTarget;
      const station3D = target.mesh || target.pivot;
      //const station3D =
      //target.orbitGroup ||
      //target.mesh ||
      //target.model ||
      //target.group ||
      //target.pivot ||
      //target;

      const hangarPos = new THREE.Vector3();
      const stationRot = new THREE.Quaternion();

      if (typeof station3D.getWorldPosition === "function") {
        station3D.getWorldPosition(hangarPos);
        station3D.getWorldQuaternion(stationRot);

        const offset = new THREE.Vector3(0, 0, 2);
        offset.applyQuaternion(stationRot);
        hangarPos.add(offset);
      } else {
        hangarPos.copy(station3D.position);
        stationRot.copy(station3D.quaternion);
      }

      ship.velocity.set(0, 0, 0);
      ship.rotationVelocity.set(0, 0, 0);

      // 3. THE HYPER PULL (Cranked up to 20)
      const distance = ship.mesh.position.distanceTo(hangarPos);
      const beamSpeed = 1.0 * delta;

      // The Winch Alarm: Proves the beam is firing!
      console.log(
        "TRACTOR BEAM WINCH ACTIVE! Distance remaining:",
        distance.toFixed(2),
      );

      if (distance > 0.05) {
        const pullDir = new THREE.Vector3()
          .subVectors(hangarPos, ship.mesh.position)
          .normalize();
        ship.mesh.position.add(
          pullDir.multiplyScalar(Math.min(beamSpeed, distance)),
        );
      } else {
        ship.mesh.position.copy(hangarPos); // Snap to perfection when arrived
      }

      // 4. The Gyroscope Alignment
      const twist = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        0, // 0 = Park Nose-In. (Use Math.PI if you want to park backing in!)
      );
      const uprightRotation = stationRot.clone().multiply(twist);

      if (ship.mesh.quaternion.angleTo(uprightRotation) > 0.05) {
        ship.mesh.quaternion.slerp(uprightRotation, 0.1);
      } else {
        ship.mesh.quaternion.copy(uprightRotation);
      }

      // 5. Update the HUD
      const engineText = document.getElementById("hud-engines");
      if (engineText) {
        engineText.innerText = "TRACTOR BEAM: DOCKING";
        engineText.style.color = "#00ff00";
      }
    } else {
      // If beam is off, clean up the HUD text
      const engineText = document.getElementById("hud-engines");
      if (engineText && engineText.innerText.includes("TRACTOR BEAM")) {
        engineText.innerText = "ENGINES: IDLE";
        engineText.style.color = "#00ffcc";
      }
    }
  } else {
    // Failsafe: if you fly far away, ensure the beam shuts down
    ship.isDocking = false;
  }
  // --- END TRACTOR BEAM ---

  // --- IMPULSE ENGINES (I & O Keys) ---
  if (!ship.isDocking) {
    // 1. The Acceleration (Provides the smooth ease-in)
    const impulseThrust = 0.01 * delta;
    // 2. THE HARD LIMIT: Prevents it from ever acting like a main engine
    const maxImpulseSpeed = 0.01;

    if (ship.keys["i"]) {
      const forward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(ship.mesh.quaternion)
        .normalize();
      ship.velocity.add(forward.multiplyScalar(impulseThrust));

      // Slam on the brakes if it tries to go faster than the hard limit
      if (ship.velocity.length() > maxImpulseSpeed) {
        ship.velocity.setLength(maxImpulseSpeed);
      }
    }
    if (ship.keys["o"]) {
      const backward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(ship.mesh.quaternion)
        .normalize();
      ship.velocity.add(backward.multiplyScalar(impulseThrust));

      // Slam on the brakes if it tries to go faster than the hard limit
      if (ship.velocity.length() > maxImpulseSpeed) {
        ship.velocity.setLength(maxImpulseSpeed);
      }
    }
  }

  // --- DYNAMIC CHASE CAMERA (HYBRID RIG) ---
  if (ship && ship.mesh) {
    const deltaMove = new THREE.Vector3().subVectors(
      ship.mesh.position,
      previousShipPosition,
    );
    camera.position.add(deltaMove);

    const prevQuatInv = previousShipQuaternion.clone().invert();
    const deltaQuat = ship.mesh.quaternion.clone().multiply(prevQuatInv);

    const offset = camera.position.clone().sub(ship.mesh.position);
    offset.applyQuaternion(deltaQuat);
    camera.position.copy(ship.mesh.position).add(offset);

    controls.target.copy(ship.mesh.position);
    controls.update();

    previousShipPosition.copy(ship.mesh.position);
    previousShipQuaternion.copy(ship.mesh.quaternion);
  }

  // --- ROTATE STARFIELD ---
  if (window.stars) {
    window.stars.rotation.y += 0.00005; // Very slow crawl
  }

  renderer.render(scene, camera);
}

// --- NAV COMPUTER: UI SETUP ---
// Grab the glass layer we just built permanently in the HTML
//navContainer = document.getElementById("nav-computer-layer");

// --- NAV COMPUTER & TIME TOGGLE SYSTEM ---
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // 1. ENGINE CONTROLS
  if (key === "w") ship.keys.w = true;
  if (key === "s") ship.keys.s = true;
  if (key === "a") ship.keys.a = true;
  if (key === "d") ship.keys.d = true;
  if (key === "f") ship.keys.f = true;
  if (key === "c") ship.keys.c = true;
  if (key === " ") ship.keys.space = true;

  // 2. IMPULSE ENGINES (The I and O keys you mentioned)
  if (key === "i") ship.keys.i = true;
  if (key === "o") ship.keys.o = true;

  // 3. TIME MACHINE GEARS (Numbers 1-9)
  if (key >= "1" && key <= "9") {
    const gear = parseInt(key);
    timeManager.updateWarpSpeed(gear);
    // Note: If your TimeManager variable in main.js is named something
    // slightly different (like 'clock' or 'timeSystem'), just change
    // 'timeManager' to match it!
  }
}); // This closes the Hubble listener

// The camera takes the picture, and the loop repeats!
renderer.render(scene, camera);
//} // <-- This is the closing brace you added earlier

// --- 4. UI TOGGLES (M for Manual, T for Nav) ---
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "m") {
    const legend = document.getElementById("controls-legend");
    if (legend)
      legend.style.display = legend.style.display === "none" ? "block" : "none";
  }

  if (key === "t") {
    const nav = document.getElementById("nav-computer-layer") || navContainer;
    if (nav) {
      nav.style.display = nav.style.display === "none" ? "block" : "none";
      console.log("HUD Toggled:", nav.style.display);
    }
  }

  // 5. SHIP SYSTEM KEYS
  if (key === "x" && typeof ship.toggleShip === "function") ship.toggleShip();
  // Smart Tractor Beam Trigger
  if (key === "b") {
    if (ship.tetherTarget) {
      ship.isDocking = !ship.isDocking;
      console.log(
        "TRACTOR BEAM STATE:",
        ship.isDocking ? "ENGAGED" : "DISENGAGED",
      );
    } else {
      console.log("SYSTEM ERROR: No target locked. Cannot engage beam.");
      ship.isDocking = false;
    }
  }
}); // THIS is the only one that should have a );

// DON'T FORGET THE KEYUP (To stop the ship from moving forever)
window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "w") ship.keys.w = false;
  if (key === "s") ship.keys.s = false;
  if (key === "a") ship.keys.a = false;
  if (key === "d") ship.keys.d = false;
  if (key === "f") ship.keys.f = false;
  if (key === "c") ship.keys.c = false;
  if (key === " ") ship.keys.space = false;
  if (key === "i") ship.keys.i = false;
  if (key === "o") ship.keys.o = false;
});

// --- 5. BROWSER RESIZING ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- CURSOR CLOAKING TOGGLE (RIGHT-CLICK) ---
let isCursorVisible = true;

window.addEventListener("contextmenu", (event) => {
  // 1. Stop the standard browser right-click menu from popping up!
  event.preventDefault();

  // 2. Flip the switch
  isCursorVisible = !isCursorVisible;

  // 3. Apply the CSS change to the whole game canvas
  if (isCursorVisible) {
    document.body.style.cursor = "default"; // Bring it back
  } else {
    document.body.style.cursor = "none"; // Turn it completely invisible
  }
});

animate();
