import asyncio
import logging

from datetime import datetime
from typing import Dict, List

from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.prompt import prompt_factory
from app.agent import AgentManager
from app.models import Resume
from .exceptions import (
    ResumeNotFoundError,
)

logger = logging.getLogger(__name__)


class BatchMatchService:
    """
    Service for batch matching one student resume against multiple job descriptions.
    Returns ranked results sorted by match score.
    """

    def __init__(self, db: AsyncSession, max_concurrent: int = 3):
        logger.debug(f"Initializing BatchMatchService with max_concurrent={max_concurrent}")
        self.db = db
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def _get_resume(self, resume_id: str) -> Resume:
        """Fetch resume from database."""
        query = select(Resume).where(Resume.resume_id == resume_id)
        result = await self.db.execute(query)
        resume = result.scalars().first()
        if not resume:
            raise ResumeNotFoundError(resume_id=resume_id)
        return resume

    async def _analyze_single_match(
        self, resume: Resume, job_description: str, job_index: int
    ) -> Dict:
        """
        Analyze a single resume-job match using the student HR judge prompt.
        Runs with concurrency control via semaphore.
        """
        async with self.semaphore:
            try:
                # Get the student_hr_judge prompt
                prompt_template = prompt_factory.get("student_hr_judge")
                formatted_prompt = prompt_template.format(
                    Job_Description=job_description,
                    raw_resume=resume.content,
                    datetime=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                )

                # Use MD agent for analysis (same as ScoreImprovementService)
                md_agent_manager = AgentManager(strategy="md")
                analysis_result = await md_agent_manager.run(formatted_prompt)

                # Extract job title from description (first line or common patterns)
                job_title = self._extract_job_title(job_description)

                # Extract a rough match score from the analysis
                match_score = self._extract_match_score(analysis_result)

                return {
                    "job_index": job_index,
                    "job_title": job_title,
                    "job_description": job_description[:300] + "..." if len(job_description) > 300 else job_description,
                    "match_score": match_score,
                    "analysis_result": analysis_result,
                    "status": "completed",
                }

            except Exception as e:
                logger.error(f"Error analyzing match for job index {job_index}: {e}")
                return {
                    "job_index": job_index,
                    "job_title": self._extract_job_title(job_description),
                    "job_description": job_description[:300] + "..." if len(job_description) > 300 else job_description,
                    "match_score": 0,
                    "analysis_result": f"分析出错: {str(e)}",
                    "status": "error",
                    "error": str(e),
                }

    def _extract_job_title(self, job_description: str) -> str:
        """Extract a likely job title from the description."""
        first_line = job_description.strip().split("\n")[0].strip()
        # Remove markdown headers
        first_line = first_line.lstrip("#").strip()
        if len(first_line) > 60:
            first_line = first_line[:60] + "..."
        return first_line or "未知岗位"

    def _extract_match_score(self, analysis_result: str) -> int:
        """
        Extract a numeric match score from the analysis text.
        Looks for patterns like '匹配度评分：75' or '匹配度：80分' or '85/100'.
        If not found, estimates based on sentiment keywords.
        """
        import re

        # Try explicit score patterns
        patterns = [
            r"匹配度[评分：:]\s*(\d+)",
            r"匹配[度分].*?(\d+)\s*分",
            r"(\d+)\s*/\s*100",
            r"评分[：:]\s*(\d+)",
            r"match.*?score.*?(\d+)",
            r"综合评分[：:]\s*(\d+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, analysis_result, re.IGNORECASE)
            if match:
                score = int(match.group(1))
                return min(max(score, 0), 100)

        # Fallback: sentiment-based estimation
        positive_keywords = ["高度匹配", "非常匹配", "优秀", "突出", "完美", "极佳"]
        negative_keywords = ["不匹配", "差距较大", "不适合", "严重不足"]

        positive_count = sum(1 for kw in positive_keywords if kw in analysis_result)
        negative_count = sum(1 for kw in negative_keywords if kw in analysis_result)

        if positive_count >= 3 and negative_count == 0:
            return 85
        elif positive_count >= 2:
            return 70
        elif positive_count >= 1:
            return 60
        elif negative_count >= 2:
            return 30
        elif negative_count >= 1:
            return 45
        else:
            return 55

    async def run(self, resume_id: str, job_descriptions: List[str]) -> Dict:
        """
        Main method: match one resume against multiple job descriptions.
        Returns ranked results sorted by match score (descending).
        """
        logger.info(
            f"Starting BatchMatchService.run for resume_id={resume_id}, "
            f"num_jobs={len(job_descriptions)}"
        )

        # Validate inputs
        if not job_descriptions:
            return {
                "resume_id": resume_id,
                "total_jobs": 0,
                "results": [],
                "summary": "没有提供岗位描述。",
            }

        # Fetch resume
        resume = await self._get_resume(resume_id)

        # Analyze all matches concurrently (with semaphore limit)
        tasks = [
            self._analyze_single_match(resume, jd, idx)
            for idx, jd in enumerate(job_descriptions)
        ]
        results = await asyncio.gather(*tasks)

        # Sort by match score descending
        results.sort(key=lambda x: x["match_score"], reverse=True)

        # Generate summary
        top_score = results[0]["match_score"] if results else 0
        match_count = sum(1 for r in results if r["match_score"] >= 60)

        summary = (
            f"共分析 {len(results)} 个岗位，"
            f"其中 {match_count} 个岗位匹配度达到60%以上。"
            f"最佳匹配岗位：{results[0]['job_title']}（匹配度 {top_score}%）。"
            if results
            else "无匹配结果。"
        )

        return {
            "resume_id": resume_id,
            "total_jobs": len(results),
            "match_count": match_count,
            "top_score": top_score,
            "summary": summary,
            "results": results,
        }
