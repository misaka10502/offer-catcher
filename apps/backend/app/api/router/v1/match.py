import logging
import traceback

from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List

from app.core import get_db_session
from app.services import (
    BatchMatchService,
    ResumeNotFoundError,
)

match_router = APIRouter()
logger = logging.getLogger(__name__)


class BatchMatchRequest(BaseModel):
    """Request model for batch matching."""
    resume_id: str = Field(..., description="Resume ID to match against jobs")
    job_descriptions: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="List of job description texts to match against (1-10)"
    )


class SingleMatchRequest(BaseModel):
    """Request model for matching one resume with one job description (quick mode)."""
    resume_id: str = Field(..., description="Resume ID")
    job_description: str = Field(..., min_length=1, description="Job description text")


@match_router.post(
    "/batch",
    summary="【Offer捕手】批量岗位匹配 — 一份简历同时匹配多个岗位，返回按匹配度排名的结果",
)
async def batch_match(
    request: Request,
    payload: BatchMatchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    学生上传一份简历后，粘贴多个岗位描述（1-10个），
    系统并发分析每个岗位与简历的匹配度，返回按匹配度降序排列的结果列表。

    每个结果包含：
    - 岗位标题
    - 匹配度评分（0-100）
    - 详细分析报告（Markdown格式）
    """
    request_id = getattr(request.state, "request_id", str(uuid4()))

    try:
        service = BatchMatchService(db=db, max_concurrent=3)
        result = await service.run(
            resume_id=payload.resume_id,
            job_descriptions=payload.job_descriptions,
        )
        return JSONResponse(
            content={
                "request_id": request_id,
                "data": result,
            },
        )

    except ResumeNotFoundError as e:
        logger.error(str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error in batch_match: {str(e)} - traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量匹配出错: {str(e)}",
        )


@match_router.post(
    "/single",
    summary="【Offer捕手】单岗位快速匹配 — 一份简历匹配一个岗位描述（不需要先上传JD）",
)
async def single_match(
    request: Request,
    payload: SingleMatchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    快速模式：直接传入简历ID和岗位描述文本，无需先上传JD。
    适合学生快速评估某个岗位。
    """
    request_id = getattr(request.state, "request_id", str(uuid4()))

    try:
        service = BatchMatchService(db=db, max_concurrent=1)
        result = await service.run(
            resume_id=payload.resume_id,
            job_descriptions=[payload.job_description],
        )
        return JSONResponse(
            content={
                "request_id": request_id,
                "data": result,
            },
        )

    except ResumeNotFoundError as e:
        logger.error(str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error in single_match: {str(e)} - traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"匹配出错: {str(e)}",
        )
