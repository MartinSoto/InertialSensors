// Complementary filter for orientation.

import { Observable } from 'rx';
const R = require('ramda');
const THREE = require('three');


const makeOrientationStream = () => {
  // FIXME: Use the event inverval for this.
  const samplingPeriod = 1/60;

  const deviceMotionStream =
          Observable.fromEvent(window, 'devicemotion');

  const accelEventStream = deviceMotionStream
          .map(R.prop('accelerationIncludingGravity'));

  const accelVectorStream =
          accelEventStream
          .map((accelData) => new THREE.Vector3(
            accelData.x,
            accelData.y,
            accelData.z
          ));

  const rotationEventStream = deviceMotionStream
          .map(R.prop('rotationRate'));

  const rotationQuaternionStream =
          rotationEventStream
          .map((rot) => {
            let axis = new THREE.Vector3(rot.alpha, rot.beta, rot.gamma);
            let length = axis.length();
            axis.normalize();
            return new THREE.Quaternion().setFromAxisAngle(axis, length * samplingPeriod);
          });

  const estimatedOrientations =
          Observable
          .zip(accelVectorStream, rotationQuaternionStream)
          .scan(
            ([prevRot, prevAccel], [accel, rotStep]) => {
              let measuredGravity = accel.clone().multiplyScalar(-1).normalize();

              if (prevRot === null) {
                prevRot =
                  new THREE.Quaternion()
                  .setFromUnitVectors(new THREE.Vector3(0, 0, -1), measuredGravity)
                  .inverse();
              }
              if (prevAccel === null) {
                prevAccel = accel;
              }

              let currentRot = prevRot.clone().multiply(rotStep);

              let estimatedGravity =
                    new THREE.Vector3(0, 0, -1)
                    .applyQuaternion(currentRot.clone().inverse())
                    .normalize();

              let deltaAccel = new THREE.Quaternion()
                    .setFromUnitVectors(estimatedGravity, measuredGravity)
                    .inverse();

              let target = currentRot.clone().multiply(deltaAccel);

              let filteredRot = currentRot.slerp(target, 0.08);

              return [filteredRot, accel];
            },
            [null, null]
          )
          .map(([rot, accel]) => rot);

  return estimatedOrientations;
};


export {
  makeOrientationStream
}
