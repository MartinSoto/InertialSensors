const d3 = require('d3');
import { Observable } from 'rx';
const R = require('ramda');

const accumulateHistory = R.curry((maxValues, previousHist, value) => {
  const trimmed = previousHist.length > maxValues ? R.drop(1, previousHist) : previousHist;
  return R.append(value, trimmed);
});

const main = () => {
  const numSamples = 60;

  const w = window.innerHeight * .9,
        h = 400;
  const margin = 20;

  const x = d3.scaleLinear().domain([0, numSamples]).range([0, w]),
        y = d3.scaleLinear().domain([-10, 10]).range([0, h]);

  let axisX = d3
        .axisBottom(x)
        .ticks(6),
      axisY = d3
        .axisLeft(y)
        .ticks(10);

  let svg = d3
        .select('#chart')
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

  const accelStream =
          Observable.fromEvent(window, 'devicemotion')
          .map(R.prop('accelerationIncludingGravity'));

  ['x', 'y', 'z'].forEach((axisName) => {
    let line = d3.line()
          .x((sample, i) => x(i))
          .y(y);
    let linePath = chart.append("path")
          .attr("class", "line" + R.toUpper(axisName));

    accelStream
      .map(R.prop(axisName))
      .scan(accumulateHistory(numSamples), [])
      .forEach((data) => {
        linePath.datum(data).attr("d", line);
      });
  });
};

main();
