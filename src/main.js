const d3 = require('d3');
import { Observable } from 'rx';
const R = require('ramda');

const accumulateHistory = R.curry((maxValues, previousHist, value) => {
  const trimmed = previousHist.length > maxValues ? R.drop(1, previousHist) : previousHist;
  return R.append(value, trimmed);
});

const main = () => {
  Observable.fromEvent(window, 'devicemotion')
    .map(R.prop('accelerationIncludingGravity'))
    .scan(accumulateHistory(20), []);
  //.forEach(R.partial(console.log, ["Accels:"]));

  let data = [3, 6, 2, 7, 5, 2, 1, 3, 8, 9, 2, 5, 7],
      w = 400,
      h = 200;

  let x = d3.scaleLinear().domain([0, data.length]).range([0, w]),
      y = d3.scaleLinear().domain([0, d3.max(data)]).range([0, h]);

  let line = d3.line()
        .x((d, i) => x(i))
        .y(y);

  let chart = d3
        .select('#chart')
        .append("svg:svg")
        .attr("width", w)
        .attr("height", h);

  chart.append("path")
    .datum(data)
    .attr("class", "line")
    .attr("d", line);
};

main();
