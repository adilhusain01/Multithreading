const { Worker } = require('bullmq');

// Connect to the same Redis Message Broker
const connection = { host: '127.0.0.1', port: 6379 };

console.log("Enterprise Worker Server starting...");
console.log("Connecting to Redis Queue: 'MathCalculations'...");

// 4. This completely separate server picks up the message from the queue, 
// does the heavy lifting, and updates the database automatically.
const worker = new Worker('MathCalculations', async (job) => {
    console.log(`[Worker] Picked up Job ID ${job.id} from queue...`);
    
    const target = job.data.target; // 20 Million
    let counter = 0;
    
    // The Heavy Lifting (Simulating an 8K Video Render or CSV parsing)
    for(let i = 0; i < target; i++) {
        counter++;
    }
    
    console.log(`[Worker] Finished Job ID ${job.id}! Result: ${counter}`);
    return counter; // BullMQ automatically saves this return value back into 
                    // the Redis database so the Express server can fetch it!

}, { connection, concurrency: 8 }); // Pulls up to 8 things at a time, exactly like our thread pool!

worker.on('completed', (job) => {
    // 5. When finished, you could even fire off a WebSocket notification 
    // or Email to the user from right here!
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed:`, err);
});
