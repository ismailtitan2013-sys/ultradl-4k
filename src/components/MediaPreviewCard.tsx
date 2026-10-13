import React from 'react';
import { Film, Volume2, VolumeX, Clock, HardDrive, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import type { SourceAnalysisResult } from '../types/video.ts';

interface MediaPreviewCardProps {
  analysis: SourceAnalysisResult;
}

export const MediaPreviewCard: React.FC<MediaPreviewCardProps> = ({ analysis }) => {
  const probe = analysis.probe;
  if (!probe) return null;

  const vStream = probe.videoStream;
  const aStream = probe.audioStream;

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return 'Неизвестно';
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="bg-[#0f1422] rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl">
      <div className="flex flex-col md:flex-row items-start gap-5">
        {/* Thumbnail or Video Graphic */}
        <div className="w-full md:w-56 h-36 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shrink-0 relative group">
          {analysis.thumbnailUrl ? (
            <img
              src={analysis.thumbnailUrl}
              alt="Превью"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-600 space-y-2">
              <Film className="w-10 h-10 text-slate-500" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                {probe.formatName.split(',')[0]}
              </span>
            </div>
          )}

          {probe.is4K && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-widest shadow-md">
              4K UHD
            </div>
          )}

          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-slate-200 text-xs font-mono">
            {formatDuration(probe.durationSec)}
          </div>
        </div>

        {/* Media Details */}
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {analysis.sourceName}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Контейнер: <strong className="text-slate-200">{probe.formatName}</strong>
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white truncate mt-1">
              {analysis.title}
            </h3>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Разрешение</span>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <span>{vStream ? `${vStream.width}x${vStream.height}` : 'Аудио'}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Длительность</span>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{formatDuration(probe.durationSec)}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Видеокодек</span>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5 truncate">
                <Film className="w-3.5 h-3.5 text-purple-400" />
                <span className="truncate">{vStream?.codecName || 'Отсутствует'}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Аудиокодек</span>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-0.5 truncate">
                {aStream ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate">{aStream.codecName}</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 text-xs">Без звука</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Warning badge if no audio */}
          {!aStream && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/20 border border-amber-600/30 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Внимание: в данном медиафайле отсутствует встроенная аудиодорожка. Вы можете объединить его с отдельным звуковым файлом ниже.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
