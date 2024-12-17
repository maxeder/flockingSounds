import {vec2} from 'gl-matrix';

// an container of parameters to control:
let params = {
  speed_limit: 0.8,
  acceleration_limit: 0.1,
  collision_distance: 30,
  collision_factor: 700,
  wander_factor: 200,
  antitarget_factor: 400000,
  field_of_view: 2.5,
  cohesion_factor: 5,
  alignment_factor: 150,
  number_boids: 30,
  trailMaxLength: 2200,
  target: false,
  windFactor: 1,
  trailOpacity: 0.5,
  boidOpacity: 0.8,
  fadingSpeed: 0.02,
  populationOverflow: 10
};

let windSpeed,
  windDirection,
  temp,
  hueRotation,
  windSpeedFactor = 1;

let lineColor = "#0E0AAF";

let windVector;
let frameCount = 0;

// there is a canvas
const canvas = document.getElementById("mycanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;

const dpr = window.devicePixelRatio;
const rect = canvas.getBoundingClientRect();

// Set the "actual" size of the canvas
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;

// Scale the context to ensure correct drawing operations
ctx.scale(dpr, dpr);

// Set the "drawn" size of the canvas
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;


let target = [canvas.width / 10, canvas.height / 10];


const ws = new WebSocket('ws://localhost:8090');


let agents = [];

// Init Agents
for (let i = 0; i < params.number_boids; i++) {
  let agent = {
    // pos: [Math.random() * canvas.width, Math.random() * canvas.height],
    pos: [canvas.width, 0],
    orient: Math.random() * 2 * Math.PI,
    vel: [0, 0],
    acc: [0, 0],
    trail: [],
    opacity: params.boidOpacity,
    windEffect: Math.random(),
    fading: false
  };
  agents.push(agent);
}



// WEATHER

async function getWindData(city) {
  const apiKey = 'XXX'; // Replace with your OpenWeather API key
  const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
          throw new Error('Failed to fetch data');
      }
      const data = await response.json();

      // Extract wind speed and direction
      windSpeed = data.wind.speed; // Wind speed in m/s
      windDirection = data.wind.deg; // Wind direction in degrees


      // windVector = p5.Vector.fromAngle(radians(windDirection)).mult(windSpeed * windSpeedFactor);

      temp = data.main.temp;
      // let clampedHue = Math.max(-5, Math.min(20, temp));
      // // Map the range -5 to 20 to 0° to 360°
      // hueRotation = ((clampedHue + 5) / 25) * 360;


      console.log(`Wind Speed: ${windSpeed} m/s`);
      console.log(`Wind Direction: ${windDirection}°`);

      console.log(`Temperature: ${temp}°`);
  } catch (error) {
      console.error('Error:', error);
  }
}

getWindData('Toronto');

function calculateWindForce(agentWindEffect) {
  return [Math.cos(windDirection) * windSpeed * agentWindEffect, Math.sin(windDirection) * windSpeed * agentWindEffect];
}



// function sendToMax(data) {
//   changeLineColor(100)
//   if (ws.readyState === WebSocket.OPEN) {
//     ws.send(JSON.stringify(data));
//     // console.log("Message sent to Max:", data);
//   } else {
//       console.log("WebSocket not ready, waiting for connection...");
//   }

// }


// function changeLineColor(s) {
//   lineColor = "#1813F6";
//   setTimeout(() => {
//     lineColor = "#0E0AAF";
//   }, s); 
// }


