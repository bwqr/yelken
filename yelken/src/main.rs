use std::{net::SocketAddrV4, time::Instant};

use anyhow::{Context, Result};
use axum::{extract::Request, middleware::Next, response::Response};
use base::{
    config::Config,
    crypto::Crypto,
    db::{Connection, SyncConnection},
};
use clap::{Parser, Subcommand};
use diesel_async::pooled_connection::{AsyncDieselConnectionManager, deadpool};
use yelken::DatabaseConfig;

#[derive(Clone, Debug, Subcommand)]
enum Command {
    Setup {
        #[arg(long)]
        admin: bool,
        #[arg(long)]
        values: bool,
        #[arg(long)]
        check: bool,
    },
    Migrate,
}

#[derive(Debug, Parser)]
struct Args {
    #[command(subcommand)]
    command: Option<Command>,
}

struct ServerConfig {
    pub address: SocketAddrV4,
    pub app_assets_dir: String,
    pub storage_dir: String,
    pub tmp_dir: String,
}

impl ServerConfig {
    pub fn from_env() -> Result<Self> {
        let address =
            std::env::var("YELKEN_BIND_ADDRESS").context("YELKEN_BIND_ADDRESS is not defined")?;

        let address: SocketAddrV4 = address
            .parse()
            .context("invalid YELKEN_BIND_ADDRESS is given")?;

        let app_assets_dir = std::env::var("YELKEN_APP_ASSETS_DIR")
            .context("YELKEN_APP_ASSETS_DIR is not defined")?;

        let storage_dir =
            std::env::var("YELKEN_STORAGE_DIR").context("YELKEN_STORAGE_DIR is not defined")?;

        let tmp_dir = std::env::var("YELKEN_TMP_DIR").context("YELKEN_TMP_DIR is not defined")?;

        Ok(Self {
            address,
            app_assets_dir,
            storage_dir,
            tmp_dir,
        })
    }
}

fn db_config_from_env() -> Result<DatabaseConfig> {
    if let Ok(url) = std::env::var("YELKEN_DATABASE_URL") {
        return Ok(DatabaseConfig { url });
    }

    let backend = std::env::var("YELKEN_DATABASE_PROTOCOL")
        .context("YELKEN_DATABASE_PROTOCOL is not defined")?;

    let host =
        std::env::var("YELKEN_DATABASE_HOST").context("YELKEN_DATABASE_HOST is not defined")?;

    let database =
        std::env::var("YELKEN_DATABASE_NAME").context("YELKEN_DATABASE_NAME is not defined")?;

    let user =
        std::env::var("YELKEN_DATABASE_USER").context("YELKEN_DATABASE_USER is not defined")?;

    let password = std::env::var("YELKEN_DATABASE_PASSWORD")
        .context("YELKEN_DATABASE_PASSWORD is not defined")?;

    Ok(DatabaseConfig {
        url: format!("{backend}://{user}:{password}@{host}/{database}"),
    })
}

fn config_from_env() -> Result<Config> {
    const DEFAULT_UPLOAD_SIZE_LIMIT: usize = 2048 * 1024;

    let env = std::env::var("YELKEN_ENV").context("YELKEN_ENV is not defined")?;

    let site_url = std::env::var("YELKEN_SITE_URL")
        .context("YELKEN_SITE_URL is not defined")?
        .parse()
        .context("YELKEN_SITE_URL is not a valid url")?;

    let app_url = std::env::var("YELKEN_APP_URL")
        .context("YELKEN_APP_URL is not defined")?
        .parse()
        .context("YELKEN_APP_URL is not a valid url")?;

    let reload_templates = std::env::var("YELKEN_RELOAD_TEMPLATES")
        .map(|var| var.as_str() == "on" || var.as_str() == "true" || var.as_str() == "yes")
        .unwrap_or(false);

    let upload_size_limit = if let Ok(var) = std::env::var("YELKEN_UPLOAD_SIZE_LIMIT") {
        let limit: usize = var
            .parse()
            .context("YELKEN_UPLOAD_SIZE_LIMIT is not a valid number")?;

        limit * 1024
    } else {
        DEFAULT_UPLOAD_SIZE_LIMIT
    };

    Ok(Config {
        env,
        site_url,
        app_url,
        reload_templates,
        upload_size_limit,
    })
}

async fn logger(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();
    let method = req.method().to_owned();

    let start = Instant::now();

    let res = next.run(req).await;

    log::info!(
        "{} {:?} - {} - {}",
        method,
        path,
        res.status(),
        Instant::now().duration_since(start).as_secs_f32()
    );

    res
}

async fn run_command(command: Command, crypto: &Crypto, db_url: &str) {
    match command {
        Command::Migrate => {
            setup::migrate(
                &mut <SyncConnection as diesel::Connection>::establish(&db_url).unwrap(),
            )
            .unwrap();
        }
        Command::Setup {
            admin,
            values,
            check,
        } => {
            let mut conn = <SyncConnection as diesel::Connection>::establish(&db_url).unwrap();

            let create_admin =
                admin && !(check && setup::check_admin_initialized(&mut conn).unwrap());

            let admin_user = if create_admin {
                #[cfg(feature = "cloud")]
                {
                    let user = auth::fetch_cloud_app_owner().await.unwrap();

                    Some(setup::User {
                        name: user.name,
                        email: user.email,
                        login: setup::Login::Cloud(user.id),
                    })
                }

                #[cfg(not(feature = "cloud"))]
                Some(
                    serde_json::from_reader::<_, setup::User>(std::io::stdin())
                        .map_err(|_| "Failed to parse setup information from standart input")
                        .unwrap(),
                )
            } else {
                None
            };

            let values = values && !(check && setup::check_values_initialized(&mut conn).unwrap());

            setup::initialize_db(&mut conn, &crypto, values, admin_user).unwrap();
        }
    }
}

#[tokio::main]
async fn main() {
    dotenvy::from_path("./.env").ok();

    env_logger::init();

    let args = Args::parse();

    let crypto = Crypto::new(
        std::env::var("YELKEN_SECRET_KEY")
            .expect("YELKEN_SECRET_KEY is not provided in env")
            .as_str(),
    );

    let db_config = db_config_from_env().unwrap();

    if let Some(command) = args.command {
        run_command(command, &crypto, &db_config.url).await;

        return;
    }

    let db_config = AsyncDieselConnectionManager::<Connection>::new(&db_config.url);
    let pool = deadpool::Pool::builder(db_config).build().unwrap();

    let config = config_from_env().unwrap();
    let server_config = ServerConfig::from_env().unwrap();

    let storage = {
        let builder = opendal::services::Fs::default().root(&server_config.storage_dir);

        opendal::Operator::new(builder).unwrap().finish()
    };

    let app_assets_storage = {
        let builder = opendal::services::Fs::default().root(&server_config.app_assets_dir);

        opendal::Operator::new(builder).unwrap().finish()
    };

    let tmp_storage = {
        let builder = opendal::services::Fs::default().root(&server_config.tmp_dir);

        opendal::Operator::new(builder).unwrap().finish()
    };

    let app = yelken::router(
        crypto,
        config,
        pool,
        storage,
        app_assets_storage,
        tmp_storage,
    )
    .await
    .layer(axum::middleware::from_fn(logger));

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
