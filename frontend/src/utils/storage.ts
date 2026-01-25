const TOKEN_KEY = 'xiaohe_token';
const USER_KEY = 'xiaohe_user';

export const storage = {
  get<T>(key: string): T | null {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
  getToken() {
    return storage.get<{ accessToken: string; refreshToken: string }>(TOKEN_KEY);
  },
  setToken(tokens: { accessToken: string; refreshToken: string }) {
    storage.set(TOKEN_KEY, tokens);
  },
  removeToken() {
    storage.remove(TOKEN_KEY);
  },
  getUser() {
    return storage.get<{ id: string; phone: string; nickname?: string; avatarUrl?: string; role: string }>(USER_KEY);
  },
  setUser(user: { id: string; phone: string; nickname?: string; avatarUrl?: string; role: string }) {
    storage.set(USER_KEY, user);
  },
  removeUser() {
    storage.remove(USER_KEY);
  },
  clear() {
    this.removeToken();
    this.removeUser();
  },
};
