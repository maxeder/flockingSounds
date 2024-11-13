import { WebSocketServer } from 'ws';
import { Client } from 'node-osc';

// Create WebSocket server
const wss = new WebSocketServer({ port: 8080 });

// Create OSC client to send messages to Max/MSP
const oscClient = new Client('127.0.0.1', 7400);

wss.on('connection', (ws) => {
  console.log('Web client connected');
  
  ws.on('message', (message) => {
    // Forward message to Max/MSP via OSC
    oscClient.send('/webcontrol', message.toString());
    console.log('oscClient sent');
  });
});