#[tokio::main]
async fn main() {
    dotenvy::from_path("./.env").ok();

    env_logger::init();

    let command = std::env::args().nth(1).unwrap_or("".to_string());

    if command == "migrate" || command == "migrate-run" {
        let db_config = yelken::config::DatabaseConfig::from_env().unwrap();

        // setup::migrate(
        //     &mut <diesel::SqliteConnection as diesel::Connection>::establish(&db_config.url).unwrap(),
        // )
        // .unwrap();

        if command != "migrate-run" {
            return;
        }
    }

    let app = yelken::router().await;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
