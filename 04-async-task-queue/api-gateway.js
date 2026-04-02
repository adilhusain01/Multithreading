const express = require('express');
const Redis = require('ioredis');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Connect to our local Redis server we just installed! 
// This is the true Enterprise Message Broker.
const redis = new Redis({ host: '127.0.0.1', port: 6379 });

app.get('/non-blocking', (req, res) => {
    res.status(200).send("This page is non-blocking");
});

app.get('/blocking', async (req, res) => {
    // 1. Take the request and drop a message payload into the Redis Queue
    // The web server does NO mathematical work. Zero.
    const jobId = crypto.randomUUID();
    
    // 2. Set initial database status so the user can look it up later
    await redis.hset(`job:${jobId}`, 'status', 'Pending');
    await redis.hset(`job:${jobId}`, 'result', '');

    // 3. Drop the message payload cleanly into a Redis Queue List (RabbitMQ/Kafka equivalent)
    const payload = JSON.stringify({ id: jobId, target: 20_000_000 });
    await redis.lpush('MathTasksQueue', payload);

    // 4. Instantly tell the user "Your report is generating..."
    // (HTTP 202 Accepted)
    res.status(202).json({
        message: "Your calculation has been sent to the Redis Queue for background processing. A Rust worker will pick it up.",
        jobId: jobId,
        checkStatusUrl: `http://localhost:${port}/status/${jobId}`
    });
});

app.get('/status/:jobId', async (req, res) => {
    const jobKey = `job:${req.params.jobId}`;
    
    // Quick Hash check on our Database
    const status = await redis.hget(jobKey, 'status');
    const result = await redis.hget(jobKey, 'result');
    
    if (!status) return res.status(404).send("Job ID not found in Redis Database.");
    
    if (status === 'Completed') {
        return res.status(200).json({ status, result: parseInt(result) });
    } else if (status === 'Failed') {
        return res.status(500).json({ status, error: result });
    }
    
    // Still Pending or actively processing
    res.status(206).json({ status }); 
});

app.listen(port, () => {
    console.log(`Enterprise API Gateway running on PORT ${port}`);
    console.log(`Redis Queue: Connected! Drop tasks into /blocking`);
});