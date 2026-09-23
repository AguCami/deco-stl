import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MeshData } from './geometry/mesh';

/** Vista 3D con eje Z hacia arriba, como una cama de impresión. */
export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  private controls: OrbitControls;
  private material = new THREE.MeshStandardMaterial({ color: 0xd9c7a7, roughness: 0.55, metalness: 0.05 });
  private mesh: THREE.Mesh | null = null;
  private bed: THREE.Group;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;

    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(260, -320, 220);

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(150, -200, 400);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -250, right: 250, top: 250, bottom: -250, near: 10, far: 1200 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    this.bed = this.buildBed();
    this.scene.add(this.bed);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 60);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private buildBed(): THREE.Group {
    const g = new THREE.Group();
    const size = 260;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.ShadowMaterial({ opacity: 0.18 }),
    );
    plate.receiveShadow = true;
    g.add(plate);
    const grid = new THREE.GridHelper(size, 26, 0x8a8f98, 0x8a8f98);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.05;
    const mat = grid.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = 0.25;
    g.add(grid);
    return g;
  }

  setMesh(data: MeshData): void {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    // Normales suaves salvo en aristas marcadas (bordes, facetas).
    geo = toCreasedNormals(geo, (35 * Math.PI) / 180);

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
    } else {
      this.mesh = new THREE.Mesh(geo, this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    }
  }

  setColor(hex: string): void {
    this.material.color.set(hex);
  }

  /** Encuadra la pieza actual. */
  frame(): void {
    if (!this.mesh) return;
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
    const sphere = this.mesh.geometry.boundingSphere!;
    const size = this.mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
    const flat = size.z < 0.25 * Math.max(size.x, size.y);
    const dist = (sphere.radius / Math.sin((this.camera.fov * Math.PI) / 360)) * (flat ? 1.25 : 1.45);
    // Piezas planas (posavasos, paneles) se ven mejor desde más arriba.
    const dir = (flat ? new THREE.Vector3(0.3, -0.55, 0.8) : new THREE.Vector3(0.55, -0.7, 0.45)).normalize();
    this.controls.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).addScaledVector(dir, dist);
    this.bed.scale.setScalar(Math.max(0.5, sphere.radius / 110));
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
