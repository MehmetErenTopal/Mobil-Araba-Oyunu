import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Vehicle {
  constructor(scene, world, controls) {
    this.scene = scene;
    this.world = world;
    this.controls = controls;
    
    // Default settings
    this.maxForce = 20000;
    this.turnSpeed = 2.0;

    this.mesh = new THREE.Group();
    // Temporary box until model loads (Larger size)
    const geometry = new THREE.BoxGeometry(3, 1.5, 6);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00, wireframe: true });
    this.fallbackMesh = new THREE.Mesh(geometry, material);
    this.mesh.add(this.fallbackMesh);
    
    this.scene.add(this.mesh);

    this.initPhysics();
    this.loadModel();
  }

  initPhysics() {
    // Chassis Body (Larger hitbox)
    const shape = new CANNON.Box(new CANNON.Vec3(1.5, 0.75, 3));
    this.chassisBody = new CANNON.Body({ mass: 2000 });
    this.chassisBody.addShape(shape);
    this.chassisBody.position.set(0, 5, 0);
    this.chassisBody.angularDamping = 0.9;
    this.chassisBody.linearDamping = 0.5; // High damping for hover feel

    // Raycast Vehicle (Hover Mechanics)
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0, // x
      indexUpAxis: 1,    // y
      indexForwardAxis: 2 // z
    });

    const options = {
      radius: 0.5,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 30,
      suspensionRestLength: 1.5, // Hover height
      frictionSlip: 5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
      maxSuspensionTravel: 1,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    // Add 4 invisible wheels for the hover suspension (Adjusted to new larger size)
    options.chassisConnectionPointLocal.set(1.5, -0.2, -2.5);
    this.vehicle.addWheel(options);

    options.chassisConnectionPointLocal.set(-1.5, -0.2, -2.5);
    this.vehicle.addWheel(options);

    options.chassisConnectionPointLocal.set(1.5, -0.2, 2.5);
    this.vehicle.addWheel(options);

    options.chassisConnectionPointLocal.set(-1.5, -0.2, 2.5);
    this.vehicle.addWheel(options);

    this.vehicle.addToWorld(this.world);

    // Wheel bodies for friction
    const wheelBodies = [];
    const wheelMaterial = new CANNON.Material('wheel');
    this.vehicle.wheelInfos.forEach((wheel) => {
      const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
      const wheelBody = new CANNON.Body({ mass: 0, material: wheelMaterial });
      wheelBody.type = CANNON.Body.KINEMATIC;
      wheelBody.collisionFilterGroup = 0; // Don't collide
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
      wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
      wheelBodies.push(wheelBody);
      this.world.addBody(wheelBody);
    });

    // Update wheels position
    this.world.addEventListener('postStep', () => {
      for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        this.vehicle.updateWheelTransform(i);
        const t = this.vehicle.wheelInfos[i].worldTransform;
        wheelBodies[i].position.copy(t.position);
        wheelBodies[i].quaternion.copy(t.quaternion);
      }
    });
  }

  loadModel() {
    const loader = new GLTFLoader();
    // Modeller klasöründeki glb dosyasını yüklemeye çalış
    // Kullanıcı modeli buraya koyacak: public/modeller/car.glb
    loader.load(
      import.meta.env.BASE_URL + 'modeller/car.glb',
      (gltf) => {
        // Fallback mesh'i kaldır
        this.mesh.remove(this.fallbackMesh);
        
        const model = gltf.scene;
        
        // Modeli hitbox'a tam sığacak şekilde dinamik olarak boyutlandır
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // Hitbox'ın uzunluğu 6 birim. Modelin uzunluğunu (Z) 6'ya eşitleyecek çarpanı bul:
        const scaleFactor = 6 / size.z;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        model.position.set(0, -0.75, 0); // Fiziğe göre alt kısıma hizala
        
        // Gölgeleri aç
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mesh.add(model);
        console.log('Araç modeli yüklendi!');
        
        // Yükleme ekranını gizle
        const loadingScreen = document.getElementById('loading-screen');
        if(loadingScreen) loadingScreen.classList.remove('active');
      },
      undefined,
      (error) => {
        console.warn('car.glb bulunamadı, varsayılan kutu kullanılacak. Lütfen public/modeller/car.glb yoluna modelinizi ekleyin.', error);
        const loadingScreen = document.getElementById('loading-screen');
        if(loadingScreen) loadingScreen.classList.remove('active');
      }
    );
  }

  update() {
    // Engine and Steering Logic
    const brakeForce = 150; // Hover car might have less braking
    
    // Tank/Drone tarzı dönüş (Direkt kendi ekseninde dönme)
    let turnVal = 0;
    if (this.controls.keys.left) turnVal = this.turnSpeed;
    else if (this.controls.keys.right) turnVal = -this.turnSpeed;
    
    // RaycastVehicle'ın direksiyonunu iptal et
    this.vehicle.setSteeringValue(0, 0);
    this.vehicle.setSteeringValue(0, 1);
    
    // Direkt y ekseninde döndür
    this.chassisBody.angularVelocity.y = turnVal;

    // Gas & Brake
    let engineForce = 0;

    if (this.controls.keys.forward) {
      engineForce = -this.maxForce;
    } else if (this.controls.keys.backward) {
      engineForce = this.maxForce;
    }

    // Apply forces
    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);
    
    // Update mesh position
    this.mesh.position.copy(this.chassisBody.position);
    this.mesh.quaternion.copy(this.chassisBody.quaternion);

    // Update Speedometer UI
    const speed = this.chassisBody.velocity.length() * 3.6; // m/s to km/h
    const speedEl = document.getElementById('speedometer');
    if(speedEl) speedEl.innerText = `${Math.round(speed)} km/h`;
  }
}
