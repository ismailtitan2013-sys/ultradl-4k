import React, { useState } from 'react';
import { Download, CheckCircle2, AlertTriangle, XCircle, Film, Volume2, ShieldCheck, Play, Layers, ExternalLink, RefreshCw } from 'lucide-react';
import type { VerificationReport } from '../types/video.ts';

interface ResultCardProps {
  report: VerificationReport;
}

export const ResultCard: React.FC<ResultCardProps> = ({ report }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState('0');
  const [totalMb, setTotalMb] = useState('0');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const isSuccess = report.overallState === 'passed';
  const isWarning = report.overallState.startsWith('warning');
  const isFailed = !isSuccess && !isWarning;

  const getStatusBanner = () => {
    if (isSuccess) {
      return {
        bg: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-950/30 border-amber-500/40 text-amber-200',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      };
    }
    return {
      bg: 'bg-rose-950/30 border-rose-500/40 text-rose-200',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: <XCircle className="w-5 h-5 text-rose-400" />,
    };
  };

  const banner = getStatusBanner();

  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return 'Неизвестно';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    return `${(bytes / 1024).toFixed(1)} КБ`;
  };

  // Resilient Blob Stream Download: completely prevents Chrome iframe download truncations!
  const handleStreamingDownload = async () => {
    if (!report.outputUrl) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      const response = await fetch(report.outputUrl);
      if (!response.ok) {
        throw new Error(`Ошибка сервера при скачивании: HTTP ${response.status}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : report.fileSize;
      const totalMbFormatted = (totalBytes / (1024 * 1024)).toFixed(1);
      setTotalMb(totalMbFormatted);

      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback for older browsers
        window.location.href = report.outputUrl;
        return;
      }

      let receivedBytes = 0;
      const chunks: BlobPart[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          setDownloadedMb((receivedBytes / (1024 * 1024)).toFixed(1));
          if (totalBytes > 0) {
            setDownloadProgress(Math.min(100, Math.round((receivedBytes / totalBytes) * 100)));
          }
        }
      }

      // Combine into Blob and trigger same-origin browser download
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = report.downloadFileName || 'video.mp4';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadError(msg);
      // Fallback
      if (report.outputUrl) {
        window.open(report.outputUrl, '_blank');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Status Banner */}
      <div className={`p-4 rounded-xl border ${banner.bg} flex flex-col sm:flex-row sm:items-start justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{banner.icon}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-white">{report.stateBadge.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${banner.badgeBg}`}>
                {report.overallState}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900/90 text-emerald-400 border border-slate-700">
                Полный размер: {formatFileSize(report.fileSize)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              {report.stateBadge.description}
            </p>
          </div>
        </div>

        {report.outputUrl && !isFailed && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleStreamingDownload}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Скачивание ({downloadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Скачать файл ({formatFileSize(report.fileSize)})</span>
                </>
              )}
            </button>

            <a
              href={report.outputUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть прямую ссылку в отдельной вкладке"
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">В новой вкладке</span>
            </a>
          </div>
        )}
      </div>

      {/* Progress Bar during browser streaming download */}
      {isDownloading && (
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Загрузка полного видеофайла в браузер (без обрезки iFrame)...</span>
            </span>
            <span className="font-mono text-emerald-300 font-bold">
              {downloadedMb} МБ из {totalMb} МБ ({downloadProgress}%)
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-150"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      {downloadError && (
        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-200 text-xs">
          Ошибка скачивания: {downloadError}. Попробуйте нажать «В новой вкладке».
        </div>
      )}

      {/* Embedded Video Preview if available */}
      {report.outputUrl && !isFailed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-blue-400" />
              <span>Проверка воспроизведения в браузере (HTML5 Video с поддержкой Range):</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {report.width}x{report.height} | {report.containerFormat} | {formatFileSize(report.fileSize)}
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner max-h-96 flex items-center justify-center">
            <video
              src={report.streamUrl || report.outputUrl}
              controls
              preload="metadata"
              poster={report.thumbnailUrl}
              className="max-h-96 w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Deep Technical Verification Report Sheet */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Технические параметры верификации (FFmpeg Probe & Decoder):</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Разрешение</span>
            <span className="text-xs sm:text-sm font-bold text-white mt-0.5 block">
              {report.width && report.height ? `${report.width}x${report.height}` : 'н/д'}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {report.width && report.width >= 3840 ? '4K Ultra HD' : 'Стандартное'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Видеокодек</span>
            <span className="text-xs sm:text-sm font-bold text-white mt-0.5 block truncate">
              {report.videoCodec || 'Отсутствует'}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {report.containerFormat}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Звуковая дорожка</span>
            <span className="text-xs sm:text-sm font-bold text-white mt-0.5 block truncate">
              {report.audioCodec || (report.hasAudio ? 'Активна' : 'Нет звука')}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {report.userMutedRequested ? 'Muted по запросу' : report.hasAudio ? 'Совместимо' : 'Warning'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Кадров проверено</span>
            <span className="text-xs sm:text-sm font-bold text-white mt-0.5 block">
              ~{report.decodedFramesCount}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {report.testedDurationSec.toFixed(1)}с теста
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Черный экран</span>
            <span className={`text-xs sm:text-sm font-bold mt-0.5 block ${report.blackRatioPercent > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {report.blackRatioPercent}% доля
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {report.blackSegments.length} сегментов
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Реальный размер</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5 block">
              {formatFileSize(report.fileSize)}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {report.durationSec.toFixed(1)}с всего
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
