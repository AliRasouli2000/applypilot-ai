
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ai.schemas import ResumeMatchRequest, ResumeMatchResponse
from ai.service import analyze_resume
from ai.usage import reserve_ai_usage
from auth import get_current_user
from database import get_db
from models import User


router = APIRouter(
    prefix="/ai",
    tags=["AI Resume Matching"],
)


@router.post(
    "/match",
    response_model=ResumeMatchResponse,
    status_code=status.HTTP_200_OK,
)
async def match_resume(
    request: ResumeMatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Reserve one daily AI request before calling OpenAI.
    reserve_ai_usage(
        db=db,
        user_id=current_user.id,
        feature="resume_match",
    )

    result = await analyze_resume(request)

    return ResumeMatchResponse(analysis=result)
