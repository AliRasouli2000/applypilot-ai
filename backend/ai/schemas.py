
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class ResumeMatchRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    resume_text: str = Field(
        min_length=100,
        max_length=30000,
        description="The user's existing resume text",
    )
    job_description: str = Field(
        min_length=100,
        max_length=30000,
        description="The job description to compare against",
    )


class ResumeMatchResult(BaseModel):
    match_score: int = Field(ge=0, le=100)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvement_suggestions: list[str] = Field(default_factory=list)
    summary: str


class ResumeMatchResponse(BaseModel):
    analysis: ResumeMatchResult


class AIUsageStatus(BaseModel):
    limit: int
    used: int
    remaining: int
    resets_at: datetime
