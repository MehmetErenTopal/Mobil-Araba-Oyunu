import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Environment {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.textureLoader = new THREE.TextureLoader();

    // Chunk System Variables
    this.chunkSize = 100;
    this.viewDistance = 2; // Kaç chunk ileriye/geriye renderlanacak
    this.loadedChunks = new Map();
    this.buildingsGroup = new THREE.Group();
    this.scene.add(this.buildingsGroup);

    this.initLighting();
    this.initGround();
    this.initCityMaterials();
  }

  initLighting() {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    // Yön ışığını aracın üzerine taşıyacağız ki gölgeler her zaman oluşsun
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);
    this.dirLight = dirLight;
  }

  initGround() {
    this.groundTexture = this.textureLoader.load(import.meta.env.BASE_URL + 'kaplamalar/zemin/asfalt.png', (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(100, 100);
    }, undefined, () => {
      console.warn("Asfalt kaplaması bulunamadı, varsayılan renk kullanılacak.");
    });

    const groundGeo = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x555555,
      map: this.groundTexture,
      roughness: 0.9
    });
    
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Fiziksel zemin (CANNON.Plane matematikte sonsuzdur)
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);
  }

  initCityMaterials() {
    this.buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    this.buildingGeo.translate(0, 0.5, 0);

    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    const loadTex = (url) => {
      return this.textureLoader.load(import.meta.env.BASE_URL + url, undefined, undefined, () => {
        console.warn(`${url} bulunamadı.`);
      });
    };

    this.buildingTextures = [
      { tex: loadTex('kaplamalar/binalar/bina_ten.png'), color: 0xccbbaaa },
      { tex: loadTex('kaplamalar/binalar/bina_mavi.png'), color: 0x4a86e8 },
      { tex: loadTex('kaplamalar/binalar/bina_beyaz.png'), color: 0xdddddd }
    ];
  }

  generateChunk(chunkX, chunkZ) {
    const chunkId = `${chunkX},${chunkZ}`;
    if (this.loadedChunks.has(chunkId)) return;

    const chunkData = {
      meshes: [],
      bodies: []
    };

    const numBuildings = 10; // Her chunk'ta ortalama bina sayısı
    
    // Seed based on chunk coordinate to keep buildings in the exact same place if we return
    // Simple pseudo-random using chunk coords
    const seededRandom = (x, z, i) => {
      let seed = x * 374761393 + z * 668265263 + i * 12345;
      seed = (seed ^ (seed >> 13)) * 1274126177;
      return ((seed ^ (seed >> 16)) >>> 0) / 4294967296;
    };

    for (let i = 0; i < numBuildings; i++) {
      const x = chunkX * this.chunkSize + (seededRandom(chunkX, chunkZ, i) - 0.5) * this.chunkSize;
      const z = chunkZ * this.chunkSize + (seededRandom(chunkX, chunkZ, i + 100) - 0.5) * this.chunkSize;

      // Orijinde doğma noktasına bina koyma
      if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;

      const width = seededRandom(chunkX, chunkZ, i + 200) * 10 + 5;
      const height = seededRandom(chunkX, chunkZ, i + 300) * 40 + 10;
      const depth = seededRandom(chunkX, chunkZ, i + 400) * 10 + 5;

      const styleIndex = Math.floor(seededRandom(chunkX, chunkZ, i + 500) * this.buildingTextures.length);
      const style = this.buildingTextures[styleIndex];
      
      const clonedTex = style.tex.clone();
      clonedTex.needsUpdate = true;
      clonedTex.wrapS = THREE.RepeatWrapping;
      clonedTex.wrapT = THREE.RepeatWrapping;
      
      const repeatX = Math.max(1, Math.round(width / 4));
      const repeatZ = Math.max(1, Math.round(depth / 4));
      const repeatY = Math.max(1, Math.round(height / 4));
      
      const texSideX = clonedTex.clone();
      texSideX.repeat.set(repeatZ, repeatY);
      
      const texSideZ = clonedTex.clone();
      texSideZ.repeat.set(repeatX, repeatY);

      const matSideX = new THREE.MeshStandardMaterial({ map: texSideX, color: style.color });
      const matSideZ = new THREE.MeshStandardMaterial({ map: texSideZ, color: style.color });

      const buildingSideMat = [matSideX, matSideX, this.roofMat, this.roofMat, matSideZ, matSideZ];

      const mesh = new THREE.Mesh(this.buildingGeo, buildingSideMat);
      mesh.scale.set(width, height, depth);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.buildingsGroup.add(mesh);
      chunkData.meshes.push(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(x, height / 2, z);
      this.world.addBody(body);
      chunkData.bodies.push(body);
    }

    this.loadedChunks.set(chunkId, chunkData);
  }

  unloadChunk(chunkId) {
    const chunkData = this.loadedChunks.get(chunkId);
    if (chunkData) {
      chunkData.meshes.forEach(mesh => {
        this.buildingsGroup.remove(mesh);
        // Bellek temizliği
        if(Array.isArray(mesh.material)){
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
      });
      chunkData.bodies.forEach(body => {
        this.world.removeBody(body);
      });
      this.loadedChunks.delete(chunkId);
    }
  }

  update(playerPosition) {
    // Görsel zemin aracın altında kayar ama dokusu offsetlenerek sabit kalmış hissi verir
    this.groundMesh.position.x = playerPosition.x;
    this.groundMesh.position.z = playerPosition.z;
    if(this.groundTexture) {
       this.groundTexture.offset.x = playerPosition.x / 10;
       this.groundTexture.offset.y = -playerPosition.z / 10;
    }

    // Gölgelerin doğru çalışması için Işığı aracın üstüne sabitle
    this.dirLight.position.x = playerPosition.x + 100;
    this.dirLight.position.z = playerPosition.z + 50;

    // Bulunulan Chunk
    const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
    const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);

    // Yüklenmesi gereken chunkları belirle
    const neededChunks = new Set();
    for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
      for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
        neededChunks.add(`${currentChunkX + x},${currentChunkZ + z}`);
        this.generateChunk(currentChunkX + x, currentChunkZ + z);
      }
    }

    // Uzakta kalan chunkları sil
    for (const chunkId of this.loadedChunks.keys()) {
      if (!neededChunks.has(chunkId)) {
        this.unloadChunk(chunkId);
      }
    }
  }
}
