import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; // <-- NEW IMPORT!

export class PlayerShip {
  constructor(camera, domElement, scene) {
    // 1. Build the Ship's Core (An invisible wrapper)
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 5, 35);
    scene.add(this.mesh);

    // 2. Setup the "Garage" tracking variables
    this.transportModel = null;
    this.shuttleModel = null;
    this.activeShip = "transport"; // Starts with transport

    const loader = new GLTFLoader();

    // --- SHIP 1: THE TRANSPORT ---
    loader.load(
      "assets/models/transport.glb",
      (gltf) => {
        this.transportModel = gltf.scene;

        // 1. Shrink and rotate
        this.transportModel.scale.set(0.05, 0.05, 0.05);
        this.transportModel.rotation.set(0, Math.PI, 0);

        // 2. Center the physics
        const box = new THREE.Box3().setFromObject(this.transportModel);
        const center = box.getCenter(new THREE.Vector3());
        this.transportModel.position.sub(center);

        this.mesh.add(this.transportModel);
      },
      undefined,
      (error) => console.error("Error loading transport.glb:", error),
    );

    // --- SHIP 2: THE SPACE SHUTTLE ---
    loader.load(
      "assets/models/shuttle.glb",
      (gltf) => {
        this.shuttleModel = gltf.scene;

        // We might need to adjust this scale later!
        this.shuttleModel.scale.set(0.1, 0.1, 0.1);
        this.shuttleModel.rotation.set(0, -Math.PI / 2, 0); // Spin to match transport

        // Center the physics just like the transport
        const box = new THREE.Box3().setFromObject(this.shuttleModel);
        const center = box.getCenter(new THREE.Vector3());
        this.shuttleModel.position.sub(center);

        // THE MAGIC TRICK: Hide it immediately!
        this.shuttleModel.visible = false;

        this.mesh.add(this.shuttleModel);
      },
      undefined,
      (error) => console.error("Error loading shuttle.glb:", error),
    );

    // 3. Mount the Camera
    // 3. Mount the Camera (The Unbreakable Chase Cam)
    //this.mesh.add(camera);
    // Move the camera in SUPER close! (Up 1.5, Back 4)
    //camera.position.set(0, 1, 2.5);

    // Keep the same slight downward tilt
    //camera.rotation.set(-0.05, 0, 0);

    // ADD THESE LINES: Install a military-grade PointLight!
    // (Color: White, Intensity: 50, Distance: 100)
    const headlight = new THREE.PointLight(0xffffff, 50, 100);
    headlight.position.set(0, 0, 0); // Keep it right at the camera lens
    camera.add(headlight);

    // 4. Custom Physics Engine Parameters
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationVelocity = new THREE.Vector3(0, 0, 0);

    // --- WARP DRIVE SPECS ---
    this.hasWarpLock = false;
    this.warpVelocity = 0;
    this.warpAcceleration = 10.0;
    this.maxWarpSpeed = 120.0; // <-- LOWERED FROM 50.0

    this.thrustPower = 0.5;

    // 1. Lowered from 1.2 to 0.3 to make the ship slowly ease into turns
    this.turnAcceleration = 0.3;

    this.drag = 0.98;

    // 2. Raised from 0.92 to 0.98 so the ship smoothly drifts to a stop
    this.rotationalDrag = 0.98;

