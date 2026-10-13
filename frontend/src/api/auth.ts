
import { API_URL } from "../config";

export interface AuthUser {
  id: number;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

type ValidationIssue = {
  loc?: (string | number)[];
};

// FastAPI returns `detail` as a string for most errors and as a
// list of field issues for validation (422) errors.
async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const fields = detail.map(
      (issue: ValidationIssue) => issue.loc?.[issue.loc.length - 1]
    );

    if (fields.includes("email")) {
      return "Enter a valid email address.";
    }

    if (fields.includes("password")) {
      return "Password must be between 8 and 128 characters.";
    }
  }

  return fallback;
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
    throw new Error(
      await readErrorMessage(response, "Registration failed. Please try again.")
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
    throw new Error(
      await readErrorMessage(response, "Login failed. Please try again.")
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
