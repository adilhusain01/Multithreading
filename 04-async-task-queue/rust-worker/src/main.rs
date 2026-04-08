use redis::AsyncCommands;
use serde::Deserialize;
use std::hint::black_box;
use rayon::prelude::*;

#[derive(Deserialize, Debug)]
struct JobPayload {
    id: String,
    target: u64,
}

#[tokio::main]
async fn main() -> redis::RedisResult<()> {
    // Connect to the exact same Redis database as the Express App
    let client = redis::Client::open("redis://127.0.0.1:6379/")?;
    let mut con = client.get_async_connection().await?;

    println!("🚀 Rust Background Worker started.");
    println!("📡 Listening strictly to Redis Queue: 'MathTasksQueue'...");

    loop {
        // Block and wait indefinitely (0) until a payload arrives in the MathTasksQueue
        let pop_result: redis::RedisResult<(String, String)> = con.brpop("MathTasksQueue", 0.0).await;
        
        match pop_result {
            Ok((_, payload_str)) => {
                // Parse the JSON dropped by Node.js
                if let Ok(job) = serde_json::from_str::<JobPayload>(&payload_str) {
                    let job_db_key = format!("job:{}", job.id);
                    println!("📦 [{}]: Picked up off queue. Target: {}", job.id, job.target);
                    
                    // Mark as Processing in the main DB
                    let _: () = con.hset(&job_db_key, "status", "Processing").await?;

                    // Execute the Heavy Lifting using native Rust thread pooling
                    let thread_count = 8;
                    let target_per_thread = job.target / (thread_count as u64);
                    
                    let final_result: u64 = tokio::task::spawn_blocking(move || {
                        (0..thread_count).into_par_iter().map(|_| {
                            let mut counter = 0u64;
                            for _ in 0..target_per_thread {
                                counter = black_box(counter + 1);
                            }
                            counter
                        }).sum()
                    }).await.unwrap();

                    // Update the Database with the final answer securely 
                    let _: () = con.hset(&job_db_key, "status", "Completed").await?;
                    let _: () = con.hset(&job_db_key, "result", final_result.to_string()).await?;
                    
                    println!("✅ [{}]: Finished math ({}). Database updated.", job.id, final_result);
                } else {
                    println!("Failed to parse payload: {}", payload_str);
                }
            },
            Err(e) => {
                eprintln!("Lost connection to Redis: {}", e);
                break;
            }
        }
    }

    Ok(())
}
