const d3 = require('d3');
import { Observable } from 'rx';
const R = require('ramda');


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


const lineChart = (parentElem, numSamples) => {
  const w = window.innerWidth * .9,
        h = 400;
  const margin = 20;

  const scaleX = d3.scaleLinear().domain([0, numSamples]).range([0, w]),
        scaleY = d3.scaleLinear().domain([10, -10]).range([0, h]);

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

  const accelChart = lineChart(d3.select('#accelChart'), numSamples);

  const accelEventStream =
          Observable.fromEvent(window, 'devicemotion')
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
          .map(vectorNorm)
          .letBind(cheapHighPass(0.926))
          .map((v) => Math.abs(v) > 0.01 ? 1 : 0);

  normStream.letBind(accelChart.streamAsLine('lineNorm'));

  let normElem = d3
        .select("#normValue");

  normStream.forEach((value) => {
    normElem.text(value);
  });
};

main();
