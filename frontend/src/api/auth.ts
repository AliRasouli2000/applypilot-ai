
import { API_URL } from "../config";

export interface AuthUser {
  id: number;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export async function registerUser(
  email: string,
  password: string
): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Registration failed"
    );
  }

  return response.json();
}

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? "Login failed"
    );
  }

  return response.json();
}

export async function getCurrentUser(
  token: string
): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Session expired or unauthorized");
  }

  return response.json();
}
