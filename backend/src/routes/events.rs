use axum::{
    extract::State,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
};
use futures::StreamExt;
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;
use tracing::{info, warn};

use crate::AppState;

/// GET /events
///
/// Opens a persistent SSE connection. The client receives:
///   - `{ "type": "tasks_changed" }` whenever any task or member changes.
///   - `{ "type": "alarm", "task": {...} }` when an alarm fires.
///   - `{ "type": "ping" }` keep-alive every 25 s (distinct from HTTP keep-alive).
pub async fn sse_handler(State(state): State<AppState>) -> impl IntoResponse {
    let rx = state.tx.subscribe();
    info!(
        "SSE client connected — total subscribers now: {}",
        state.tx.receiver_count()
    );

    let broadcast_stream = BroadcastStream::new(rx).filter_map(|result| async move {
        match result {
            Ok(event) => {
                let json = serde_json::to_string(&event).ok()?;
                info!("SSE → sending event: {json}");
                Some(Ok::<Event, std::convert::Infallible>(
                    Event::default().data(json),
                ))
            }
            // Lagged — client was too slow; skip the missed events
            Err(e) => {
                warn!("SSE broadcast lag — dropped event: {e}");
                None
            }
        }
    });

    Sse::new(broadcast_stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(25))
            .text("ping"),
    )
}