    // 5. Keyboard Input Tracker
    this.keys = {};
    window.addEventListener(
      "keydown",
      (e) => (this.keys[e.key.toLowerCase()] = true),
    );
    window.addEventListener(
      "keyup",
      (e) => (this.keys[e.key.toLowerCase()] = false),
    );
  }

  // --- THE SHIP SWAPPER ---
  toggleShip() {
    // Safety check: Don't try to swap if the 3D files haven't finished loading yet!
    if (!this.transportModel || !this.shuttleModel) return;

    if (this.activeShip === "transport") {
      this.transportModel.visible = false;
      this.shuttleModel.visible = true;
      this.activeShip = "shuttle";
      console.log("Switched to Space Shuttle");
    } else {
      this.transportModel.visible = true;
      this.shuttleModel.visible = false;
      this.activeShip = "transport";
      console.log("Switched to Transport Fighter");
    }
  }

  update(delta) {
    // --- ROTATION (True 6DOF Starfighter Flight) ---
    if (!this.isDocking) {
      // 0. Check for Manual Override
      const manualSteering =
        this.keys["arrowup"] ||
        this.keys["arrowdown"] ||
        this.keys["arrowleft"] ||
        this.keys["arrowright"] ||
        this.keys["q"] ||
        this.keys["e"];

      // 0.5 AUTOPILOT SOFT-LOCK
      // We require 'W' so it only auto-steers when you actually commit to the warp jump!
      if (
        this.keys["w"] &&
        this.hasWarpLock &&
        this.autoTarget &&
        !manualSteering &&
        !this.arrivalComplete
      ) {
        // Find exactly where the target is in the world
        const targetPos = new THREE.Vector3();
        const tracker =
          this.autoTarget.mesh ||
          this.autoTarget.group ||
          this.autoTarget.model ||
          this.autoTarget.orbitGroup ||
          this.autoTarget.pivot ||
          this.autoTarget;
        if (tracker && tracker.getWorldPosition) {
          tracker.getWorldPosition(targetPos);
        } else {
          targetPos.copy(this.autoTarget.position);
        }

        // Convert that world position into "local" space relative to the nose of the ship
        const localTargetPos = this.mesh.worldToLocal(targetPos.clone());

        // Calculate how far off-center the target is (Pitch and Yaw)
        const yawError = Math.atan2(localTargetPos.x, -localTargetPos.z);
        const pitchError = Math.atan2(localTargetPos.y, -localTargetPos.z);

        // Apply a gentle force to correct the error (The 2.0 is the steering strength)
        this.rotationVelocity.y -= yawError * 2.0 * delta;
        this.rotationVelocity.x += pitchError * 2.0 * delta;

        // Optional: Auto-level the roll (Z-axis) so you don't fly in sideways
        this.rotationVelocity.z -= this.rotationVelocity.z * 1.5 * delta;
      }

      // 1. Pitch (Up/Down) - Manual Steering
      if (this.keys["arrowup"])
        this.rotationVelocity.x += this.turnAcceleration * delta;
      if (this.keys["arrowdown"])
        this.rotationVelocity.x -= this.turnAcceleration * delta;

      // 2. Yaw (Left/Right) - Manual Steering
      if (this.keys["arrowleft"])
        this.rotationVelocity.y += this.turnAcceleration * delta;
      if (this.keys["arrowright"])
        this.rotationVelocity.y -= this.turnAcceleration * delta;

      // 3. Roll (Bank Left/Right) - Manual Steering
      if (this.keys["q"])
        this.rotationVelocity.z += this.turnAcceleration * delta;
      if (this.keys["e"])
        this.rotationVelocity.z -= this.turnAcceleration * delta;

      // Apply the true local rotations to all 3 axes!
      this.mesh.rotateY(this.rotationVelocity.y * delta);
      this.mesh.rotateX(this.rotationVelocity.x * delta);
      this.mesh.rotateZ(this.rotationVelocity.z * delta);

      this.rotationVelocity.multiplyScalar(this.rotationalDrag);
    }

    // --- INERTIAL BRAKES ---

    // --- INERTIAL BRAKES ---

    // --- INERTIAL BRAKES ---
    if (this.keys[" "]) {
      this.velocity.multiplyScalar(0.9);
      this.rotationVelocity.multiplyScalar(0.8);
    }

    // --- THRUST (Momentum, Velocity & Warp) ---
    const thrust = new THREE.Vector3(0, 0, 0);

    if (this.keys["w"]) {
      if (this.hasWarpLock && this.autoTarget) {
        // 1. Find our exact distance
        const targetPos = new THREE.Vector3();
        const tracker =
          this.autoTarget.mesh ||
          this.autoTarget.group ||
          this.autoTarget.model ||
          this.autoTarget.orbitGroup ||
          this.autoTarget.mesh ||
          this.autoTarget.pivot ||
          this.autoTarget;
        if (tracker && tracker.getWorldPosition) {
          tracker.getWorldPosition(targetPos);
        } else {
          targetPos.copy(this.autoTarget.position);
        }
        const distanceToTarget = this.mesh.position.distanceTo(targetPos);

        // 2. FIXED Arrival Zones (Back to the high-speed approach!)
        const parkingDistance = 150;
        const brakeZone = 4000;
        const tetherZone = this.autoTarget.tetherDistance || 300;

        // 3. SMART THROTTLE & REAL BRAKES
        if (distanceToTarget <= parkingDistance) {
          // CONDITION C-1: HARD STOP AT THE DOORSTEP
          const currentSpeed = this.velocity.length() * 1000;

          if (!this.arrivalComplete) {
            // Slam the brakes until we are completely stopped
            this.warpVelocity = 0;
            thrust.z = 0;
            this.velocity.multiplyScalar(0.85);

            // Once stopped, check if we are in the Orange Zone to release!
            if (currentSpeed < 1.0 && distanceToTarget <= tetherZone) {
              this.arrivalComplete = true; // Brakes off! Steering off!
            }
          } else {
            // We are parked and inside the tether zone!
            // 'W' now functions as a standard, manual sub-light engine.
            this.warpVelocity = 0;
            thrust.z = -this.thrustPower * delta;
          }
        } else if (distanceToTarget < brakeZone) {
          // CONDITION C-2: BRAKING ZONE
          this.arrivalComplete = false; // Reset ticket if we leave the zone

          const speedRatio =
            (distanceToTarget - parkingDistance) /
            (brakeZone - parkingDistance);
          const dynamicMaxSpeed = this.maxWarpSpeed * speedRatio;

          if (this.warpVelocity > dynamicMaxSpeed) {
            this.warpVelocity *= 0.9;
            this.velocity.multiplyScalar(0.96);
          } else {
            this.warpVelocity += this.warpAcceleration * delta;
          }
          thrust.z = -this.warpVelocity * delta;
        } else {
          // CONDITION C-3: OPEN SPACE! Full speed ahead.
          this.arrivalComplete = false; // Reset ticket

          this.warpVelocity += this.warpAcceleration * delta;
          if (this.warpVelocity > this.maxWarpSpeed) {
            this.warpVelocity = this.maxWarpSpeed;
          }
          thrust.z = -this.warpVelocity * delta;
        }
      } else {
        // CONDITION D: AUTOPILOT GLIDE! (Target lost or manually gliding)
        if (this.warpVelocity > 0.1) {
          this.warpVelocity *= 0.95;
          thrust.z = -this.warpVelocity * delta;
        } else {
          this.warpVelocity = 0;
          thrust.z = -this.thrustPower * delta;
        }
      }
    } else {
      // CONDITION A/B: 'W' released manually. Graceful glide.
      if (this.warpVelocity > 0.1) {
        this.warpVelocity *= 0.95;
        thrust.z = -this.warpVelocity * delta;
      } else {
        this.warpVelocity = 0;
      }
    }

    // Standard Reverse and Strafe (Sub-light only)
    // Main Engine Reverse
    if (this.keys["s"]) thrust.z += this.thrustPower * delta;

    // --- PRECISION RCS THRUSTERS (A, D, F, C) ---
    // Adjust this tiny decimal to change your parking thruster speed!
    const rcsAccel = 0.02;

    if (this.keys["a"]) thrust.x -= rcsAccel * delta; // Strafe Left
    if (this.keys["d"]) thrust.x += rcsAccel * delta; // Strafe Right
    if (this.keys["f"]) thrust.y += rcsAccel * delta; // Hover Up
    if (this.keys["c"]) thrust.y -= rcsAccel * delta; // Hover Down

    thrust.applyQuaternion(this.mesh.quaternion);
    this.velocity.add(thrust);

    // (Notice the hard Speed Limiter is completely deleted so you can glide again!)

    this.velocity.multiplyScalar(this.drag);
    this.mesh.position.add(this.velocity);

    // --- HUD UPDATES ---
    const speed = this.velocity.length() * 1000;
    const velocityText = document.getElementById("hud-velocity");
    if (velocityText) velocityText.innerText = speed.toFixed(1);

    const engineText = document.getElementById("hud-engines");
    if (engineText) {
      if (this.keys[" "]) {
        engineText.innerText = "BRAKING";
        engineText.style.color = "#ff3333";
      } else if (this.keys["w"] && this.hasWarpLock) {
        engineText.innerText = "WARP DRIVE ACTIVE";
        engineText.style.color = "#ff00ff"; // Magenta for warp!
      } else if (this.keys["w"]) {
        engineText.innerText = "FWD THRUST";
        engineText.style.color = "#00ffcc";
      } else if (this.keys["s"]) {
        engineText.innerText = "REV THRUST";
        engineText.style.color = "#00ffcc";
      } else if (
        this.keys["a"] ||
        this.keys["d"] ||
        this.keys["f"] ||
        this.keys["c"]
      ) {
      } else {
        engineText.innerText = "IDLE";
        engineText.style.color = "#777777";
      }
    }
  }
}
