FROM rust:1-slim-bookworm AS yelken-builder

WORKDIR /src/yelken

RUN apt-get update && apt-get install -y libpq-dev

COPY yelken .

RUN cargo build --release



FROM node:lts-bookworm AS app-builder

WORKDIR /src/app

COPY app .

RUN npm install && npx vite build --base='/{YELKEN_BASE_URL}/'



FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y libpq5

WORKDIR /app

COPY --from=yelken-builder /src/yelken/target/release/yelken ./yelken

COPY --from=app-builder /src/app/dist ./dist

ENV YELKEN_APP_ASSETS_DIR=/app/dist

CMD ["./yelken"]
