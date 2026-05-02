import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Environment {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.textureLoader = new THREE.TextureLoader();

    this.initLighting();
    this.initGround();
    this.initCity();
  }

  initLighting() {
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 300);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
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
  }

  initGround() {
    // Kaplama yükle
    const groundTexture = this.textureLoader.load('/kaplamalar/zemin/asfalt.png', (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(100, 100); // 1000x1000 alanda 100 kere tekrar etsin
    }, undefined, () => {
      console.warn("Asfalt kaplaması bulunamadı, varsayılan renk kullanılacak.");
    });

    const groundGeo = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x555555, // Kaplama yoksa gri
      map: groundTexture,
      roughness: 0.9
    });
    
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Physics Ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 }); // static
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);
  }

  initCity() {
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    buildingGeo.translate(0, 0.5, 0); // Origin at bottom

    // Çatı ve Zemin için standart materyal
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // 3 Çeşit Bina Kaplaması (Ten, Mavi, Beyaz)
    const loadTex = (url) => {
      return this.textureLoader.load(url, undefined, undefined, () => {
        console.warn(`${url} bulunamadı.`);
      });
    };

    const textures = [
      { tex: loadTex('/kaplamalar/binalar/bina_ten.png'), color: 0xccbbaaa },
      { tex: loadTex('/kaplamalar/binalar/bina_mavi.png'), color: 0x4a86e8 },
      { tex: loadTex('/kaplamalar/binalar/bina_beyaz.png'), color: 0xdddddd }
    ];

    const numBuildings = 150;
    const citySize = 400;

    for (let i = 0; i < numBuildings; i++) {
      const width = Math.random() * 10 + 5;
      const height = Math.random() * 40 + 10;
      const depth = Math.random() * 10 + 5;
      
      const x = (Math.random() - 0.5) * citySize;
      const z = (Math.random() - 0.5) * citySize;

      if (Math.abs(x) < 20 && Math.abs(z) < 20) continue; // Spawn alanını boş bırak

      // Rastgele bir bina tarzı seç
      const style = textures[Math.floor(Math.random() * textures.length)];
      
      // Bu binaya özel kaplama tekrarı ayarlamak için dokuyu klonla
      let buildingSideMat;
      if (style.tex && style.tex.image) { // Eğer resim varsa
        const clonedTex = style.tex.clone();
        clonedTex.needsUpdate = true;
        clonedTex.wrapS = THREE.RepeatWrapping;
        clonedTex.wrapT = THREE.RepeatWrapping;
        // Örneğin her 4 birimde 1 pencere dokusu tekrar etsin
        const repeatX = Math.max(1, Math.round(width / 4));
        const repeatZ = Math.max(1, Math.round(depth / 4));
        const repeatY = Math.max(1, Math.round(height / 4));
        
        // Sağ-Sol yüzeyler için Z ve Y
        // Ön-Arka yüzeyler için X ve Y
        // BoxGeometry material indeksleri: 0: sağ, 1: sol, 2: üst, 3: alt, 4: ön, 5: arka
        const texSideX = clonedTex.clone();
        texSideX.needsUpdate = true;
        texSideX.repeat.set(repeatZ, repeatY);
        
        const texSideZ = clonedTex.clone();
        texSideZ.needsUpdate = true;
        texSideZ.repeat.set(repeatX, repeatY);

        const matSideX = new THREE.MeshStandardMaterial({ map: texSideX });
        const matSideZ = new THREE.MeshStandardMaterial({ map: texSideZ });

        buildingSideMat = [matSideX, matSideX, roofMat, roofMat, matSideZ, matSideZ];
      } else {
        // Kaplama yoksa sadece renk
        const colorMat = new THREE.MeshStandardMaterial({ color: style.color });
        buildingSideMat = [colorMat, colorMat, roofMat, roofMat, colorMat, colorMat];
      }

      const mesh = new THREE.Mesh(buildingGeo, buildingSideMat);
      mesh.scale.set(width, height, depth);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Physics
      const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(x, height / 2, z);
      this.world.addBody(body);
    }
  }
}
