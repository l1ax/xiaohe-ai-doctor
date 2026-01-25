import { makeAutoObservable, runInAction } from 'mobx';
import { authApi, User } from '../services/auth';
import { storage } from '../utils/storage';

class UserStore {
  user: User | null = null;
  accessToken: string | null = null;
  refreshToken: string | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const tokenData = storage.getToken();
    const userData = storage.getUser();
    if (tokenData && userData) {
      this.accessToken = tokenData.accessToken;
      this.refreshToken = tokenData.refreshToken;
      this.user = { ...userData, role: userData.role as 'patient' | 'doctor' };
    }
  }

  get isLoggedIn() {
    return !!this.accessToken && !!this.user;
  }

  async sendCode(phone: string) {
    try {
      this.loading = true;
      this.error = null;
      await authApi.sendCode(phone);
    } catch (e: any) {
      this.error = e.message;
      throw e;
    } finally {
      this.loading = false;
    }
  }

  async login(phone: string, verifyCode: string) {
    try {
      this.loading = true;
      this.error = null;
      const response = await authApi.login(phone, verifyCode);
      runInAction(() => {
        this.user = response.user;
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        storage.setToken({ accessToken: response.accessToken, refreshToken: response.refreshToken });
        storage.setUser(response.user);
      });
    } catch (e: any) {
      this.error = e.message;
      throw e;
    } finally {
      this.loading = false;
    }
  }

  logout() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    storage.clear();
  }

  async doRefreshToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token');
    }
    try {
      const response = await authApi.refreshToken(this.refreshToken);
      runInAction(() => {
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        storage.setToken({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      });
    } catch (e) {
      this.logout();
      throw e;
    }
  }
}

export const userStore = new UserStore();
