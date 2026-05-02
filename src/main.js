import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Environment } from './Environment.js';
import { Vehicle } from './Vehicle.js';
import { Controls } from './Controls.js';

class Game {
  constructor() {
    this.initScene();
    this.initPhysics();
    
    this.controls = new Controls();
    this.environment = new Environment(this.scene, this.world);
    this.vehicle = new Vehicle(this.scene, this.world, this.controls);

    this.clock = new THREE.Clock();
    this.camDistance = 4;
    
    window.addEventListener('resize', this.onWindowResize.bind(this), false);

    this.initSettingsUI();

    this.animate();
  }

  initSettingsUI() {
    const btnSettings = document.getElementById('btn-settings');
    const modal = document.getElementById('settings-modal');
    const btnClose = document.getElementById('btn-close-settings');
    const distInput = document.getElementById('cam-dist');
    const distVal = document.getElementById('cam-dist-val');
    const speedInput = document.getElementById('max-speed');
    const speedVal = document.getElementById('max-speed-val');
    const accelInput = document.getElementById('accel-speed');
    const accelVal = document.getElementById('accel-speed-val');

    if(btnSettings) {
      btnSettings.addEventListener('click', () => modal.classList.remove('hidden'));
      btnClose.addEventListener('click', () => modal.classList.add('hidden'));

      distInput.addEventListener('input', (e) => {
        this.camDistance = parseFloat(e.target.value);
        distVal.innerText = this.camDistance;
      });

      speedInput.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        this.vehicle.maxSpeedKmH = speed;
        speedVal.innerText = speed;
      });

      accelInput.addEventListener('input', (e) => {
        const accel = parseFloat(e.target.value);
        this.vehicle.accelerationForce = accel;
        accelVal.innerText = accel;
      });
    }
  }

  initScene() {
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Camera will be updated in animate loop to follow car
    this.camera.position.set(0, 5, -10);

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  initPhysics() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81, 0),
    });
    // Set default material friction
    this.world.defaultContactMaterial.friction = 0.5;
  }

  updateCamera(dt) {
    if (!this.vehicle || !this.vehicle.mesh) return;

    const carPosition = this.vehicle.mesh.position;
    const euler = new THREE.Euler().setFromQuaternion(this.vehicle.mesh.quaternion, 'YXZ');
    
    // Kamera dönüş gecikmesi (Drift hissi)
    if (this.camYaw === undefined) this.camYaw = euler.y;
    let diff = euler.y - this.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.camYaw += diff * 5 * dt;

    const smoothQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw);

    // Temel kamera pozisyonu
    const cameraOffset = new THREE.Vector3(0, 2, -this.camDistance);
    cameraOffset.applyQuaternion(smoothQuat);
    
    // Hızlandıkça kameranın geriye yaslanması (Speed pullback)
    const speed = this.vehicle.chassisBody.velocity.length();
    const speedPullback = Math.min(speed * 0.04, 3);
    const pullBackOffset = new THREE.Vector3(0, 0, -speedPullback).applyQuaternion(smoothQuat);
    
    const desiredPosition = carPosition.clone().add(cameraOffset).add(pullBackOffset);

    // Yumuşak takip
    this.camera.position.lerp(desiredPosition, 15 * dt);

    // Hıza göre hafif yukarı bakma
    const lookAtPos = carPosition.clone().add(new THREE.Vector3(0, 1 + speed * 0.02, 0));
    
    if (!this.currentLookAt) this.currentLookAt = lookAtPos.clone();
    this.currentLookAt.lerp(lookAtPos, 20 * dt);
    
    this.camera.lookAt(this.currentLookAt);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const dt = this.clock.getDelta();

    // Step physics world
    this.world.step(1 / 60, dt, 3);

    // Update vehicle
    if (this.vehicle) {
      this.vehicle.update();
      this.environment.update(this.vehicle.mesh.position);
    }

    // Update camera with dt
    this.updateCamera(dt);

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
