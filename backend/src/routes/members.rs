use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::{
    models::{CreateMemberRequest, Member, SseEvent},
    AppState,
};

pub async fn list_members(State(state): State<AppState>) -> Result<Json<Vec<Member>>, StatusCode> {
    let members = sqlx::query_as::<_, Member>("SELECT id, name, color FROM members ORDER BY name")
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(members))
}

pub async fn create_member(
    State(state): State<AppState>,
    Json(body): Json<CreateMemberRequest>,
) -> Result<(StatusCode, Json<Member>), StatusCode> {
    let member = Member::new(body.name, body.color);

    sqlx::query("INSERT INTO members (id, name, color) VALUES (?1, ?2, ?3)")
        .bind(&member.id)
        .bind(&member.name)
        .bind(&member.color)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = state.tx.send(SseEvent::TasksChanged);

    Ok((StatusCode::CREATED, Json(member)))
}

pub async fn delete_member(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM members WHERE id = ?1")
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
