FROM rust:1-slim-bullseye AS builder

WORKDIR /src/yelken

RUN apt-get update && apt-get install -y libpq-dev && rustup target add wasm32-unknown-unknown && cargo install trunk --locked

COPY . .

RUN cargo build --release

WORKDIR /src/yelken/app-client

RUN trunk build --public-url /assets/yelken --release

FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y libpq5

WORKDIR /apps/yelken

COPY --from=builder /src/yelken/target/release/yelken ./yelken

COPY --from=builder /src/yelken/app-client/dist ./dist

ENV YELKEN_APP_ASSETS_DIR=/apps/yelken/dist

CMD ["./yelken"]
