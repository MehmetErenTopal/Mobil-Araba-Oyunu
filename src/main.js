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
    
    window.addEventListener('resize', this.onWindowResize.bind(this), false);

    this.animate();
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

  updateCamera() {
    if (!this.vehicle || !this.vehicle.mesh) return;

    // Follow camera logic
    const carPosition = this.vehicle.mesh.position;
    const carQuaternion = this.vehicle.mesh.quaternion;

    // Calculate desired camera position (behind and above the car)
    const cameraOffset = new THREE.Vector3(0, 3, -6);
    cameraOffset.applyQuaternion(carQuaternion);
    
    const desiredPosition = carPosition.clone().add(cameraOffset);

    // Smoothly interpolate camera position
    this.camera.position.lerp(desiredPosition, 0.1);

    // Look at a point slightly above the car
    const lookAtPos = carPosition.clone().add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(lookAtPos);
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
    }

    // Update camera
    this.updateCamera();

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
