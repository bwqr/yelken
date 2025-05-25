use std::future::{Future, IntoFuture};

pub trait IntoSendFuture {
    type Output;

    type IntoFuture: std::future::Future<Output = Self::Output>;

    fn into_send_future(self) -> Self::IntoFuture;
}

#[cfg(not(target_family = "wasm"))]
impl<T: IntoFuture + Send> IntoSendFuture for T
where
    T::IntoFuture: Send,
{
    type Output = T::Output;

    type IntoFuture = T::IntoFuture;

    fn into_send_future(self) -> Self::IntoFuture {
        self.into_future()
    }
}

#[cfg(target_family = "wasm")]
impl<T: IntoFuture> IntoSendFuture for T {
    type Output = T::Output;

    type IntoFuture = send_wrapper::SendWrapper<T::IntoFuture>;

    fn into_send_future(self) -> Self::IntoFuture {
        send_wrapper::SendWrapper::new(self.into_future())
    }
}

#[cfg(not(target_family = "wasm"))]
pub fn spawn_blocking<F, R>(f: F) -> impl Future<Output = Result<R, tokio::task::JoinError>>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    tokio::runtime::Handle::current().spawn_blocking(f)
}

#[cfg(target_family = "wasm")]
pub fn spawn_blocking<F, R>(f: F) -> impl Future<Output = Result<R, std::convert::Infallible>>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    async move { Ok(f()) }
}

#[cfg(not(target_family = "wasm"))]
pub fn block_on<F: std::future::Future>(f: F) -> F::Output {
    tokio::runtime::Handle::current().block_on(f)
}

#[cfg(target_family = "wasm")]
/// Use this fn wisely. Any future that does not return immediately Poll:Ready will panic.
/// This fn is used for running AsyncSqliteConnection futures to be used inside render.
/// This is copied from [worst_executor](https://docs.rs/worst-executor/latest/worst_executor/).
pub fn block_on<F: std::future::Future>(f: F) -> F::Output {
    use core::pin::pin;
    use core::ptr::null;
    use core::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

    static WAKER: Waker = {
        const RAW_WAKER: RawWaker = RawWaker::new(
            null(),
            &RawWakerVTable::new(|_| RAW_WAKER, |_| (), |_| (), |_| ()),
        );
        unsafe { Waker::from_raw(RAW_WAKER) }
    };

    let mut f = pin!(f);
    loop {
        match f.as_mut().poll(&mut Context::from_waker(&WAKER)) {
            Poll::Ready(r) => break r,
            Poll::Pending => panic!(
                "cannot block on not ready futures since wasm does not provide a blocking api"
            ),
        }
    }
}
