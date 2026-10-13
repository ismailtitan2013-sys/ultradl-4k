import React, { useState } from 'react';
import {
  Terminal,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { TestCaseResult } from '../types/video.ts';

export const TestStandSection: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestCaseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/run-tests', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Ошибка запуска тестов (HTTP ${res.status})`);
      }
      const data: TestCaseResult[] = await res.json();
      setResults(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  return (
    <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">
              Автоматический испытательный стенд (12 сценариев)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Синтетическое тестирование целостности, защиты от черного экрана, SSRF, объединения потоков и 4K UHD через системный FFmpeg.
          </p>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={runTests}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all shrink-0 cursor-pointer"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Выполняются тесты FFmpeg...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Запустить 12 тестов на сервере</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-200 text-xs">
          <strong>Ошибка исполнения:</strong> {errorMsg}
        </div>
      )}

      {/* Summary Scoreboard */}
      {totalCount > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl font-bold text-lg ${
                passedCount === totalCount
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
              }`}
            >
              {passedCount} / {totalCount}
            </div>
            <div>
              <span className="text-sm font-bold text-white block">
                {passedCount === totalCount
                  ? 'Все тестовые сценарии пройдены успешно!'
                  : 'Обнаружены несоответствия в тестах'}
              </span>
              <span className="text-xs text-slate-400">
                100% реальное исполнение FFmpeg, ffprobe и SSRF фильтрации.
              </span>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-400 hidden sm:block">
            Общее время: {results.reduce((acc, r) => acc + r.durationMs, 0)} мс
          </span>
        </div>
      )}

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400 font-medium">
              Нажмите кнопку «Запустить 12 тестов на сервере» для старта синтетических проверок FFmpeg.
            </p>
            <p className="text-xs text-slate-400">
              Тесты не скачивают внешние файлы, а генерируют строго контролируемые синтетические медиапотоки.
            </p>
          </div>
        ) : (
          results.map((test, idx) => (
            <div
              key={test.id}
              onClick={() => setSelectedTest(selectedTest?.id === test.id ? null : test)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                test.passed
                  ? 'bg-emerald-950/10 border-emerald-800/40 hover:border-emerald-700/60'
                  : 'bg-rose-950/20 border-rose-800/50 hover:border-rose-700/70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-400">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-100">
                      {test.name}
                    </span>
                  </div>
                  {test.passed ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>УСПЕШНО</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
                      <XCircle className="w-3 h-3" />
                      <span>ПРОВАЛЕНО</span>
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-indigo-400 font-medium block mt-1">
                  Категория: {test.category}
                </span>

                <div className="mt-2 text-xs space-y-1">
                  <div className="text-slate-400 text-[11px]">
                    <strong className="text-slate-300">Ожидание:</strong> {test.expectedOutcome}
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    <strong className="text-slate-200">Факт:</strong> {test.actualOutcome}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                <span className="font-mono">{test.durationMs} мс</span>
                <span className="text-blue-400 font-medium hover:underline flex items-center gap-0.5">
                  {selectedTest?.id === test.id ? 'Скрыть лог' : 'Подробный лог'}
                  {selectedTest?.id === test.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
              </div>

              {selectedTest?.id === test.id && (
                <div className="mt-3 p-2.5 rounded-lg bg-[#05070c] border border-slate-800 font-mono text-[10px] text-slate-300 space-y-0.5">
                  <span className="text-slate-400 font-bold block mb-1">События теста:</span>
                  {test.log.map((l, i) => (
                    <div key={i} className="text-slate-300 truncate">{l}</div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
