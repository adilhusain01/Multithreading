const express = require('express');
const app = express();
const port = 3000;
const THREAD_COUNT = 8; // Number of chunks to split the math by in the Rust server

app.get('/non-blocking', (req, res) => {
    res.status(200).send("This page is non-blocking");
});

app.get('/blocking', async (req, res) => {
    try {
        // Native Node 18+ fetch: acts as an API Gateway to the Rust Microservice
        const response = await fetch('http://127.0.0.1:4000/compute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_count: THREAD_COUNT })
        });
        
        if (!response.ok) {
            throw new Error(`Microservice error: ${response.status}`);
        }
        
        const data = await response.json();
        res.status(200).send(`Result is ${data.result}`);
    } catch (error) {
        console.error('Failed to communicate with Microservice:', error);
        res.status(500).send('Internal Server Error: Microservice unavailable.');
    }
});

app.listen(port, () => {
    console.log(`API Gateway (Node.js) running on PORT ${port}`);
});
