import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Copy,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { VerificationStep, VerificationReport } from '../types/video.ts';

interface VerificationPipelineViewProps {
  steps: VerificationStep[];
  logs: string[];
  isProcessing: boolean;
  report: VerificationReport | null;
}

export const VerificationPipelineView: React.FC<VerificationPipelineViewProps> = ({
  steps,
  logs,
  isProcessing,
  report,
}) => {
  const [copied, setCopied] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: VerificationStep['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'running':
        return <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin shrink-0" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  return (
    <div className="bg-[#0b0e17] rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>9-Этапный конвейер верификации (FFmpeg Guard)</span>
              {isProcessing && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 animate-pulse">
                  Выполняется
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Глубокая защита от черного экрана, битых кадров и поврежденных контейнеров
            </p>
          </div>
        </div>

        {report && (
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                report.overallState === 'passed'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40'
                  : report.overallState.startsWith('warning')
                  ? 'bg-amber-950/40 text-amber-300 border-amber-600/40'
                  : 'bg-rose-950/40 text-rose-300 border-rose-600/40'
              }`}
            >
              {report.stateBadge.label}
            </span>
          </div>
        )}
      </div>

      {/* 9-Step Verification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {steps.map((step) => {
          let bgClass = 'bg-slate-900/40 border-slate-800/80 text-slate-400';
          if (step.status === 'passed') bgClass = 'bg-emerald-950/15 border-emerald-800/40 text-slate-200';
          if (step.status === 'warning') bgClass = 'bg-amber-950/15 border-amber-800/40 text-slate-200';
          if (step.status === 'failed') bgClass = 'bg-rose-950/20 border-rose-800/50 text-rose-200';
          if (step.status === 'running') bgClass = 'bg-blue-950/25 border-blue-600/50 text-white';

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${bgClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Шаг {step.stepNumber}/9
                </span>
                {getStatusIcon(step.status)}
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-slate-100 block">{step.title}</span>
                {step.details && (
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 font-mono">
                    {step.details}
                  </p>
                )}
              </div>
              <span className="text-[9px] text-slate-400 mt-2 block font-mono">
                {step.timestamp}
              </span>
            </div>
          );
        })}
      </div>

      {/* Real-time Status Journal / Terminal Logs */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>Журнал событий и проверок ({logs.length})</span>
            {logsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={copyLogs}
            className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition-colors"
          >
            <Copy className="w-3 h-3" />
            <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
          </button>
        </div>

        {logsExpanded && (
          <div
            ref={terminalRef}
            className="bg-[#05070c] rounded-xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300 h-44 overflow-y-auto space-y-1 select-text"
          >
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">Ожидание запуска задачи...</span>
            ) : (
              logs.map((line, idx) => {
                let color = 'text-slate-300';
                if (line.includes('PASSED') || line.includes('УСПЕШНО')) color = 'text-emerald-400';
                if (line.includes('WARNING') || line.includes('Внимание')) color = 'text-amber-400';
                if (line.includes('FAILED') || line.includes('Ошибка') || line.includes('КРИТИЧЕСКАЯ')) color = 'text-rose-400';
                if (line.includes('SSRF') || line.includes('Черный экран')) color = 'text-purple-300 font-semibold';

                return (
                  <div key={idx} className={`${color} leading-relaxed`}>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
