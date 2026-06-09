'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BackgroundContainer from '@/components/common/background-container';
import { Button } from '@/components/ui/button';
import { batchMatch, type BatchMatchData, type MatchResultItem } from '@/lib/api/match';

// Simple markdown to HTML converter (same pattern as dashboard)
const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  let html = markdown;
  html = html.replace(/^#### (.*$)/gm, '<h4 class="text-lg font-bold text-white mt-4 mb-2">$1</h4>');
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold text-white mt-5 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-white mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-yellow-300">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 p-4 rounded-lg my-3 overflow-x-auto"><code class="text-sm text-green-300">$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-gray-900 px-1 py-0.5 rounded text-sm text-green-300">$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\n/g, '<br>');
  return html;
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

const getScoreBg = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getScoreEmoji = (score: number) => {
  if (score >= 85) return '🎯';
  if (score >= 70) return '👍';
  if (score >= 55) return '📝';
  return '🔍';
};

function MatchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeId = searchParams.get('resume_id')!;
  const jdsParam = searchParams.get('jds');

  const [data, setData] = useState<BatchMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!resumeId || !jdsParam) {
      setError('缺少必要参数。请先上传简历并输入岗位描述。');
      setLoading(false);
      return;
    }

    let jds: string[];
    try {
      jds = JSON.parse(decodeURIComponent(jdsParam));
    } catch {
      setError('岗位描述数据解析失败。');
      setLoading(false);
      return;
    }

    if (!Array.isArray(jds) || jds.length === 0) {
      setError('没有有效的岗位描述。');
      setLoading(false);
      return;
    }

    batchMatch(resumeId, jds)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Batch match error:', err);
        setError(err.message || '匹配分析失败，请稍后重试。');
        setLoading(false);
      });
  }, [resumeId, jdsParam]);

  if (loading) {
    return (
      <BackgroundContainer className="min-h-screen" innerClassName="bg-zinc-950 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center h-full p-6 text-gray-400">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400 mb-4" />
          <p className="text-lg">正在分析岗位匹配度...</p>
          <p className="text-sm mt-2 text-gray-500">AI 正在逐一评估每个岗位与您的简历匹配情况</p>
        </div>
      </BackgroundContainer>
    );
  }

  if (error) {
    return (
      <BackgroundContainer className="min-h-screen" innerClassName="bg-zinc-950 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center h-full p-6 text-gray-400">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-lg text-red-400">出错了</p>
          <p className="text-sm mt-2">{error}</p>
          <Button
            onClick={() => router.back()}
            className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
          >
            返回重试
          </Button>
        </div>
      </BackgroundContainer>
    );
  }

  return (
    <BackgroundContainer className="min-h-screen" innerClassName="bg-zinc-950 backdrop-blur-sm overflow-auto">
      <div className="w-full h-full overflow-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold pb-2 text-white">
              🎯{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
                Offer 捕手
              </span>{' '}
              匹配结果
            </h1>
            {data && (
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm">
                  共分析 {data.total_jobs} 个岗位
                </span>
                <span className="px-3 py-1 bg-green-900/50 text-green-300 rounded-full text-sm">
                  {data.match_count} 个岗位匹配度 ≥ 60%
                </span>
                <span className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm">
                  最高匹配 {data.top_score}%
                </span>
              </div>
            )}
            <p className="text-gray-400 text-sm mt-2">{data?.summary}</p>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {data?.results.map((item: MatchResultItem) => {
              const isExpanded = expandedIndex === item.job_index;
              const isTop = item.job_index === data.results[0]?.job_index;

              return (
                <div
                  key={item.job_index}
                  className={`bg-gray-900/70 backdrop-blur-sm rounded-lg border transition-all duration-200 ${
                    isTop ? 'border-purple-500/50 shadow-lg shadow-purple-500/10' : 'border-gray-800/50'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className="p-5 cursor-pointer flex items-center gap-4"
                    onClick={() => setExpandedIndex(isExpanded ? null : item.job_index)}
                  >
                    {/* Rank Badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-300">
                      {item.job_index + 1}
                    </div>

                    {/* Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold truncate">
                          {getScoreEmoji(item.match_score)} {item.job_title}
                        </h3>
                        {isTop && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                            最佳匹配
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            分析失败
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <div className={`text-2xl font-bold ${getScoreColor(item.match_score)}`}>
                        {item.match_score}
                      </div>
                      <div className="text-sm text-gray-500">分</div>
                    </div>

                    {/* Score Bar */}
                    <div className="flex-shrink-0 w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getScoreBg(item.match_score)}`}
                        style={{ width: `${item.match_score}%` }}
                      />
                    </div>

                    {/* Expand Arrow */}
                    <div className="flex-shrink-0 text-gray-500">
                      <svg
                        className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-800/50 pt-4">
                      <div
                        className="prose prose-invert max-w-none text-gray-200 text-sm bg-gray-800/50 p-4 rounded-lg max-h-[60vh] overflow-y-auto"
                        dangerouslySetInnerHTML={{
                          __html: convertMarkdownToHtml(item.analysis_result),
                        }}
                      />
                      {item.status === 'error' && item.error && (
                        <p className="text-red-400 text-sm mt-2">错误详情: {item.error}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* No results */}
          {(!data || data.results.length === 0) && (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg">暂无匹配结果</p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="mt-8 flex justify-center gap-4">
            <Button
              onClick={() => router.push('/app/jobs')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2"
            >
              🔄 重新匹配其他岗位
            </Button>
            <Button
              onClick={() => router.push('/app/resume')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2"
            >
              📄 上传新简历
            </Button>
          </div>
        </div>
      </div>
    </BackgroundContainer>
  );
}

export default function MatchResultsPage() {
  return (
    <Suspense fallback={
      <BackgroundContainer className="min-h-screen" innerClassName="bg-zinc-950">
        <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>
      </BackgroundContainer>
    }>
      <MatchResultsContent />
    </Suspense>
  );
}
