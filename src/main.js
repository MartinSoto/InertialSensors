const d3 = require('d3');
import { Observable } from 'rx';
const R = require('ramda');
const THREE = require('three');


const vectorNorm = (vector) =>
        Math.sqrt(vector.x * vector.x
                  + vector.y * vector.y
                  + vector.z * vector.z);

const cheapLowPass = R.curry((alpha, stream) => {
  return stream
    .scan((prevY, x) => alpha * prevY + (1 - alpha) * x);
});

const cheapHighPass = R.curry((alpha, stream) => {
  return stream
    .scan(
      ([prevX, prevY], x) => [x, alpha * (prevY + x - prevX)],
      [0, 0])
    .map(R.nth(1));
});


const accumulateHistory = R.curry((maxValues, previousHist, value) => {
  const trimmed = previousHist.length > maxValues ? R.drop(1, previousHist) : previousHist;
  return R.append(value, trimmed);
});

const integrate = R.curry((interval, currentValue, newSample) => {
  return currentValue + interval * newSample;
});


const lineChart = (parentElem, numSamples, maxDomainValue) => {
  const w = window.innerWidth * .9,
        h = 400;
  const margin = 30;

  const scaleX = d3.scaleLinear().domain([0, numSamples]).range([0, w]),
        scaleY = d3.scaleLinear().domain([-maxDomainValue, maxDomainValue]).range([h, 0]);

  let axisX = d3
        .axisBottom(scaleX)
        .ticks(6),
      axisY = d3
        .axisLeft(scaleY)
        .ticks(10);

  let svg = parentElem
        .append("svg:svg")
        .attr("width", w + 2 * margin)
        .attr("height", h + 2 * margin);

  let chart = svg.append("g")
        .attr("transform", `translate(${margin}, ${margin})`);

  chart.append('g')
    .attr("transform", `translate(0, ${h/2})`)
    .call(axisX);
  chart.append('g')
    .call(axisY);

  return {
    elem: svg,

    streamAsLine: R.curry((cssClass, stream) => {
      let line = d3.line()
            .x((sample, i) => scaleX(i))
            .y(scaleY);
      let linePath = chart.append("path")
            .attr("class", cssClass);

      stream
        .scan(accumulateHistory(numSamples), [])
        .forEach((data) => {
          linePath.datum(data).attr("d", line);
        });
    })
  };
};


