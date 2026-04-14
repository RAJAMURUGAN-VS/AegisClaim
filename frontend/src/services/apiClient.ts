/**
 * API Service Layer
 * Handles all HTTP requests to the AuthGuard AI backend
 * 
 * Environment: Use VITE_API_URL from .env
 */

import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("auth_token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Submit a new PA request with documents
   */
  async submitPARequest(formData: FormData) {
    const response = await this.client.post("/pa/submit", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  /**
   * Get PA status and decision details
   */
  async getPAStatus(paId: string) {
    const response = await this.client.get(`/pa/${paId}`);
    return response.data;
  }

  /**
   * Upload missing documents for a PA request
   */
  async uploadDocuments(paId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await this.client.post(`/pa/${paId}/documents`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  /**
   * Chat with PA context using Sonar medical advisor persona
   */
  async chatWithPAContext(paId: string, message: string) {
    const response = await this.client.post(`/pa/${paId}/chat`, { message });
    return response.data;
  }

  /**
   * Poll for PA decision status
   */
  async pollPAStatus(paId: string, maxRetries = 60, intervalMs = 500) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.getPAStatus(paId);
        if (result.status !== "PROCESSING") {
          return result;
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        // Newly-submitted requests may briefly return 404 before cache warm-up.
        if (axiosError.response?.status !== 404) {
          console.error("Error polling PA status:", error);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error("PA decision timeout");
  }
}

export const apiClient = new APIClient();