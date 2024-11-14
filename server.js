import { WebSocketServer } from 'ws';
import { Client } from 'node-osc';

// Create WebSocket server
const wss = new WebSocketServer({ port: 8080 });

// Create OSC client to send messages to Max/MSP
const oscClient = new Client('127.0.0.1', 7500);

// wss.on('connection', (ws) => {
//   console.log('Web client connected');
  
//   ws.on('message', (message) => {
//     // Forward message to Max/MSP via OSC
//     console.log(message)
//     oscClient.send('/webcontrol', message);

//   });
// });




wss.on('connection', (ws) => {
    console.log('Web client connected');
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(data);
            // Send frequency and amplitude as separate numbers

            oscClient.send('/webcontrol', [data.posX, data.posY, data.velX, data.velY, data.dir]);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
});