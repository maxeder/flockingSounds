let params = {
  speed_limit: 1,
  acceleration_limit: 0.1,
  collision_distance: 30,
  collision_factor: 700,
  wander_factor: 300,
  antitarget_factor: 400000,
  field_of_view: 2.5,
  cohesion_factor: 5,
  alignment_factor: 150,
  number_boids: 200,
  trailMaxLength: 50,  // Reduced trail length
  target: false
};

let windSpeed, windDirection, temp, hueRotation;
let lineColor = "#8F851C";
let agents = [];
let target;
let ws;

function preload() {
  getWindData('Toronto');
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  console.log("sezup")
  
  ws = new WebSocket('ws://localhost:8080');
  
  for (let i = 0; i < params.number_boids; i++) {
    let agent = {
      pos: createVector(width, 0),
      orient: random(TWO_PI),
      vel: createVector(0, 0),
      acc: createVector(0, 0),
      trail: []  // Each trail point now includes position and creation time
    };
    agents.push(agent);
  }
  
  target = createVector(width / 10, height / 10);
}

function draw() {
  let rotateHue = map(constrain(temp, -5, 20), -5, 20, 0, 360);
  
  colorMode(HSB, 360, 100, 100);
  background(rotateHue, 10, 13);
  colorMode(RGB, 255);
  
  for (let agent of agents) {
    let force = createVector(0, 0);
    let cohesion = createVector(0, 0);
    let velocities = createVector(0, 0);
    let cohesion_count = 0;
    let velocities_count = 0;
    
    for (let b of agents) {
      if (agent === b) continue;
      
      let relative = p5.Vector.sub(b.pos, agent.pos);
      relative.x = ((relative.x + width / 2) % width + width) % width - width / 2;
      relative.y = ((relative.y + height / 2) % height + height) % height - height / 2;
      
      let distance = relative.mag();
      
      let relative_view = p5.Vector.fromAngle(relative.heading() - agent.orient);
      
      let angle = Math.abs(relative_view.heading());
      if (angle > params.field_of_view) continue;
      
      if (distance > 0 && distance < params.collision_distance) {
        let repulsion = relative.copy().mult(-params.collision_factor / (distance * distance));
        force.add(repulsion);
        
        cohesion.add(relative);
        cohesion_count++;
        
        velocities.add(b.vel);
        velocities_count++;
      }
    }
    
    if (cohesion_count > 0) {
      cohesion.mult(params.cohesion_factor / cohesion_count);
      force.add(cohesion);
    }
    
    if (velocities_count > 0) {
      velocities.mult(1 / velocities_count);
      velocities.mult(params.alignment_factor);
      
      let steering = p5.Vector.sub(velocities, agent.vel);
      force.add(steering);
    }
    
    let walkforce = p5.Vector.random2D().mult(random(params.wander_factor));
    force.add(walkforce);
    
    if (params.target) {
      let desired = p5.Vector.sub(target, agent.pos);
      desired.x = ((desired.x + width / 2) % width + width) % width - width / 2;
      desired.y = ((desired.y + height / 2) % height + height) % height - height / 2;
      
      let distance = desired.mag();
      desired.normalize();
      desired.mult(-params.antitarget_factor / (distance * distance));
      
      let steering = p5.Vector.sub(desired, agent.vel);
      force.add(steering);
    }
    
    agent.acc.set(0, 0);
    agent.acc.add(force);
    agent.acc.limit(params.acceleration_limit);
  }
  
  for (let agent of agents) {
    agent.vel.add(agent.acc);
    agent.vel.limit(params.speed_limit);
    
    agent.pos.add(agent.vel);
    
    agent.pos.x = ((agent.pos.x + width) % width);
    agent.pos.y = ((agent.pos.y + height) % height);
    
    agent.orient = agent.vel.heading();
    
    // Updated trail logic with fading
    agent.trail.push({
      pos: agent.pos.copy(), 
      time: frameCount  // Store the frame when this trail point was created
    });
    
    // Remove old trail points and limit trail length
    agent.trail = agent.trail.filter(point => 
      frameCount - point.time < params.trailMaxLength
    );
    
    // Draw fading trail
    noFill();
    beginShape();
    for (let i = 0; i < agent.trail.length; i++) {
      // Calculate alpha based on how old the trail point is
      let alpha = map(
        frameCount - agent.trail[i].time, 
        0, 
        params.trailMaxLength, 
        255, 
        0
      );
      
      stroke(255, 255, 255, alpha);
      strokeWeight(2);
      vertex(agent.trail[i].pos.x, agent.trail[i].pos.y);
    }
    endShape();
  }
  
  if (params.target) {
    fill(210, 221, 156);
    noStroke();
    circle(target.x, target.y, 20);
  }
}

// Event handlers
function mouseMoved() {
  target.x = mouseX;
  target.y = mouseY;
}

function mouseDragged() {
  target.x = mouseX;
  target.y = mouseY;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// WebSocket send function (similar to original)
function sendToMax(data) {
  changeLineColor(100);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.log("WebSocket not ready, waiting for connection...");
  }
}

function changeLineColor(s) {
  lineColor = "#D3EAB0";
  setTimeout(() => {
    lineColor = "#8F851C";
  }, s); 
}

// Weather data fetch function (same as original)
async function getWindData(city) {
  const apiKey = '9b25d3712337384ddf7db3c1416cf493';
  const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    const data = await response.json();

    windSpeed = data.wind.speed;
    windDirection = data.wind.deg;

    temp = data.main.temp;
    let clampedHue = Math.max(-5, Math.min(20, temp));
    hueRotation = ((clampedHue + 5) / 25) * 360;

    windSpeed = 100;
    windDirection = 1;

    console.log(`Wind Speed: ${windSpeed} m/s`);
    console.log(`Wind Direction: ${windDirection}°`);
    console.log(`Temperature: ${temp}°`);
  } catch (error) {
    console.error('Error:', error);
  }
}