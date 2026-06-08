const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://funny-keys-rest.loca.lt';

export interface MatchResultItem {
  job_index: number;
  job_id: string;
  job_title: string;
  job_description: string;
  match_score: number;
  analysis_result: string;
  status: 'completed' | 'error';
  error?: string;
}

export interface BatchMatchData {
  resume_id: string;
  total_jobs: number;
  match_count: number;
  top_score: number;
  summary: string;
  results: MatchResultItem[];
}

export interface BatchMatchResponse {
  request_id: string;
  data: BatchMatchData;
}

/** 批量匹配：一份简历对多个岗位 */
export async function batchMatch(
  resumeId: string,
  jobDescriptions: string[]
): Promise<BatchMatchResponse> {
  const res = await fetch(`${API_URL}/api/v1/match/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_id: resumeId,
      job_descriptions: jobDescriptions,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`批量匹配失败 (${res.status}): ${errText}`);
  }

  return res.json();
}

/** 单岗位快速匹配：无需先上传JD */
export async function singleMatch(
  resumeId: string,
  jobDescription: string
): Promise<BatchMatchResponse> {
  const res = await fetch(`${API_URL}/api/v1/match/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_id: resumeId,
      job_description: jobDescription,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`匹配失败 (${res.status}): ${errText}`);
  }

  return res.json();
}
