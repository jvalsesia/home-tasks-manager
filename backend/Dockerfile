# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM rust:1.86-slim AS builder

RUN apt-get update && apt-get install -y libsqlite3-dev pkg-config && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies by compiling a stub binary first.
# Only invalidated when Cargo.toml or Cargo.lock change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs \
    && cargo build --release \
    && rm -f target/release/home-tasks-backend target/release/deps/home_tasks_backend*

# Build the real binary
COPY src ./src
RUN cargo build --release

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y libsqlite3-0 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/home-tasks-backend ./home-tasks-backend

# Data volume for the SQLite file
VOLUME ["/data"]

ENV DATABASE_URL=sqlite:///data/tasks.db
ENV RUST_LOG=info

EXPOSE 3000

CMD ["./home-tasks-backend"]
