const express = require('express');
const path = require('path');
const Piscina = require('piscina');

const app = express();
const port = process.env.PORT || 3000;
const THREAD_COUNT = 8;

// Initialize the worker pool
// The pool automatically manages hardware threads and a task queue
const piscina = new Piscina({
    filename: path.resolve(__dirname, 'pool-worker.js'),
    maxThreads: THREAD_COUNT // Caps the number of OS threads created
});

app.get('/non-blocking', (req, res) => {
    res.status(200).send("This page is non-blocking");
});

app.get('/blocking', async (req, res) => {
    try {
        const workerPromises = [];

        // We push tasks into the pool's queue. 
        // If all 8 threads are busy, extra tasks wait in line without crashing the server.
        for(let i = 0; i < THREAD_COUNT; i++) {
            workerPromises.push(piscina.run({ thread_count: THREAD_COUNT }));
        }

        // Wait for all 8 chunks to finish
        const threadResults = await Promise.all(workerPromises);

        // Dynamic summation using .reduce() - fixes the hardcoded array indexes
        const total = threadResults.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        
        res.status(200).send(`Result is ${total}`);
    } catch (error) {
        // Robust error handling - prevents the server from hanging
        console.error('Worker computation failed:', error);
        res.status(500).send('Internal Server Error: Computation failed.');
    }
});

app.listen(port, () => {
    console.log(`App (with Worker Pool) running on PORT ${port}`);
});