let resize = function () {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener("resize", resize);
resize();



// wrap an { x, y } position around canvas width/height
function donut(agent) {
  if (agent.pos[0] > canvas.width) {
    agent.pos[0] -= canvas.width;
  } else if (agent.pos[0] < 0) {
    agent.pos[0] += canvas.width;
  }
  if (agent.pos[1] > canvas.height) {
    agent.pos[1] -= canvas.height;
  } else if (agent.pos[1] < 0) {
    agent.pos[1] += canvas.height;
  }
  return agent.pos;
}


function vec2_maxlength(out, v, limit) {
  const len = vec2.length(v);
  if (len > 0) {
    const limited_len = Math.min(len, limit);
    vec2.scale(out, v, limited_len / len);
  }
  return out;
}

function wrap(x, n) {
  return ((x % n) + n) % n;
}

// wrap vector `v` in the region of [-w/2, -h/2] to [w/2, h/2]
function vec2_relativewrap(out, v, w, h) {
  out[0] = ((((v[0] + w / 2) % w) + w) % w) - w / 2;
  out[1] = ((((v[1] + h / 2) % h) + h) % h) - h / 2;
  return out;
}

//////////////



let previousPositions = agents.map(agent => agent.pos[0]); // Stores only x-coordinates


// animate:
function animate() {
  // let the target wander around
  // let wander = vec2.random([0, 0], Math.random() * 10);
  // vec2.add(target, target, wander);

  // donut(target);

  for (let agent of agents) {
    // add up all the forces on this agent
    let force = [0, 0];

    let cohesion = [0, 0];
    let velocities = [0, 0];
    let cohesion_count = 0;
    let velocities_count = 0;

    for (let b of agents) {
      // do not compare with self:
      if (agent == b) continue;

      // find ones that are near:
      let relative = [0, 0];
      // where is "b" relative to me? vector that points to b
      vec2.sub(relative, b.pos, agent.pos);
      // toroidal wrap the relative vector:
      vec2_relativewrap(relative, relative, canvas.width, canvas.height);

      let distance = vec2.length(relative);

      // rotate the relative vector into my perspective:
      let relative_view = [0, 0];
      vec2.rotate(relative_view, relative, [0, 0], -agent.orient);

      // is the abs(angle) of relative_view in our field of view?
      let angle = vec2.angle(relative_view, [1, 0]);
      // if angle is too wide, I can't see it:
      if (Math.abs(angle) > params.field_of_view) continue;
      // ignore anyone behind me
      //if (relative_view[0] < 0) continue;

      // potential collision?
      if (distance > 0 && distance < params.collision_distance) {
        let repulsion = [0, 0];
        vec2.scale(
          repulsion,
          relative,
          -params.collision_factor / (distance * distance)
        );

        // add the repulsive force:
        vec2.add(force, force, repulsion);

        // include this in our near neighbors for cohesion:
        vec2.add(cohesion, cohesion, relative);
        cohesion_count++;

        // add up neighbor velocities:
        vec2.add(velocities, velocities, b.vel);
        velocities_count++;
      } // end of collision distance check
    } // end of "b" loop

    if (cohesion_count > 0) {
      // get average for cohesion:
      vec2.scale(cohesion, cohesion, params.cohesion_factor / cohesion_count);
      // apply this as a force
      vec2.add(force, force, cohesion);
    }

    if (velocities_count > 0) {
      // get average:
      vec2.scale(velocities, velocities, 1 / velocities_count);

      // scale it by some factor:
      vec2.scale(velocities, velocities, params.alignment_factor);

      // turn this into a steering force:
      //steering = desired_velocity - velocity
      let steering = [0, 0];
      vec2.sub(steering, velocities, agent.vel);
      // add it to our force
      vec2.add(force, force, steering);
    }

    // let flow = [0, 0];
    // flow = [1, 0];
    //flow = flowfield(agent.pos);
    //vec2.add(force, force, flow);

    let walkforce = vec2.random([0, 0], Math.random() * params.wander_factor);
    vec2.add(force, force, walkforce);


    if (frameCount % 3 === 0) {
      let walkforce = vec2.random([0, 0], Math.random() * params.wander_factor);
      vec2.add(force, force, walkforce);

      if(windVector !== undefined) {
        let individualWindForce = vec2.random([0, 0], Math.random() * params.windFactor);
        vec2.add(force, force, individualWindForce);
      }
    }

    // seek/flee:
    let desired = [0, 0];
    // desired_velocity = normalize (position - target) * max_speed

    if(params.target) {
      vec2.sub(desired, target, agent.pos);
      vec2_relativewrap(desired, desired, canvas.width, canvas.height);
      let distance = vec2.length(desired);
      vec2.normalize(desired, desired);
      vec2.scale(
        desired,
        desired,
        -params.antitarget_factor / (distance * distance)
      );
    }

    
    //steering = desired_velocity - velocity
    let steering = [0, 0];
    vec2.sub(steering, desired, agent.vel);
    vec2.add(force, force, steering);

    // limit maximum acceleration
    //vec2.scale(agent.acc, agent.acc, 0);
    vec2.set(agent.acc, 0, 0);
    vec2.add(agent.acc, agent.acc, force);

    // wind force
    if (windDirection) {
      let windForce = calculateWindForce(agent.windEffect);
      vec2.add(agent.acc, agent.acc, windForce);
    }


    vec2_maxlength(agent.acc, agent.acc, params.acceleration_limit);
  }

  for (let i = 0; i < agents.length; i++)  {
    let agent = agents[i];
    // assume acceleration == force
    vec2.add(agent.vel, agent.vel, agent.acc);
    vec2_maxlength(agent.vel, agent.vel, params.speed_limit);

    vec2.add(agent.pos, agent.pos, agent.vel);
    donut(agent);


    agent.orient = Math.atan2(agent.vel[1], agent.vel[0]);
    //agent.orient = vec2.angle(agent.vel, [1, 0]);
  }


  frameCount++;
}


// draw:
function draw() {
  // update the scene:
  animate();

  // 	clear screen
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  // ctx.filter = `hue-rotate(${hueRotation}deg)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);


  for (let [index, agent] of agents.entries()) {


    if (agent.fading) {
      agent.opacity -= params.fadingSpeed; // Reduce opacity gradually
      if (agent.opacity <= 0) {
        // Remove fully faded boid
        agents.splice(index, 1);
        previousPositions.splice(index, 1);
        continue;
      }
    }


    // draw trail
    agent.trail.push([...agent.pos]);


    // Limit trail length to avoid memory issues
    if (agent.trail.length > params.trailMaxLength) { // Adjust length as needed
      agent.trail.shift();
    }
    

    // Draw the trail
    ctx.beginPath();
    for (let i = 0; i < agent.trail.length - 1; i++) {
      const [x1, y1] = agent.trail[i];
      const [x2, y2] = agent.trail[i + 1];

      const dx = x2 - x1;
      const dy = y2 - y1;
      let distance = Math.sqrt(dx * dx + dy * dy);

      // if(distance > 2) continue;
   
      ctx.moveTo(x1, y1); 
      ctx.lineTo(x2, y2);
    }
    // ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; 

    let lineOpacity = mapVals(agent.opacity, 0, 1, 0, params.trailOpacity);
    ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`; 
    ctx.lineWidth = 2;
    ctx.stroke();


  }

  if(params.target) {
    // draw target
    ctx.save();
    {
      ctx.fillStyle = "#D2DD9C";
      ctx.beginPath();
      ctx.arc(target[0], target[1], 10, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  window.requestAnimationFrame(draw);
}




function mapVals(value, start1, stop1, start2, stop2) {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}



draw();

