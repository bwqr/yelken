import { createSignal } from "solid-js";
import "./app.css";

export default function App(props: { url: string }) {
  const [count, setCount] = createSignal(0);

  return (
    <main>
      <h1>Hello world!</h1>
      <button class="increment" onClick={() => setCount(count() + 1)} type="button">
        Clicks: {count()}
      </button>
      <p>
        {props.url}
      </p>
    </main>
  );
}

