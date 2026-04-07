import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; // <-- NEW IMPORT!

export class PlayerShip {
  constructor(camera, domElement, scene) {
    this.lockedOrbitTarget = null;
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
        this.transportModel.scale.set(0.03, 0.03, 0.03);
        this.transportModel.rotation.set(0, Math.PI, 0);

        // 2. Center the physics
        const box = new THREE.Box3().setFromObject(this.transportModel);
        const center = box.getCenter(new THREE.Vector3());
        this.transportModel.position.sub(center);
        
        // Custom height tweak
        this.transportModel.position.y -= 0.1;
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

        // Custom scale tweak
        this.shuttleModel.scale.set(0.07, 0.07, 0.07);
        this.shuttleModel.rotation.set(0, -Math.PI / 2, 0); // Spin to match transport

        // Center the physics just like the transport
        const box = new THREE.Box3().setFromObject(this.shuttleModel);
        const center = box.getCenter(new THREE.Vector3());
        this.shuttleModel.position.sub(center);
        
        // Custom height tweak
        this.shuttleModel.position.y -= 0.04;
        
        // THE MAGIC TRICK: Hide it immediately!
        this.shuttleModel.visible = false;

        this.mesh.add(this.shuttleModel);
      },
      undefined,
      (error) => console.error("Error loading shuttle.glb:", error),
    );

    // --- SHIP HEADLIGHTS (THE FLOODLIGHT UPGRADE) ---
    // Parameters: Color, Intensity, Distance, Angle, Penumbra, Decay
    // FIXED: Changed 'ii' back to 'SpotLight'
    this.headlight = new THREE.SpotLight(
      0xffffff,
      50,
      1000,
      Math.PI / 2,
      1.0,
      1,
    );

    // --- THE "HUMOR ME" POSITIONING ---
    // Moving it to Z: 5 puts it BEHIND the nose/cockpit
    // Moving it to Y: 4 puts it ABOVE the ship so it shines down onto the hull
    this.headlight.position.set(0, 2, -0);

    // Keep the target way out in front so the beam points forward
    this.headlight.target.position.set(0, 0, -100);
    this.mesh.add(this.headlight.target);

    // Attached the light to the SHIP mesh
    this.headlight.visible = false;
    this.mesh.add(this.headlight);

    // --- PUT THE ORBIT MATH BACK! ---
    this.dummyMatrix = new THREE.Matrix4();
    this.targetQuaternion = new THREE.Quaternion();

    // 4. Custom Physics Engine Parameters
    this.velocity = new THREE.Vector3(0, 0, 0);

    // --- THE TOGGLE SWITCH (L KEY) ---
    window.addEventListener("keydown", (event) => {
      // We check for 'l' or 'L' so Caps Lock doesn't break your game
      if (event.key.toLowerCase() === "l") {
        this.headlight.visible = !this.headlight.visible;

        // Optional: A little dashboard feedback in the console
        console.log("Headlights: " + (this.headlight.visible ? "ON" : "OFF"));
      }
    });

    // 4. Custom Physics Engine Parameters
    this.velocity = new THREE.Vector3(0, 0, 0);
    // Cinematic Orbit Variables
    this.isOrbiting = false;
    this.orbitAngle = 0;
    this.orbitSpeed = 0.002;
    this.rotationVelocity = new THREE.Vector3(0, 0, 0);

    // --- NEW: Manual Drone Hover Variables ---
    this.isManualHovering = false;
    this.manualSpherical = new THREE.Spherical();
    this.targetSpherical = new THREE.Spherical(); // <--- ADD THIS: The invisible chaser target!
    this.hoverSpeed = 0.002;

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

  update(delta, planets = []) {
    // ==========================================
    // V3 CINEMATIC ORBIT MODULE (THE CLUTCH)
    // ==========================================
    if (this.isOrbiting && this.lockedOrbitTarget) {
      // 1. THE ESCAPE HATCH: Press 'W' to break orbit
      if (this.keys["w"]) {
        this.isOrbiting = false;
        this.lockedOrbitTarget = null;
        this.velocity.set(0, 0, 0);
        this.mesh.up.set(0, 1, 0);
        
        // Reset rotation offset when breaking orbit
        this.hoverRotationOffset = new THREE.Quaternion();
        return;
      }

      // 2. THE GPS SYNC
      const targetPos = new THREE.Vector3();

      // We need to grab the ACTUAL offset model, not the center pivot
      const tracker =
        this.lockedOrbitTarget.mesh ||
        this.lockedOrbitTarget.visualNode ||
        this.lockedOrbitTarget.orbitGroup ||
        this.lockedOrbitTarget.pivot ||
        this.lockedOrbitTarget;

      if (tracker) {
        if (typeof tracker.updateMatrixWorld === "function") {
          tracker.updateMatrixWorld(true);
        }

        if (typeof tracker.getWorldPosition === "function") {
          tracker.getWorldPosition(targetPos);
        } else if (tracker.position) {
          targetPos.copy(tracker.position);
        }
      }

      // 3. SUN-DIVE PROTECTOR: If the planet is missing, don't move.
      if (targetPos.length() < 10) return;

      // 4. MOVE ON THE RAIL (Smooth Polar Entry)
      this.orbitPhase += this.orbitSpeed || 0.002;

      const safeDist =
        typeof this.orbitDistance === "number" && !isNaN(this.orbitDistance)
          ? this.orbitDistance
          : 3;

      // Calculate smooth vertical and horizontal offsets
      const elevation = Math.sin(this.orbitPhase) * safeDist;
      const horizontalRadius = Math.cos(this.orbitPhase) * safeDist;

      // Apply the locked longitude
      const finalX =
        targetPos.x + Math.cos(this.orbitLongitude) * horizontalRadius;
      const finalZ =
        targetPos.z + Math.sin(this.orbitLongitude) * horizontalRadius;
      const finalY = targetPos.y + elevation;

      // LERP everything to eliminate the remaining "jumps"
      this.mesh.position.x += (finalX - this.mesh.position.x) * 0.1;
      this.mesh.position.z += (finalZ - this.mesh.position.z) * 0.1;
      this.mesh.position.y += (finalY - this.mesh.position.y) * 0.1;

      // 5. THE HYBRID LOOK/SPIN CONTROLLER
      
      // Calculate the base "ideal" look matrix facing away from target
      const awayPoint = new THREE.Vector3()
        .copy(this.mesh.position)
        .add(new THREE.Vector3().subVectors(this.mesh.position, targetPos));

      this.dummyMatrix.lookAt(
        awayPoint,
        this.mesh.position,
        new THREE.Vector3(0, 1, 0),
      );
      
      let baseLook = new THREE.Quaternion().setFromRotationMatrix(this.dummyMatrix);

      // --- MANUAL SPIN LOGIC RESTORED ---
      const isShiftHeld =
        this.keys["shift"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"];
      const isSpinning =
        isShiftHeld && (this.keys["arrowleft"] || this.keys["arrowright"]);

      // Initialize offset if it doesn't exist
      if (!this.hoverRotationOffset) {
        this.hoverRotationOffset = new THREE.Quaternion();
      }

      if (isSpinning) {
        // 1. Physically spin the ship using the Arrow Keys while Shift is held!
        const turnSpeed = 0.02;
        if (this.keys["arrowleft"]) this.mesh.rotateY(turnSpeed);
        if (this.keys["arrowright"]) this.mesh.rotateY(-turnSpeed);

        // 2. TEACH THE AUTOPILOT: Save this new angle into memory
        this.hoverRotationOffset = this.mesh.quaternion
          .clone()
          .multiply(baseLook.clone().invert());
          
        this.targetQuaternion.copy(this.mesh.quaternion);
      } else {
        // 3. NORMAL TRACKING: Apply offset to the base look direction
        this.targetQuaternion.copy(this.hoverRotationOffset).multiply(baseLook);
        
        let angleToTarget = this.mesh.quaternion.angleTo(this.targetQuaternion);

        // 2.0 radians is about 114 degrees. If the target suddenly flips behind us, it's gimbal lock.
        if (angleToTarget > 2.0) {
          // Trigger the slow, smooth cinematic roll ONLY for the polar flip
          let stepSize = 0.005 + 0.02 * Math.sin(angleToTarget);
          this.mesh.quaternion.rotateTowards(this.targetQuaternion, stepSize);
        } else {
          // Normal flight tracking!
          this.mesh.quaternion.slerp(this.targetQuaternion, 0.03);
        }
      }

      // Reinforce the vertical lock
      this.mesh.up.set(0, 1, 0);

      // THE CLUTCH: Stop regular flight logic while orbiting
      return;
    }
    // --- THE V-KEY IGNITION SWITCH (Dynamic Distance Version) ---
    if (this.keys["v"] || this.keys["V"]) {
      // Swapped to our new hover variable!
      if (this.autoTarget && !this.isManualHovering) {
        // 1. Lock the planet so it doesn't change mid-flight
        this.lockedOrbitTarget = this.autoTarget;
        console.log("LOCKING HOVER AT: " + this.lockedOrbitTarget.name);

        const targetPos = new THREE.Vector3();

        // Synced the tracker to match the update loop so it grabs the actual mesh
        const tracker =
          this.lockedOrbitTarget.mesh ||
          this.lockedOrbitTarget.visualNode ||
          this.lockedOrbitTarget.orbitGroup ||
          this.lockedOrbitTarget.pivot ||
          this.lockedOrbitTarget;

        if (tracker) {
          if (typeof tracker.updateMatrixWorld === "function") {
            tracker.updateMatrixWorld(true);
          }
          if (typeof tracker.getWorldPosition === "function") {
            tracker.getWorldPosition(targetPos);
          } else if (tracker.position) {
            targetPos.copy(tracker.position);
          }
        }

        // 2. THE NEW SPHERICAL TETHER LOCK
        let offset = new THREE.Vector3().subVectors(
          this.mesh.position,
          targetPos,
        );
        this.manualSpherical.setFromVector3(offset);
        this.manualSpherical.radius = this.mesh.position.distanceTo(targetPos);

        // <--- ADD THIS LINE: Sync the target instantly on ignition!
        this.targetSpherical.copy(this.manualSpherical);

        // --- NEW: CAPTURE THE CUSTOM SIDEWAYS ANGLE ---
        // 1. Where WOULD we look if we faced the planet?
        this.dummyMatrix.lookAt(
          this.mesh.position,
          targetPos,
          new THREE.Vector3(0, 1, 0),
        );
        let idealLook = new THREE.Quaternion().setFromRotationMatrix(
          this.dummyMatrix,
        );
        // 2. Measure the difference between that and where you are ACTUALLY looking
        this.hoverRotationOffset = this.mesh.quaternion
          .clone()
          .multiply(idealLook.invert());

        this.isManualHovering = true;
      } else if (this.isManualHovering) {
        // THE OFF SWITCH
        console.log("Breaking Hover.");
        this.isManualHovering = false;
        this.lockedOrbitTarget = null; // Clears the targeting computer.
      }

      this.keys["v"] = false;
      this.keys["V"] = false;
    }

    // --- STEP 3: MANUAL DRONE HOVER ENGINE ---

    // 0. THE ESCAPE HATCH: Press 'W' to break the hover lock instantly!
    if (this.isManualHovering && (this.keys["w"] || this.keys["W"])) {
      console.log("Emergency Hover Eject!");
      this.isManualHovering = false;
      this.lockedOrbitTarget = null;
    }

    // 1. The engine math (Only runs if we didn't just eject!)
    if (this.isManualHovering && this.lockedOrbitTarget) {
      const currentTargetPos = new THREE.Vector3();
      const tracker =
        this.lockedOrbitTarget.mesh ||
        this.lockedOrbitTarget.orbitGroup ||
        this.lockedOrbitTarget;
        
      if (typeof tracker.getWorldPosition === "function") {
        tracker.getWorldPosition(currentTargetPos);
      } else if (tracker.position) {
        currentTargetPos.copy(tracker.position);
      }

      const left = this.keys["arrowleft"] || this.keys["ArrowLeft"];
      const right = this.keys["arrowright"] || this.keys["ArrowRight"];
      const up = this.keys["arrowup"] || this.keys["ArrowUp"];
      const down = this.keys["arrowdown"] || this.keys["ArrowDown"];

      // 1. Arrow keys move the INVISIBLE TARGET, not the camera!
      if (left) this.targetSpherical.theta -= this.hoverSpeed || 0.02;
      if (right) this.targetSpherical.theta += this.hoverSpeed || 0.02;
      if (up) this.targetSpherical.phi -= this.hoverSpeed || 0.02;
      if (down) this.targetSpherical.phi += this.hoverSpeed || 0.02;

      // 2. Clamp the TARGET phi so it doesn't cross the poles
      const epsilon = 0.01;
      this.targetSpherical.phi = Math.max(
        epsilon,
        Math.min(Math.PI - epsilon, this.targetSpherical.phi),
      );

      // 3. THE LERP: Smoothly drag the actual camera toward the target
      this.manualSpherical.theta = THREE.MathUtils.lerp(
        this.manualSpherical.theta,
        this.targetSpherical.theta,
        0.05,
      );
      this.manualSpherical.phi = THREE.MathUtils.lerp(
        this.manualSpherical.phi,
        this.targetSpherical.phi,
        0.05,
      );

      // 4. Convert back to XYZ
      let newOffset = new THREE.Vector3().setFromSpherical(
        this.manualSpherical,
      );
      this.mesh.position.copy(currentTargetPos).add(newOffset);

     // 5. MAINTAIN THE SIDEWAYS CAMERA LOCK
      this.dummyMatrix.lookAt(
        this.mesh.position,
        currentTargetPos,
        new THREE.Vector3(0, 1, 0),
      );
      let baseLook = new THREE.Quaternion().setFromRotationMatrix(
        this.dummyMatrix,
      );

      // Ensure the rotation offset exists so we don't get an error
      if (!this.hoverRotationOffset) {
        this.hoverRotationOffset = new THREE.Quaternion();
      }

      // Multiply the mathematical center by your custom sideways offset
      // ADDED .normalize() to clean the math!
      this.targetQuaternion.copy(this.hoverRotationOffset).multiply(baseLook).normalize();

      // --- THE "OLD WAY" RESTORED (SHIFT + ARROW KEYS) ---
      const isShiftHeld = this.keys["shift"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"];
      const isSpinning = isShiftHeld && (left || right);

      if (isSpinning) {
        // 1. Physically spin the ship using the Arrow Keys while Shift is held!
        const turnSpeed = 0.02;
        if (left) this.mesh.rotateY(turnSpeed);
        if (right) this.mesh.rotateY(-turnSpeed);

        // 2. TEACH THE AUTOPILOT: Save this new angle into memory
        // ADDED .normalize() to clean the math!
        this.hoverRotationOffset = this.mesh.quaternion
          .clone()
          .multiply(baseLook.clone().invert())
          .normalize(); 
          
        this.targetQuaternion.copy(this.mesh.quaternion).normalize();
      } else {
        // 3. NORMAL ORBIT: Autopilot keeps the nose locked
        this.mesh.quaternion.slerp(this.targetQuaternion, 0.05);
        
        // ADDED .normalize() here as a final safety net!
        this.mesh.quaternion.normalize(); 
      }
    }

    // --- ROTATION (True 6DOF Starfighter Flight) ---
    if (!this.isDocking && !this.isOrbiting) {
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
    if (this.keys[" "]) {
      this.velocity.multiplyScalar(0.9);
      this.rotationVelocity.multiplyScalar(0.8);
    }

    // --- THRUST (Momentum, Velocity & Warp) ---
    // THE SAFETY LATCH: Reset the lock when the pilot lets go of the key
    if (!this.keys["w"] && !this.keys["W"]) {
      this.warpLockout = false;
    }

    const thrust = new THREE.Vector3(0, 0, 0);

    if (this.keys["w"] || this.keys["W"]) {
      // THE FIX: "Eat" the key press! If lockout is active, pin the ship and do nothing.
      if (this.warpLockout) {
        this.warpVelocity = 0;
        this.velocity.set(0, 0, 0);
        thrust.z = 0;
      } else {
        const activeTarget = this.autoTarget || this.lockedOrbitTarget;

        if (this.hasWarpLock && activeTarget) {
          const targetPos = new THREE.Vector3();
          const tracker =
            activeTarget.mesh || activeTarget.orbitGroup || activeTarget;

          if (tracker && tracker.getWorldPosition) {
            tracker.getWorldPosition(targetPos);
          } else {
            targetPos.copy(activeTarget.position);
          }

          // Using this.mesh.position to prevent the Undefined crash!
          const distanceToTarget = this.mesh.position.distanceTo(targetPos);

          // 1. GET PLANET SIZE
          const planetScale =
            tracker && tracker.scale ? Math.max(tracker.scale.x, 1) : 1;

          // 2. DYNAMIC Arrival Zones
          const baseTether = this.autoTarget.tetherDistance || 300;
          const tetherZone = baseTether * planetScale;
          const parkingDistance = tetherZone * 0.8;

          const dockingZone = parkingDistance + 300;
          const finalApproachZone = parkingDistance + 1500;
          const brakeZone = Math.max(8000, parkingDistance * 5);

          // 3. THE 5-STAGE ENGINE LOGIC
          if (distanceToTarget <= parkingDistance) {
            // --- STAGE 4: THE INSTANT STOP & LOCKOUT ---
            if (!this.arrivalComplete) {
              this.velocity.set(0, 0, 0);
              this.warpVelocity = 0;
              thrust.z = 0;

              this.autoPilotActive = false;
              this.arrivalComplete = true;

              // ENGAGE THE LATCH!
              this.warpLockout = true;
              console.log(
                "Arrival Complete. Engines locked until W is released.",
              );
            }
          } else if (distanceToTarget < dockingZone) {
            // --- STAGE 3: THE DOCKING CRAWL ---
            this.arrivalComplete = false;
            const crawlSpeed = this.maxWarpSpeed * 0.05;

            if (this.warpVelocity > crawlSpeed) {
              this.warpVelocity -= this.warpAcceleration * 8 * delta;
            } else {
              this.warpVelocity += this.warpAcceleration * delta;
              if (this.warpVelocity > crawlSpeed)
                this.warpVelocity = crawlSpeed;
            }
            this.velocity.multiplyScalar(0.85);
            thrust.z = -this.warpVelocity * delta;
          } else if (distanceToTarget < finalApproachZone) {
            // --- STAGE 2: FINAL APPROACH ---
            this.arrivalComplete = false;
            const approachSpeed = this.maxWarpSpeed * 0.1;

            if (this.warpVelocity > approachSpeed) {
              this.warpVelocity -= this.warpAcceleration * 5 * delta;
            } else {
              this.warpVelocity += this.warpAcceleration * delta;
              if (this.warpVelocity > approachSpeed)
                this.warpVelocity = approachSpeed;
            }
            this.velocity.multiplyScalar(0.9);
            thrust.z = -this.warpVelocity * delta;
          } else if (distanceToTarget < brakeZone) {
            // --- STAGE 1: DECELERATION CURVE ---
            this.arrivalComplete = false;
            const runway = distanceToTarget - finalApproachZone;
            const runwayPercentage = Math.max(
              0,
              runway / (brakeZone - finalApproachZone),
            );

            const coastSpeed = this.maxWarpSpeed * 0.2;
            const warpCeiling = Math.max(
              coastSpeed,
              runwayPercentage * this.maxWarpSpeed,
            );

            if (this.warpVelocity > warpCeiling) {
              this.warpVelocity -= this.warpAcceleration * 3 * delta;
            } else {
              this.warpVelocity += this.warpAcceleration * delta;
            }
            if (this.warpVelocity > warpCeiling)
              this.warpVelocity = warpCeiling;
            this.velocity.multiplyScalar(0.95);
            thrust.z = -this.warpVelocity * delta;
          } else {
            // --- STAGE 0: OPEN SPACE ---
            this.arrivalComplete = false;
            this.warpVelocity += this.warpAcceleration * delta;
            if (this.warpVelocity > this.maxWarpSpeed) {
              this.warpVelocity = this.maxWarpSpeed;
            }
            thrust.z = -this.warpVelocity * delta;
          }
        } else {
          // --- MANUAL MODE (No target) ---
          this.warpVelocity += this.warpAcceleration * delta;
          if (this.warpVelocity > this.maxWarpSpeed) {
            this.warpVelocity = this.maxWarpSpeed;
          }
          thrust.z = -this.warpVelocity * delta;
        }
      }
    } else {
      // --- 'W' RELEASED: GRACEFUL GLIDE ---
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
    // --- THE GLOBAL MATH PURIFIER ---
    // Cleans the 3D rotation matrix every frame so Waldo's bones don't break!
    this.mesh.quaternion.normalize();
  }
}
