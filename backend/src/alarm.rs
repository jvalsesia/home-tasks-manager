use std::time::Duration;

use chrono::Local;
use sqlx::SqlitePool;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::models::{SseEvent, Task};

/// Spawns a background task that wakes every 30 s and checks whether any
/// task's alarm window has been reached.  When it has, it:
///   1. Broadcasts an `SseEvent::Alarm` so all connected browsers receive it.
///   2. Marks `alarm_fired = true` in the DB so it doesn't fire again.
pub fn spawn_alarm_ticker(pool: SqlitePool, tx: broadcast::Sender<SseEvent>) {
    info!("alarm ticker started — checking every 30 s");
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            info!("alarm ticker: running check");
            if let Err(e) = check_alarms(&pool, &tx).await {
                error!("alarm ticker error: {e:#}");
            }
        }
    });
}

async fn check_alarms(pool: &SqlitePool, tx: &broadcast::Sender<SseEvent>) -> anyhow::Result<()> {
    let now = Local::now().naive_local();
    let now_str = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    info!("alarm check: now = {now_str}, subscribers = {}", tx.receiver_count());

    // Fetch tasks whose alarm window has started but haven't fired yet.
    // alarm fires when:  scheduled_at - alarm_minutes <= now < scheduled_at
    // NOTE: duration_minutes must be included — Task::from_row requires all fields.
    let tasks: Vec<Task> = sqlx::query_as(
        r#"
        SELECT id, member_id, description, scheduled_at,
               duration_minutes, alarm_minutes, alarm_fired
        FROM   tasks
        WHERE  alarm_fired = 0
          AND  datetime(scheduled_at, '-' || alarm_minutes || ' minutes') <= datetime(?1)
          AND  datetime(scheduled_at) > datetime(?1)
        "#,
    )
    .bind(&now_str)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!("alarm check: DB query failed: {e:#}");
        e
    })?;

    if tasks.is_empty() {
        info!("alarm check: no pending alarms at {now_str}");
    } else {
        info!("alarm check: {} task(s) ready to fire", tasks.len());
    }

    for task in tasks {
        info!(
            "firing alarm for task '{}' (id={}, scheduled={}, alarm={}m, subscribers={})",
            task.description,
            task.id,
            task.scheduled_at,
            task.alarm_minutes,
            tx.receiver_count(),
        );

        // Mark as fired before broadcasting to avoid races on restart
        sqlx::query("UPDATE tasks SET alarm_fired = 1 WHERE id = ?1")
            .bind(&task.id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!("alarm check: failed to mark alarm_fired for {}: {e:#}", task.id);
                e
            })?;

        match tx.send(SseEvent::Alarm { task }) {
            Ok(n) => info!("alarm SSE sent to {n} subscriber(s)"),
            Err(_) => warn!("alarm SSE: no subscribers connected — event dropped"),
        }
    }

    Ok(())
}
