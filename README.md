# Node.js Concurrency Patterns & Architectures

This repository demonstrates the evolution of handling heavy CPU-bound tasks in a Node.js web server. It contains three distinct architectural patterns, moving from a basic threaded approach to a production-scale distributed microservice.

Each version contains a `/blocking` route that computes a massive loop (20 Billion iterations in total), which will typically freeze a single-threaded Node.js server. We demonstrate how to mitigate this using 3 different strategies.

---

## 1. Unpooled Workers (`01-unpooled-workers`)

### The Concept
When a request comes in, the Express server immediately spawns 8 internal OS threads (`new Worker()`) to split the math workload. 

### The Problem ("The Crash and Burn")
If 100 users visit the endpoint simultaneously, it blindly spawns **800 OS threads**. This leads to intense CPU context switching, resource exhaustion, and essentially operates as a self-inflicted Denial of Service (DoS) attack.

**To Run:**
```bash
node 01-unpooled-workers/index-eight-workers.js
```

---

## 2. Thread Pool Manager (`02-thread-pool`)

### The Concept
Instead of spawning threads dynamically per request, the server uses the `piscina` library to boot up a fixed **Worker Pool** (e.g., 8 threads maximum).

### The Benefit
If 100 users visit the endpoint simultaneously, it only feeds 8 users into the threads at once. The other 92 users are placed gracefully into an in-memory **Queue**. The server remains completely stable under heavy load without crashing the OS.
*(Perfect for heavy tasks that take between 10ms - 3 seconds).*

**To Run:**
```bash
node 02-thread-pool/index-pool.js
```

---

## 3. Microservice Architecture (`03-microservice`)

### The Concept
The Node.js server itself performs **zero math**. Instead, it acts purely as an API Gateway. It forwards the heavy lifting over HTTP (`fetch`) to a dedicated Backend Microservice written in **Rust** (leveraging `axum` and `rayon` for its own thread pooling).

### The Benefit
If the heavy task takes an extremely long time (minutes or hours), the Node.js server is completely unbothered. Node.js can serve thousands of concurrent `/non-blocking` users at 100% speed while the separate Rust server chugs away asynchronously. Rust also handles low-level loop counting hundreds of times faster than JavaScript’s V8 engine.

**To Run:**
*Terminal 1 (Start the Rust Service):*
```bash
cd 03-microservice/rust-worker
cargo run --release
```
*Terminal 2 (Start the Node.js API Gateway):*
```bash
node 03-microservice/index-microservice.js
```

---

## Load Testing

To see how these architectures perform under stress, use `autocannon` to simulate 100 concurrent users pounding the server for 10 seconds:

```bash
npm install -g autocannon
autocannon -c 100 -d 10 http://localhost:3000/blocking
```

* **V1 Unpooled:** Will yield ~0 successful requests and 100 timeouts.
* **V2 Pooled:** Will systematically process the queue and complete successfully.
* **V3 Microservice:** Will offload work, providing the highest throughput for long-running heavy tasks with complete safety to the web layer.