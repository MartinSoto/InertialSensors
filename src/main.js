import { Observable } from 'rx';
const R = require('ramda');

const main = () => {
  Observable.fromEvent(window, 'devicemotion')
    .map(R.prop('accelerationIncludingGravity'))
    .forEach(R.partial(console.log, ["Accel:"]));
};

main();
