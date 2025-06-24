import { createContext, createSignal, type Accessor, type Context } from "solid-js";
import type { User } from "./models";
import { Api } from "../api";

export interface UserStore {
    user: Accessor<User>,
}

export const UserContext: Context<UserStore | undefined> = createContext();

export class UserService implements UserStore {
    public user: Accessor<User>;

    constructor(user: User) {
        [this.user] = createSignal(user);
    }

    public static async fetchUser(): Promise<User> {
        return Api.get('/user/profile');
    }
}
