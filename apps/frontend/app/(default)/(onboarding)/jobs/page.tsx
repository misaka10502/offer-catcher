'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import BackgroundContainer from '@/components/common/background-container';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

// 从 URL 安全读取参数（静态导出兼容）
function getResumeIdFromURL(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('resume_id');
}

function JobDescriptionsContent() {
  const [jds, setJds] = useState<string[]>(['', '', '']);
  const [flash, setFlash] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [resumeId, setResumeId] = useState<string | null>(null);

  const router = useRouter();

  // 在客户端 hydration 后读取 URL 参数
  useEffect(() => {
    const id = getResumeIdFromURL();
    setResumeId(id);
    if (!id) {
      // 尝试从 sessionStorage 恢复
      const stored = sessionStorage.getItem('offer_catcher_resume_id');
      if (stored) setResumeId(stored);
    }
  }, []);

  const updateJd = useCallback((index: number, value: string) => {
    setJds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setFlash(null);
    if (status !== 'idle') setStatus('idle');
  }, [status]);

  const addJd = useCallback(() => {
    setJds((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, ''];
    });
  }, []);

  const removeJd = useCallback((index: number) => {
    setJds((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const nonEmptyJds = jds.filter((jd) => jd.trim() !== '');

  const handleMatch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (nonEmptyJds.length === 0) {
        setFlash({ type: 'error', message: '请至少输入一个岗位描述。' });
        return;
      }
      if (!resumeId) {
        setFlash({ type: 'error', message: '缺少简历ID，请先上传简历。' });
        return;
      }

      setStatus('submitting');

      // Navigate to matches page with JDs encoded in URL
      const jdsParam = encodeURIComponent(JSON.stringify(nonEmptyJds));
      router.push(`/matches?resume_id=${resumeId}&jds=${jdsParam}`);
    },
    [nonEmptyJds, resumeId, router]
  );

  const isSubmitDisabled = nonEmptyJds.length === 0 || status === 'submitting';

  return (
    <BackgroundContainer>
      <div className="flex flex-col items-center justify-center max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-4 text-white">
          🎯 输入目标岗位
        </h1>
        <p className="text-center text-gray-300 text-lg mb-2 max-w-xl">
          粘贴 1-10 个你感兴趣的岗位描述，Offer 捕手会帮你分析每个岗位与简历的匹配度并排名。
        </p>
        <p className="text-center text-gray-500 text-sm mb-8">
          💡 提示：可以从招聘网站（Boss直聘、拉勾、实习僧等）复制岗位JD
        </p>

        <form onSubmit={handleMatch} className="w-full space-y-4">
          {flash && (
            <div
              className={`p-3 mb-4 text-sm rounded-md ${
                flash.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-300'
                  : 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-300'
              }`}
              role="alert"
            >
              <p>{flash.message}</p>
            </div>
          )}

          {jds.map((jd, index) => (
            <div key={index} className="relative">
              <label
                htmlFor={`jd-${index}`}
                className="bg-zinc-950/80 text-white absolute start-1 top-0 z-10 block -translate-y-1/2 px-2 text-xs font-medium"
              >
                岗位 {index + 1} {index === 0 && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                id={`jd-${index}`}
                rows={5}
                value={jd}
                onChange={(e) => updateJd(index, e.target.value)}
                placeholder={`粘贴第 ${index + 1} 个岗位描述...
例如：
岗位名称：Java后端开发实习生
职位描述：
1. 负责公司XX系统的后端开发...
2. 参与系统架构设计...
任职要求：
- 熟悉Java、Spring Boot...
- 有项目经验者优先...`}
                className="w-full bg-gray-800/30 focus:ring-1 border rounded-md dark:border-gray-600 focus:border-purple-500 focus:ring-purple-500/50 border-gray-300"
              />
              {jds.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeJd(index)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded"
                  title="移除此岗位"
                >
                  ✕ 移除
                </button>
              )}
            </div>
          ))}

          {/* Add more button */}
          {jds.length < 10 && (
            <div className="flex justify-center">
              <Button
                type="button"
                onClick={addJd}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-1 px-4"
              >
                ＋ 添加更多岗位（{jds.length}/10）
              </Button>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-center pt-6">
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className={`font-semibold py-3 px-10 rounded-lg text-lg transition-all duration-200 ${
                isSubmitDisabled
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
              }`}
            >
              {status === 'submitting' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  正在分析...
                </>
              ) : (
                <>🚀 开始匹配（{nonEmptyJds.length} 个岗位）</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </BackgroundContainer>
  );
}

export default function ProvideJobDescriptionsPage() {
  return (
    <Suspense fallback={
      <BackgroundContainer>
        <div className="flex items-center justify-center h-full text-gray-400">加载输入界面...</div>
      </BackgroundContainer>
    }>
      <JobDescriptionsContent />
    </Suspense>
  );
}
