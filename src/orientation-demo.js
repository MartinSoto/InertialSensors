const THREE = require('three');

import { makeOrientationStream } from "./orientation.js";


const buildScene = () => {
  let scene = new THREE.Scene();

  let camera = new THREE.PerspectiveCamera(75, 4/3, 0.1, 1000);
  camera.position.set(0, 1.50, 0);
  camera.matrixAutoUpdate = false;
  scene.add(camera);

  let room = new THREE.Object3D();
  scene.add(room);

  let walls = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 10),
    new THREE.MeshLambertMaterial({
      color: 0x10823a,
      wireframe: false,
      side: THREE.DoubleSide
    })
  );
  walls.position.y = 1.4;
  room.add(walls);

  let ground = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15, 8, 8),
    new THREE.MeshLambertMaterial({
      color: 0xcfcfcf,
      wireframe: false,
      side: THREE.DoubleSide
    })
  );
  ground.rotation.x = -Math.PI / 2;
  room.add(ground);

  let light1 = new THREE.PointLight(0x404040);
  light1.position.set(1, 2.7, 2);
  room.add(light1);

  let light2 = new THREE.AmbientLight(0x202020, 7.00);
  room.add(light2);

  return {
    scene,
    camera
  };
}

const orientationDemo = () => {
  let renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(0xffffff);
  renderer.setSize(640, 480);
  document.getElementById('scene').appendChild(renderer.domElement);

  let { scene, camera } = buildScene();

  const initialOrientation =
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ')
          );

  makeOrientationStream()
    .forEach((orientation) => {
      let translation = new THREE.Vector3(),
          oldOrientation = new THREE.Quaternion(),
          scale = new THREE.Vector3();
      camera.matrix.decompose(translation, oldOrientation, scale);
      camera.matrix.compose(
        translation,
        initialOrientation.clone().multiply(orientation),
        scale);
    });

  const paint = () => {
    renderer.render(scene, camera);
    requestAnimationFrame(paint);
  };
  paint();
};


window.orientationDemo = orientationDemo;













