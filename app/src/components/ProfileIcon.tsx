import { type JSX } from "solid-js";

export default function(props: { name: string }): JSX.Element {
    const firstLetters = () => props.name.split(' ').map((word) => word[0]?.toUpperCase());

    return (
        <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor" class="text-primary">
            <circle cx="8" cy="8" r="8" />
            <text x="50%" y="55%" fill="white" font-size="8" dominant-baseline="middle" text-anchor="middle">{firstLetters()}</text>
        </svg>
    );
}
