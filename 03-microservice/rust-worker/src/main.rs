use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use tokio::task;
use std::hint::black_box;

#[derive(Deserialize)]
struct ComputeRequest {
    thread_count: usize,
}

#[derive(Serialize)]
struct ComputeResponse {
    result: u64,
}

async fn compute_handler(Json(payload): Json<ComputeRequest>) -> Json<ComputeResponse> {
    let thread_count = payload.thread_count;

    // Use Rayon's thread pool to prevent thread exhaustion (simulates Piscina's queue)
    // We lower the operations to 200 Million to match the successful Node.js test
    let target = 200_000_000u64 / (thread_count as u64);
    
    let total: u64 = tokio::task::spawn_blocking(move || {
        use rayon::prelude::*;
        
        (0..thread_count).into_par_iter().map(|_| {
            let mut counter = 0u64;
            for _ in 0..target {
                counter = std::hint::black_box(counter + 1);
            }
            counter
        }).sum()
    }).await.unwrap();

    Json(ComputeResponse { result: total })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/compute", post(compute_handler));
    
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4000").await.unwrap();
    println!("Rust microservice listening on port 4000");
    axum::serve(listener, app).await.unwrap();
}