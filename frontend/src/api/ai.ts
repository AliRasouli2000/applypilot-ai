
const API_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001";

export type ResumeMatchResult = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  improvement_suggestions: string[];
  summary: string;
};

export type ResumeMatchResponse = {
  analysis: ResumeMatchResult;
};

export async function matchResume(
  token: string,
  resumeText: string,
  jobDescription: string
): Promise<ResumeMatchResponse> {
  const response = await fetch(`${API_URL}/ai/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      resume_text: resumeText,
      job_description: jobDescription,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("SESSION_EXPIRED");
    }

    if (response.status === 429) {
      throw new Error(
        "You've reached your daily limit of 5 AI analyses. Please try again tomorrow (UTC)."
      );
    }

    if (response.status === 422) {
      throw new Error(
        "Please enter between 100 and 30,000 characters in both fields."
      );
    }

    if (response.status === 503) {
      throw new Error("AI matching is temporarily unavailable.");
    }

    throw new Error("Resume analysis failed. Please try again.");
  }

  return (await response.json()) as ResumeMatchResponse;
}
