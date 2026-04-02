const express = require('express');
const crypto = require('crypto');
const path = require('path');
const Piscina = require('piscina');

const app = express();
const port = 3000;
const THREAD_COUNT = 8; // Number of chunks to split the math by

// Initialize the worker pool for background processing
const piscina = new Piscina({
    filename: path.resolve(__dirname, 'pool-worker.js'),
    maxThreads: THREAD_COUNT // Caps the number of OS threads created
});

// A simple in-memory mock "Database" to track Job status
const jobDatabase = new Map();

app.get('/non-blocking', (req, res) => {
    res.status(200).send("This page is non-blocking");
});

app.get('/blocking', (req, res) => {
    // 1. Take the request and immediately create a unique Tracking ID
    const jobId = crypto.randomUUID();
    
    // 2. Save it to our database as "Pending"
    jobDatabase.set(jobId, { status: 'Pending', result: null });

    // 3. Fire the long-running task to the background queue
    // Notice there is NO "await" here! Node.js does not wait for this promise.
    const workerPromises = [];
    for(let i = 0; i < THREAD_COUNT; i++) {
        workerPromises.push(piscina.run({ thread_count: THREAD_COUNT }));
    }

    Promise.all(workerPromises)
        .then(threadResults => {
            // Once all 8 chunks finish later, we update our database.
            const total = threadResults.reduce((acc, curr) => acc + curr, 0);
            jobDatabase.set(jobId, { status: 'Completed', result: total });
        })
        .catch(error => {
            // Background Error handling
            jobDatabase.set(jobId, { status: 'Failed', error: error.message });
        });

    // 4. Instantly reply to the user ("HTTP 202 Accepted")
    res.status(202).json({
        message: "Your calculation has been queued for background processing.",
        jobId: jobId,
        checkStatusUrl: `http://localhost:${port}/status/${jobId}`
    });
});

app.get('/status/:jobId', (req, res) => {
    const job = jobDatabase.get(req.params.jobId);
    
    if (!job) {
        return res.status(404).send("Job ID not found.");
    }
    
    if (job.status === 'Pending') {
        // HTTP 206 Partial Content (Still working on it)
        return res.status(206).json(job);
    }
    
    // HTTP 200 OK (Finished)
    res.status(200).json(job);
});

app.listen(port, () => {
    console.log(`Asynchronous Message Queue Pattern running on PORT ${port}`);
});