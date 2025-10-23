import ArrowRight from 'bootstrap-icons/icons/arrow-right.svg';
import { type JSX, useContext } from "solid-js";
import { LocaleContext } from "./lib/i18n";
import config from './lib/config';

export default function Dashboard(): JSX.Element {
    const i18n = useContext(LocaleContext)!.i18n.dashboard;

    return (
        <div class="container py-4 px-md-4">
            <div class="row g-4">
                <div class="col-md-12">
                    <div class="rounded p-3" style="background: var(--custom-bg)">
                        <p class="m-0">{i18n.welcome()}</p>
                    </div>
                </div>
                <div class="col-md-12">
                    <div class="rounded p-3" style="background: var(--custom-bg)">
                        <a rel="external" href={config.siteURL} class="m-0">{i18n.viewWebsite()} <ArrowRight viewBox="0 0 16 16" /></a>
                    </div>
                </div>
            </div>
        </div>
    );
}
