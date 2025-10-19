FROM rust:alpine3.22 AS yelken-builder

WORKDIR /src/yelken

RUN apk update && apk add libpq-dev musl-dev openssl-libs-static

COPY yelken .

RUN cargo build --release --no-default-features --features cloud



FROM node:lts-alpine3.22 AS app-builder

WORKDIR /src/app

COPY app .

RUN npm install && npx vite build --base='/{YELKEN_BASE_URL}/'



FROM alpine:3.22

WORKDIR /app

COPY --from=yelken-builder /src/yelken/target/release/yelken ./yelken

COPY --from=app-builder /src/app/dist ./dist

COPY themes/default /app/themes/default

ENV YELKEN_APP_ASSETS_DIR=/app/dist
ENV YELKEN_DEFAULT_THEME_DIR=/app/themes/default

CMD ["./yelken"]