const main = () => {
  const dimensions = ['x', 'y', 'z'];

  const numSamples = 60;
  const samplingPeriod = 1/60;


  const deviceMotionStream =
          Observable.fromEvent(window, 'devicemotion');


  const accelChart = lineChart(d3.select('#accelChart'), numSamples, 15);

  const accelEventStream = deviceMotionStream
          .map(R.prop('accelerationIncludingGravity'));

  const accelVectorStream =
          accelEventStream
          .map((accelData) => new THREE.Vector3(
            accelData.x,
            accelData.y,
            accelData.z
          ));

  const accelStreams = dimensions.map(
    (dimName) => accelEventStream.map(R.prop(dimName))
  );

  accelStreams.forEach((stream, i) => {
    stream
      .letBind(cheapLowPass(0.926))
      .letBind(accelChart.streamAsLine(`line${R.toUpper(dimensions[i])}`));
  });

  const normStream = accelEventStream
          .map(vectorNorm);
  normStream.letBind(accelChart.streamAsLine('lineNorm'));

  let normElem = d3
        .select("#normValue");
  normStream.forEach((value) => {
    normElem.text(d3.format(".4")(value));
  });

  const zeroSpeedStream = normStream
          .letBind(cheapHighPass(0.926))
          .map((a) => Math.abs(a) < 0.01 ? 1 : 0);
  zeroSpeedStream.letBind(accelChart.streamAsLine('lineZeroSpeed'));


  const speedChart = lineChart(d3.select('#speedChart'), numSamples, 3);

  const speedStreams = accelStreams.map((accelStream) => {
    return accelStream
      .scan(integrate(samplingPeriod), 0);
  });

  speedStreams.forEach((speedStream, i) => {
    speedStream
      .letBind(speedChart.streamAsLine(`line${R.toUpper(dimensions[i])}`));
  });


  const rotationEventStream = deviceMotionStream
          .map(R.prop('rotationRate'));

  const degToRad = (degs) => degs * Math.PI / 180;
  const radToDeg = (rads) => rads * 180 / Math.PI;

  // These are "vector" quaternions corresponding to the angular
  // velocity.
  const rotationQuaternionStream =
          rotationEventStream
          .map((rot) => {
            let axis = new THREE.Vector3(rot.alpha, rot.beta, rot.gamma);
            let length = axis.length();
            axis.normalize();
            return new THREE.Quaternion().setFromAxisAngle(axis, length * samplingPeriod);
          });

  // //deviceMotionStream.map(R.prop('interval')).forEach((it) => console.log("int", it));
  // rotationEventStream.forEach((e) => console.log("ev", {
  //   alpha: e.alpha * samplingPeriod,
  //   beta: e.beta * samplingPeriod,
  //   gamma: e.gamma * samplingPeriod
  // }));
  // rotationQuaternionStream.forEach((q) => console.log("ang", new THREE.Euler().setFromQuaternion(q, 'YXZ')));

  const estimatedOrientations =
          Observable
          .zip(accelVectorStream, rotationQuaternionStream)
          .scan(
            ([prevRot, prevAccel, prevBias], [accel, rotStep]) => {
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

              let accelBias = accelerometerBias(prevAccel, accel, rotStep);

              return [filteredRot, accel, accelBias];
            },
            [null, null, new THREE.Vector3()]
          );

  const biasFactor = (rot) => {
    let qx = rot.x, qy = rot.y, qz = rot.z, qw = rot.w;
    return new THREE.Matrix3().set(
      1 - (1 - 2*qy*qy - 2*qz*qz),
      2*qx*qy - 2*qz*qw,
      2*qx*qz + 2*qy*qw,

      2*qx*qy + 2*qz*qw,
      1 - (1 - 2*qx*qx - 2*qz*qz),
      2*qy*qz - 2*qx*qw,

      2*qx*qz - 2*qy*qw,
      2*qy*qz + 2*qx*qw,
      1 - (1 - 2*qx*qx - 2*qy*qy)
    );
  };

  const transformFromQuaternion = (rot) => {
    let qx = rot.x, qy = rot.y, qz = rot.z, qw = rot.w;
    return new THREE.Matrix3().set(
      (1 - 2*qy*qy - 2*qz*qz),
      2*qx*qy - 2*qz*qw,
      2*qx*qz + 2*qy*qw,

      2*qx*qy + 2*qz*qw,
      (1 - 2*qx*qx - 2*qz*qz),
      2*qy*qz - 2*qx*qw,

      2*qx*qz - 2*qy*qw,
      2*qy*qz + 2*qx*qw,
      (1 - 2*qx*qx - 2*qy*qy)
    );
  };

  const accelerometerBias = (prevAccel, accel, rotStep) => {
    let rotStepInv = rotStep.clone().inverse();

    let deltaAccel = accel.clone().sub(prevAccel.clone().applyQuaternion(rotStepInv));
    console.log(deltaAccel);

    let factor = biasFactor(rotStepInv);
    let det = factor.determinant();
    if (det < 0.01) {
      return null;
    }

    let bias = deltaAccel.clone().applyMatrix3(new THREE.Matrix3().getInverse(factor));
    console.log(new THREE.Euler().setFromQuaternion(rotStep, 'YXZ'), det, deltaAccel, bias);

    return bias;
  };

  const accelBiasStream =
          Observable
          .zip(accelVectorStream, rotationQuaternionStream)
          .scan(
            ([prevAccel, prevTotalRot], [accel, rotStep]) => {
              return [
                accel,
                prevTotalRot.clone().multiply(rotStep)
              ];
            },
            [new THREE.Vector3(), new THREE.Quaternion()]
          )
          .scan(accumulateHistory(10), [])
          .map((data) => {
            let [prevAccel, prevTotalRot] = data[0];
            let [accel, totalRot] = data[data.length - 1];

            let rotStep = prevTotalRot.clone().inverse().multiply(totalRot);
            return accelerometerBias(prevAccel, accel, rotStep);
          })
          .filter((b) => b !== null);


  const xtotalRotationAnglesStream =
          //totalRotationQuaternionStream
          estimatedOrientations.map(R.nth(0))
          .map((quaternion) => new THREE.Euler().setFromQuaternion(quaternion, 'YXZ'));

  const xxtotalRotationAnglesStream =
          estimatedOrientations
          .map(R.nth(2))
          .filter((b) => b !== null);

  const totalRotationAnglesStream =
          accelBiasStream;

  const totalRotationStreams = dimensions.map(
    (dimName) => totalRotationAnglesStream.map(R.prop(dimName))
  );

  const rotationChart = lineChart(d3.select('#rotationChart'), numSamples, 5);

  totalRotationStreams.forEach((totalRotationStream, i) => {
    totalRotationStream
      .letBind(rotationChart.streamAsLine(`line${R.toUpper(dimensions[i])}`));
  });

};

main();







