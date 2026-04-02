const express = require('express');
const { Queue } = require('bullmq');

const app = express();
const port = 3000;

// Connect to our local Redis server we just installed! 
// This is the true Enterprise Message Broker.
const connection = { host: '127.0.0.1', port: 6379 };
const mathQueue = new Queue('MathCalculations', { connection });

app.get('/non-blocking', (req, res) => {
    res.status(200).send("This page is non-blocking");
});

app.get('/blocking', async (req, res) => {
    // 1. Take the request and drop a message payload into the Redis Queue
    // The web server does NO mathematical work. Zero.
    const job = await mathQueue.add('Calculate20Million', { target: 20_000_000 });

    // 2. Instantly tell the user "Your report is generating..."
    // (HTTP 202 Accepted)
    res.status(202).json({
        message: "Your calculation has been sent to the Redis Queue for background processing.",
        jobId: job.id,
        checkStatusUrl: `http://localhost:${port}/status/${job.id}`
    });
});

app.get('/status/:jobId', async (req, res) => {
    const job = await mathQueue.getJob(req.params.jobId);
    
    if (!job) {
        return res.status(404).send("Job ID not found in Redis.");
    }
    
    // 3. The completely separate Worker updates the Redis Database when finished.
    // We check that database here.
    const state = await job.getState();
    const result = job.returnvalue;

    if (state === 'completed') {
        return res.status(200).json({ status: state, result: result });
    } else if (state === 'failed') {
        return res.status(500).json({ status: state, error: job.failedReason });
    }
    
    // Still in the queue or actively processing
    res.status(206).json({ status: state }); 
});

app.listen(port, () => {
    console.log(`Enterprise API Gateway running on PORT ${port}`);
    console.log(`Redis Queue: Connected! Drop tasks into /blocking`);
});