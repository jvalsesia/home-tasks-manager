use anyhow::Result;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::str::FromStr;

/// Creates (or opens) the SQLite database and runs migrations.
pub async fn init_pool(database_url: &str) -> Result<SqlitePool> {
    // create_if_missing(true) tells SQLite to create the file when it doesn't
    // exist yet — this is not the default when connecting via a plain URL string.
    let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS members (
            id    TEXT PRIMARY KEY NOT NULL,
            name  TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#6366f1'
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id               TEXT    PRIMARY KEY NOT NULL,
            member_id        TEXT    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            description      TEXT    NOT NULL,
            scheduled_at     TEXT    NOT NULL,   -- stored as "YYYY-MM-DDTHH:MM:SS"
            duration_minutes INTEGER NOT NULL DEFAULT 30,
            alarm_minutes    INTEGER NOT NULL DEFAULT 15,
            alarm_fired      INTEGER NOT NULL DEFAULT 0  -- SQLite stores bools as 0/1
        );
        "#,
    )
    .execute(pool)
    .await?;

    // Add duration_minutes to existing databases that predate this column.
    // ALTER TABLE ADD COLUMN fails if the column already exists, so we check first.
    let has_duration: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('tasks') WHERE name = 'duration_minutes'",
    )
    .fetch_one(pool)
    .await?;

    if !has_duration {
        sqlx::query(
            "ALTER TABLE tasks ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30",
        )
        .execute(pool)
        .await?;
    }

    // Index to speed up the alarm ticker query
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at
            ON tasks (scheduled_at);
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
