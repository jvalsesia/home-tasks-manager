mod alarm;
mod db;
mod models;
mod routes;

use axum::{
    routing::{delete, get, post},
    Router,
};
use sqlx::SqlitePool;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::models::SseEvent;

/// Shared application state injected into every handler via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    /// Sender half of the broadcast channel — handlers clone it to publish SSE events.
    pub tx: broadcast::Sender<SseEvent>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env / .env.local if present (no-op if files are absent)
    dotenvy::from_filename(".env.local").ok();
    dotenvy::dotenv().ok();

    // Structured logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Database
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tasks.db".to_string());
    let pool = db::init_pool(&database_url).await?;
    info!("database ready at {database_url}");

    // SSE broadcast channel (capacity = 128 buffered events per subscriber)
    let (tx, _rx) = broadcast::channel::<SseEvent>(128);

    // Start alarm background ticker
    alarm::spawn_alarm_ticker(pool.clone(), tx.clone());

    let state = AppState { pool, tx };

    // CORS — allow the Vite dev server (port 5173) and any other origin in dev
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Members
        .route("/api/members", get(routes::members::list_members))
        .route("/api/members", post(routes::members::create_member))
        .route("/api/members/:id", delete(routes::members::delete_member))
        // Tasks
        .route("/api/tasks", get(routes::tasks::list_tasks))
        .route("/api/tasks", post(routes::tasks::create_task))
        .route("/api/tasks/:id", delete(routes::tasks::delete_task))
        // SSE
        .route("/events", get(routes::events::sse_handler))
        .layer(cors)
        .with_state(state);

    let addr = "0.0.0.0:3000";
    info!("listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
