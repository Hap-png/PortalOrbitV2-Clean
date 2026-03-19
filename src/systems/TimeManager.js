export class TimeManager {
  constructor() {
    // --- REAL-WORLD ASTRONOMY CONSTANTS ---
    this.J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
    this.MS_PER_DAY = 86400000;

    // The Master Clock
    this.simTimeMs = Date.now();

    // --- WARP SETTINGS ---
    this.timeWarp = 1;
    this.baseDay = 86400;     // 1 day per second
    this.warpMultiplier = 1;  // Our "Gear" (1-9)
    
    // Initial goals (1 day/sec)
    this.fastForwardSpeed = this.baseDay; 
    this.rewindSpeed = -this.baseDay;

    this.isPaused = false;
    this.keys = {};

    // Keyboard Listeners
    window.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
      if (e.key.toLowerCase() === "n") {
        this.simTimeMs = Date.now();
        this.updateUI();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
    });
  }

  // --- THE GEAR SHIFTER ---
  // Called by main.js when you press numbers 1-9
  updateWarpSpeed(multiplier) {
    this.warpMultiplier = multiplier;
    this.fastForwardSpeed = this.baseDay * this.warpMultiplier;
    this.rewindSpeed = -(this.baseDay * this.warpMultiplier);
    console.log(`Warp Gear set to: ${multiplier} days/sec`);
  }

  // --- CALLED EVERY FRAME BY main.js ---
  update(delta) {
    if (this.isPaused) return;

    // 1. Momentary Warp Logic with Smooth Easing!
    if (this.keys["]"]) {
      // Standard Fast Forward
      this.timeWarp += (this.fastForwardSpeed - this.timeWarp) * 0.05;
    } else if (this.keys["/"]) {
      // PLANET OBSERVATION SPEED (The / key)
      // Runs at 20% of your current gear speed for a smooth, slow roll
      this.timeWarp += ((this.fastForwardSpeed * 0.2) - this.timeWarp) * 0.05;
    } else if (this.keys["["]) {
      // Standard Rewind
      this.timeWarp += (this.rewindSpeed - this.timeWarp) * 0.05;
    } else {
      // Smoothly decelerate back to normal 1:1 time
      this.timeWarp += (1 - this.timeWarp) * 0.1;
    }

    // 2. Step the clock forward
    this.simTimeMs += delta * 1000 * this.timeWarp;

    this.updateUI();
  }

  getDaysSinceJ2000() {
    return (this.simTimeMs - this.J2000_UTC_MS) / this.MS_PER_DAY;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.updateUI();
  }

  updateUI() {
    const statusEl = document.getElementById("status");
    if (statusEl) {
      const simDate = new Date(this.simTimeMs);
      const dateString = simDate.toLocaleDateString("sv-SE"); // YYYY-MM-DD
      const timeString = simDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let warpText = "Real Time";
      if (this.timeWarp > 1.5) warpText = `FAST FORWARD (x${this.warpMultiplier})`;
      if (this.timeWarp < -0.5) warpText = `REWIND (x${this.warpMultiplier})`;

      statusEl.innerText = `Date: ${dateString} ${timeString} | ${warpText}`;
    }
  }
}