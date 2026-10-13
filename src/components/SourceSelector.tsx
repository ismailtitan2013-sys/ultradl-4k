import React, { useState } from 'react';
import { Search, Link as LinkIcon, AlertTriangle, ExternalLink, Sparkles, CheckCircle2, ShieldAlert, Film } from 'lucide-react';
import type { SourceAnalysisResult } from '../types/video.ts';

interface SourceSelectorProps {
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: (targetUrl?: string) => void;
  isAnalyzing: boolean;
  analysisResult: SourceAnalysisResult | null;
  onSelectSynthetic4K: () => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  url,
  setUrl,
  onAnalyze,
  isAnalyzing,
  analysisResult,
  onSelectSynthetic4K,
}) => {
  const [pasteError, setPasteError] = useState<string | null>(null);

  const sampleLinks = [
    {
      title: 'Tears of Steel (Blender 4K)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      badge: '4K / HD CC-BY',
      color: 'border-blue-500/40 hover:border-blue-400 bg-blue-950/20',
    },
    {
      title: 'Big Buck Bunny (1080p)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      badge: '1080p CC-BY',
      color: 'border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/20',
    },
    {
      title: 'Apollo 11 Launch (Wikimedia)',
      url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1b/Apollo_11_Launch_-_Saturn_V.ogv/Apollo_11_Launch_-_Saturn_V.ogv.480p.vp9.webm',
      badge: 'WebM Архив',
      color: 'border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20',
    },
    {
      title: 'YouTube Тест (yt-dlp Engine)',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      badge: 'YouTube 4K / yt-dlp',
      color: 'border-purple-500/40 hover:border-purple-400 bg-purple-950/20',
    },
  ];

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setPasteError(null);
      }
    } catch {
      setPasteError('Не удалось вставить из буфера. Вставьте URL вручную (Ctrl+V).');
      setTimeout(() => setPasteError(null), 3500);
    }
  };

  return (
    <div className="bg-[#0e121d] rounded-2xl border border-slate-800/80 p-5 sm:p-7 shadow-xl shadow-black/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-400" />
            <span>Источник видео (Разрешенные протоколы)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Прямые HTTP/HTTPS ссылки на доступный контент, открытые медиа-репозитории или синтетические 4K потоки.
          </p>
        </div>

        <button
          onClick={onSelectSynthetic4K}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-600/40 text-purple-300 text-xs font-semibold transition-all shadow-sm"
        >
          <Film className="w-3.5 h-3.5 text-purple-400" />
          <span>Сгенерировать тест 4K (2160p)</span>
        </button>
      </div>

      {/* URL Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) onAnalyze(url.trim());
        }}
        className="space-y-3"
      >
        <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <LinkIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Вставьте прямую ссылку (https://example.com/video_4k.mp4) или выберите из образцов ниже..."
              className="w-full pl-10 pr-24 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute inset-y-0 right-14 pr-2 flex items-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Очистить
              </button>
            )}
            <button
              type="button"
              onClick={handlePaste}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Вставить
            </button>
          </div>

          <button
            type="submit"
            disabled={!url.trim() || isAnalyzing}
            className="flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all min-w-[150px]"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Анализ...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Анализировать</span>
              </>
            )}
          </button>
        </div>

        {pasteError && (
          <p className="text-xs text-amber-400 mt-1">{pasteError}</p>
        )}
      </form>

      {/* Preset Legal Sample Video Buttons */}
      <div className="mt-4 pt-4 border-t border-slate-800/60">
        <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Быстрый выбор проверенных открытых источников (Creative Commons / Тест):</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {sampleLinks.map((sample) => (
            <button
              key={sample.title}
              type="button"
              onClick={() => {
                setUrl(sample.url);
                onAnalyze(sample.url);
              }}
              className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between ${sample.color}`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="text-xs font-semibold text-slate-200 truncate">{sample.title}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 shrink-0">
                  {sample.badge}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono truncate mt-1 block">
                {sample.url.replace('https://', '')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Ethical warning banner if YouTube or restricted URL is detected */}
      {analysisResult?.ethicalNotice && (
        <div className="mt-5 p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-slate-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-900/40 text-rose-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-300">
                  {analysisResult.ethicalNotice.platform}: Доступ ограничен политикой платформы
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                  DRM / Условия сервиса
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                {analysisResult.ethicalNotice.reason}
              </p>
              <div className="pt-2 border-t border-rose-800/40 mt-2 text-xs text-rose-200/90 bg-rose-900/20 p-2.5 rounded-lg">
                <strong className="text-rose-100 font-semibold block mb-0.5">Официальный способ получения:</strong>
                {analysisResult.ethicalNotice.officialAlternative}
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1">
                UltraDL 4K не использует обход авторизации, CAPTCHA или закрытых медиапротоколов в соответствии с правилами этичности и безопасности.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SSRF or Network Error */}
      {analysisResult && !analysisResult.isPermitted && !analysisResult.ethicalNotice && (
        <div className="mt-5 p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-slate-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm space-y-1">
              <span className="font-bold text-amber-300">Ошибка валидации источника:</span>
              <p className="text-slate-300">{analysisResult.errorMessage || 'Адрес не может быть обработан'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
