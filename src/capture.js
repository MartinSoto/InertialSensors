// Data capture for further analysis and simulation.

const d3 = require('d3');
import { Observable } from 'rx';


const capture = () => {
  Observable
    .fromEvent(window, 'devicemotion')
    .skipUntil(
      Observable
        .fromEvent(d3.select('#start').node(), 'click')
        .map(() => {
          d3.select('#start').remove();
          d3.select('#stop').attr('style', '');
          return true;
        })
    )
    .takeUntil(
      Observable
        .fromEvent(d3.select('#stop').node(), 'click')
        .map(() => {
          d3.select('#stop').remove();
          return true;
        })
    )
    .map(
      (ev) => {
        let accel = ev.accelerationIncludingGravity,
            rot = ev.rotationRate;

        return {
          accelerationIncludingGravity: {
            x: accel.x,
            y: accel.y,
            z: accel.z
          },
          rotationRate: {
            alpha: rot.alpha,
            beta: rot.beta,
            gamma: rot.gamma
          },
          interval: ev.interval
        };
      }
    )
    .bufferWithCount(30)
    .scan(([prevBuffer, prevBufferPos, curPos], buffer) => {
      return [buffer, curPos, curPos + buffer.length];
    }, [null, null, 0])
    .flatMap(([events, position]) => {
      return fetch('/api/data', {
        method: 'PUT',
        body: JSON.stringify({
          events,
          position
        }),
        headers: new Headers({
          "Content-Type": "application/json"
        })
      });
    })
    .reduce((prevCount, response) => {
      return prevCount + response.json().count;
    }, 0)
    .flatMap((totalCount) => {
      return fetch('/api/close', {
        method: 'PUT',
        body: JSON.stringify({
          totalCount
        }),
        headers: new Headers({
          "Content-Type": "application/json"
        })
      });
    })
    .forEach((response) => {
      console.log(response);
    });
};


window.capture = capture;
