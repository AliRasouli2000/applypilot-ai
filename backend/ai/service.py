
import os

from dotenv import load_dotenv
from fastapi import HTTPException
from openai import AsyncOpenAI, OpenAIError

from ai.prompts import RESUME_MATCH_SYSTEM_PROMPT
from ai.schemas import ResumeMatchRequest, ResumeMatchResult

load_dotenv()

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")


async def analyze_resume(
    request: ResumeMatchRequest,
) -> ResumeMatchResult:
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI matching is not configured.",
        )

    client = AsyncOpenAI(
        api_key=api_key,
        timeout=30.0,
        max_retries=1,
    )

    try:
        response = await client.responses.parse(
            model=OPENAI_MODEL,
            instructions=RESUME_MATCH_SYSTEM_PROMPT,
            input=[
                {
                    "role": "user",
                    "content": (
                        "Analyze the following resume against "
                        "the job description.\n\n"
                        "<resume>\n"
                        f"{request.resume_text}\n"
                        "</resume>\n\n"
                        "<job_description>\n"
                        f"{request.job_description}\n"
                        "</job_description>"
                    ),
                }
            ],
            text_format=ResumeMatchResult,
            max_output_tokens=1500,
        )

        if response.output_parsed is None:
            raise HTTPException(
                status_code=502,
                detail="AI analysis could not be completed.",
            )

        return response.output_parsed

    except OpenAIError:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable.",
        )
