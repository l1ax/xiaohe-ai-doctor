import { storage } from './storage';

interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_API_BASE_URL: string;
    };
  }
}

class Request {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  }

  private getHeaders(): HeadersInit {
    const tokenData = storage.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (tokenData?.accessToken) {
      headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result: ApiResponse<T> = await response.json();
    if (result.code !== 0) {
      throw new Error(result.message || 'Request failed');
    }
    return result.data;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }
}

export const request = new Request();
