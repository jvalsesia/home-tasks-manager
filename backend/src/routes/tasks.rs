use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDateTime;
use serde::Deserialize;

use crate::{
    models::{CreateTaskRequest, SseEvent, Task},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct TasksQuery {
    /// Filter by date, format: "YYYY-MM-DD". If omitted, return all tasks.
    pub date: Option<String>,
    /// Filter by member_id. If omitted, return all members.
    pub member_id: Option<String>,
}

pub async fn list_tasks(
    State(state): State<AppState>,
    Query(params): Query<TasksQuery>,
) -> Result<Json<Vec<Task>>, StatusCode> {
    // Build a dynamic WHERE clause based on optional filters
    let tasks = match (&params.date, &params.member_id) {
        (Some(date), Some(mid)) => {
            sqlx::query_as::<_, Task>(
                r#"SELECT id, member_id, description, scheduled_at, duration_minutes, alarm_minutes, alarm_fired
                   FROM tasks
                   WHERE date(scheduled_at) = ?1 AND member_id = ?2
                   ORDER BY scheduled_at"#,
            )
            .bind(date)
            .bind(mid)
            .fetch_all(&state.pool)
            .await
        }
        (Some(date), None) => {
            sqlx::query_as::<_, Task>(
                r#"SELECT id, member_id, description, scheduled_at, duration_minutes, alarm_minutes, alarm_fired
                   FROM tasks
                   WHERE date(scheduled_at) = ?1
                   ORDER BY scheduled_at"#,
            )
            .bind(date)
            .fetch_all(&state.pool)
            .await
        }
        (None, Some(mid)) => {
            sqlx::query_as::<_, Task>(
                r#"SELECT id, member_id, description, scheduled_at, duration_minutes, alarm_minutes, alarm_fired
                   FROM tasks
                   WHERE member_id = ?1
                   ORDER BY scheduled_at"#,
            )
            .bind(mid)
            .fetch_all(&state.pool)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, Task>(
                r#"SELECT id, member_id, description, scheduled_at, duration_minutes, alarm_minutes, alarm_fired
                   FROM tasks
                   ORDER BY scheduled_at"#,
            )
            .fetch_all(&state.pool)
            .await
        }
    };

    tasks
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn create_task(
    State(state): State<AppState>,
    Json(body): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), (StatusCode, String)> {
    let scheduled_at = NaiveDateTime::parse_from_str(&body.scheduled_at, "%Y-%m-%dT%H:%M:%S")
        .map_err(|e| {
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("invalid scheduled_at: {e}"),
            )
        })?;

    let task = Task::new(body.member_id, body.description, scheduled_at, body.duration_minutes, body.alarm_minutes);

    sqlx::query(
        r#"INSERT INTO tasks (id, member_id, description, scheduled_at, duration_minutes, alarm_minutes, alarm_fired)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)"#,
    )
    .bind(&task.id)
    .bind(&task.member_id)
    .bind(&task.description)
    .bind(task.scheduled_at.format("%Y-%m-%dT%H:%M:%S").to_string())
    .bind(task.duration_minutes)
    .bind(task.alarm_minutes)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(SseEvent::TasksChanged);

    Ok((StatusCode::CREATED, Json(task)))
}

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM tasks WHERE id = ?1")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    let _ = state.tx.send(SseEvent::TasksChanged);

    Ok(StatusCode::NO_CONTENT)
}
