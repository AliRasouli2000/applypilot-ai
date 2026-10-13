import { useState, type FormEvent } from "react";

import { matchResume, type ResumeMatchResult } from "../api/ai";
import { getErrorMessage } from "../utils";
import {
  AlertIcon,
  CheckIcon,
  LightbulbIcon,
  SparklesIcon,
  XIcon,
} from "./Icons";
import Spinner from "./Spinner";

const MIN_LENGTH = 100;
const MAX_LENGTH = 30000;

type ResumeMatcherProps = {
  token: string;
  onSessionExpired: () => void;
};

// Score bands used for the ring color and label
function getScoreBand(score: number) {
  if (score >= 75) return { tone: "high", label: "Strong match" };
  if (score >= 50) return { tone: "medium", label: "Moderate match" };
  return { tone: "low", label: "Low match" };
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(score, 0), 100);
  const offset = circumference * (1 - clamped / 100);
  const band = getScoreBand(clamped);

  return (
    <div className={`score-ring score-${band.tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="score-track" cx="60" cy="60" r={radius} />
        <circle
          className="score-progress"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ ["--ring-length" as string]: circumference }}
        />
      </svg>
      <div className="score-value">
        <span className="score-number">{clamped}</span>
        <span className="score-max">/ 100</span>
      </div>
      <span className="visually-hidden">
        Match score {clamped} out of 100, {band.label}
      </span>
    </div>
  );
}

function CharacterCount({ length }: { length: number }) {
  const tooShort = length < MIN_LENGTH;

  return (
    <span className={`char-count ${tooShort ? "" : "char-count-ok"}`}>
      {tooShort
        ? `${length} / ${MIN_LENGTH} characters minimum`
        : `${length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`}
    </span>
  );
}

export default function ResumeMatcher({
  token,
  onSessionExpired,
}: ResumeMatcherProps) {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResumeMatchResult | null>(null);

  const resumeLength = resumeText.trim().length;
  const jobLength = jobDescription.trim().length;

  const canAnalyze =
    resumeLength >= MIN_LENGTH &&
    jobLength >= MIN_LENGTH &&
    resumeLength <= MAX_LENGTH &&
    jobLength <= MAX_LENGTH &&
    !loading;

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAnalyze) return;

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
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }

      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  const band = result ? getScoreBand(result.match_score) : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>
            Resume Matcher <span className="ai-badge">AI</span>
          </h1>
          <p className="page-subtitle">
            Compare your resume with a job description to see how well you
            match and what to improve.
          </p>
        </div>
      </div>

      <form className="card matcher-form" onSubmit={handleAnalyze}>
        <div className="matcher-inputs">
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="resume-text">Your resume</label>
              <CharacterCount length={resumeLength} />
            </div>
            <textarea
              id="resume-text"
              className="input textarea-large"
              rows={12}
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste the text of your resume here..."
              maxLength={MAX_LENGTH}
              required
            />
          </div>

          <div className="field">
            <div className="field-label-row">
              <label htmlFor="job-description">Job description</label>
              <CharacterCount length={jobLength} />
            </div>
            <textarea
              id="job-description"
              className="input textarea-large"
              rows={12}
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the full job description here..."
              maxLength={MAX_LENGTH}
              required
            />
          </div>
        </div>

        <div className="matcher-footer">
          <p className="hint">
            Up to 5 analyses per day. Each field needs at least{" "}
            {MIN_LENGTH} characters.
          </p>

          <button
            type="submit"
            className="button button-primary"
            disabled={!canAnalyze}
          >
            {loading ? <Spinner /> : <SparklesIcon />}
            {loading ? "Analyzing..." : "Analyze match"}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-error matcher-alert" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="card matcher-loading" role="status">
          <Spinner />
          <div>
            <p className="loading-title">Analyzing your resume</p>
            <p className="hint">This usually takes 10 to 20 seconds.</p>
          </div>
        </div>
      )}

      {result && band && (
        <section className="results" aria-labelledby="results-heading">
          <h2 id="results-heading" className="section-title">
            Match results
          </h2>

          <div className="results-top">
            <div className="card score-card">
              <ScoreRing score={result.match_score} />
              <p className={`score-label score-${band.tone}`}>{band.label}</p>
              <p className="hint score-disclaimer">
                AI-generated estimate, not an official ATS score.
              </p>
            </div>

            <div className="card summary-card">
              <h3 className="card-title">Summary</h3>
              <p className="summary-text">{result.summary}</p>
            </div>
          </div>

          <div className="results-grid">
            <div className="card">
              <h3 className="card-title">
                Matched skills
                <span className="count-pill">
                  {result.matched_skills.length}
                </span>
              </h3>
              {result.matched_skills.length > 0 ? (
                <ul className="skill-list">
                  {result.matched_skills.map((skill, index) => (
                    <li key={index} className="skill skill-matched">
                      <CheckIcon size={12} />
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No matching skills identified.</p>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">
                Missing skills
                <span className="count-pill">
                  {result.missing_skills.length}
                </span>
              </h3>
              {result.missing_skills.length > 0 ? (
                <ul className="skill-list">
                  {result.missing_skills.map((skill, index) => (
                    <li key={index} className="skill skill-missing">
                      <XIcon size={12} />
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No missing skills identified.</p>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">Your strengths</h3>
              {result.strengths.length > 0 ? (
                <ul className="insight-list">
                  {result.strengths.map((strength, index) => (
                    <li key={index}>
                      <span className="insight-icon insight-strength">
                        <CheckIcon size={12} />
                      </span>
                      {strength}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No specific strengths identified.</p>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">How to improve</h3>
              {result.improvement_suggestions.length > 0 ? (
                <ol className="insight-list">
                  {result.improvement_suggestions.map(
                    (suggestion, index) => (
                      <li key={index}>
                        <span className="insight-icon insight-tip">
                          <LightbulbIcon size={12} />
                        </span>
                        {suggestion}
                      </li>
                    )
                  )}
                </ol>
              ) : (
                <p className="hint">No suggestions. Nice work!</p>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
