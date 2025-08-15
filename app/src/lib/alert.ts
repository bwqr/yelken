import { createContext, type Context } from "solid-js";
import { createStore, produce, reconcile, type SetStoreFunction } from "solid-js/store";

export interface AlertStore {
    success(title: string): void;
    fail(title: string): void;
}

export const AlertContext: Context<AlertStore | undefined> = createContext();

export enum AlertState {
    Success,
    Failure,
}

interface Alert {
    title: string;
    state: AlertState;
}

export interface DisposableAlert extends Alert {
    expire: number;
}

export class AlertService implements AlertStore {
    alerts: DisposableAlert[];
    private setAlerts: SetStoreFunction<DisposableAlert[]>;

    private timeoutId: NodeJS.Timeout | undefined = undefined;
    private readonly timeout = 5 * 1000;

    constructor() {
        [this.alerts, this.setAlerts] = createStore([] as DisposableAlert[]);
    }

    success(title: string) {
        this.fireAlert(AlertState.Success, title)
    }

    fail(title: string) {
        this.fireAlert(AlertState.Failure, title)
    }

    removeAlert(alert: DisposableAlert) {
        const index = this.alerts.findIndex((a) => a === alert);

        if (index > -1) {
            this.setAlerts(produce((alerts) => alerts.splice(index, 1)));
        }
    }

    private fireAlert(state: AlertState, title: string) {
        const alert: DisposableAlert = {
            expire: new Date().getTime() + this.timeout,
            title,
            state,
        };

        this.setAlerts(produce((alerts) => alerts.unshift(alert)));

        if (this.timeoutId === undefined) {
            this.timeoutId = setTimeout(() => this.cleanAlerts(), this.timeout);
        }
    }

    private cleanAlerts() {
        const now = new Date().getTime();

        this.setAlerts(reconcile(this.alerts.filter((alert) => alert.expire > now)));
        this.timeoutId = undefined;

        const earliestExpire = this.alerts.reduce<number | undefined>((expire, alert) => {
            if (expire === undefined) {
                return alert.expire;
            }

            return alert.expire < expire ? alert.expire : expire;
        }, undefined);

        if (earliestExpire !== undefined) {
            this.timeoutId = setTimeout(() => this.cleanAlerts(), earliestExpire - now);
        }
    }
}
