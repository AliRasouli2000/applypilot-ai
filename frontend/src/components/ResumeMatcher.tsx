
import { useState, type FormEvent } from "react";
import {
  matchResume,
  type ResumeMatchResult,
} from "../api/ai";

type ResumeMatcherProps = {
  token: string;
  onLogout: () => void;
};

export default function ResumeMatcher({
  token,
  onLogout,
}: ResumeMatcherProps) {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<ResumeMatchResult | null>(null);

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await matchResume(
        token,
        resumeText.trim(),
        jobDescription.trim()
      );

      setResult(response.analysis);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "SESSION_EXPIRED"
      ) {
        onLogout();
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const canAnalyze =
    resumeText.trim().length >= 100 &&
    jobDescription.trim().length >= 100 &&
    resumeText.trim().length <= 30000 &&
    jobDescription.trim().length <= 30000 &&
    !loading;

  return (
    <section className="form-section">
      <h2>AI Resume Matcher</h2>

      <p>
        Compare your resume against a job description
        and discover ways to improve your match.
      </p>

      <form onSubmit={handleAnalyze}>
        <div className="form-grid">
          <label>
            Your Resume
            <textarea
              rows={10}
              value={resumeText}
              onChange={(event) =>
                setResumeText(event.target.value)
              }
              placeholder="Paste your resume here..."
              maxLength={30000}
              required
            />
          </label>

          <label>
            Job Description
            <textarea
              rows={10}
              value={jobDescription}
              onChange={(event) =>
                setJobDescription(event.target.value)
              }
              placeholder="Paste the job description here..."
              maxLength={30000}
              required
            />
          </label>
        </div>

        <p>
          Up to 5 AI analyses per day.
          Each field requires at least 100 characters.
        </p>

        <button type="submit" disabled={!canAnalyze}>
          {loading ? "Analyzing..." : "Analyze Resume Match"}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div
          className="applications-section"
          style={{ marginTop: "24px" }}
        >
          <h2>AI Match Results</h2>

          <div className="statistics-grid">
            <div className="stat-card">
              <p>Resume Match Score</p>
              <h3>{result.match_score}/100</h3>
            </div>
          </div>

          <p>
            <small>
              This is an AI-generated estimate of job
              alignment, not an official ATS score.
            </small>
          </p>

          <h3>Summary</h3>
          <p>{result.summary}</p>

          <h3>Matched Skills</h3>
          {result.matched_skills.length > 0 ? (
            <ul>
              {result.matched_skills.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p>No matching skills identified.</p>
          )}

          <h3>Missing Skills</h3>
          {result.missing_skills.length > 0 ? (
            <ul>
              {result.missing_skills.map((skill, index) => (
                <li key={index}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p>No missing skills identified.</p>
          )}

          <h3>Your Strengths</h3>
          <ul>
            {result.strengths.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>

          <h3>Improvement Suggestions</h3>
          <ul>
            {result.improvement_suggestions.map(
              (suggestion, index) => (
                <li key={index}>{suggestion}</li>
              )
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
