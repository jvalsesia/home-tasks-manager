use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A family member who can be assigned tasks.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Member {
    pub id: String,
    pub name: String,
    pub color: String, // hex color for the grid column header
}

/// A home task assigned to a family member.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub member_id: String,
    pub description: String,
    /// ISO-8601 datetime string stored as TEXT in SQLite, e.g. "2026-04-15T09:00:00"
    pub scheduled_at: NaiveDateTime,
    /// How long the task is expected to take, in minutes
    pub duration_minutes: i64,
    /// How many minutes before `scheduled_at` to raise the alarm
    pub alarm_minutes: i64,
    /// Whether the alarm has already been fired (prevents duplicate SSE events)
    pub alarm_fired: bool,
}

// ── Request / Response DTOs ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateMemberRequest {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub member_id: String,
    pub description: String,
    /// Expected format: "YYYY-MM-DDTHH:MM:SS"
    pub scheduled_at: String,
    #[serde(default = "default_duration_minutes")]
    pub duration_minutes: i64,
    #[serde(default = "default_alarm_minutes")]
    pub alarm_minutes: i64,
}

fn default_duration_minutes() -> i64 {
    30
}

fn default_alarm_minutes() -> i64 {
    15
}

// ── SSE event payload sent to the browser ────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SseEvent {
    /// A task was created, updated, or deleted — frontend should refetch.
    TasksChanged,
    /// Alarm fired for a specific task.
    Alarm { task: Task },
    /// Keep-alive heartbeat (no data).
    Ping,
}

impl Member {
    pub fn new(name: impl Into<String>, color: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            color: color.into(),
        }
    }
}

impl Task {
    pub fn new(
        member_id: impl Into<String>,
        description: impl Into<String>,
        scheduled_at: NaiveDateTime,
        duration_minutes: i64,
        alarm_minutes: i64,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            member_id: member_id.into(),
            description: description.into(),
            scheduled_at,
            duration_minutes,
            alarm_minutes,
            alarm_fired: false,
        }
    }
}
