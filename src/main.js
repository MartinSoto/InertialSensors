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


  const rotationChart = lineChart(d3.select('#rotationChart'), numSamples, 185);

  const rotationEventStream = deviceMotionStream
          .map(R.prop('rotationRate'));

  const degToRad = (degs) => degs * Math.PI / 180;
  const radToDeg = (rads) => rads * 180 / Math.PI;

  // These are "vector" quaternions corresponding to the angular
  // velocity.
  const rotationQuaternionStream =
          rotationEventStream
          .map((rot) => new THREE.Quaternion(rot.alpha, rot.beta, rot.gamma, 0));

  const totalRotationQuaternionStream =
          rotationQuaternionStream
          .scan(
            (totalRotation, rotationStep) => {
              // Quaternion integration procedure from angular velocity.
              //
              // Clumsy because three.js lacks a full implementation of
              // quaternion arithmetic.
              let stepTerm = rotationStep.clone().multiply(totalRotation);
              let timeFactor = samplingPeriod / 2;
              return new THREE.Quaternion(
                totalRotation.x + timeFactor * stepTerm.x,
                totalRotation.y + timeFactor * stepTerm.y,
                totalRotation.z + timeFactor * stepTerm.z,
                totalRotation.w + timeFactor * stepTerm.w
              ).normalize();
            },
            new THREE.Quaternion()
          );

  const totalRotationAnglesStream =
          totalRotationQuaternionStream
          .map((quaternion) => new THREE.Euler().setFromQuaternion(quaternion, 'ZXY'));

  const totalRotationStreams = dimensions.map(
    (dimName) => totalRotationAnglesStream.map(R.prop(dimName))
  );

  totalRotationStreams.forEach((totalRotationStream, i) => {
    totalRotationStream
      .map(radToDeg)
      .letBind(rotationChart.streamAsLine(`line${R.toUpper(dimensions[i])}`));
  });

};

main();







