import { Observable } from 'rx';
const R = require('ramda');

const accumulateHistory = R.curry((maxValues, previousHist, value) => {
  const trimmed = previousHist.length > maxValues ? R.drop(1, previousHist) : previousHist;
  return R.append(value, trimmed);
});

const main = () => {
  Observable.fromEvent(window, 'devicemotion')
    .map(R.prop('accelerationIncludingGravity'))
    .scan(accumulateHistory(20), [])
    .forEach(R.partial(console.log, ["Accels:"]));
};

main();
