import React, { useRef, useState } from 'react';
import { Sliders, CheckCircle2, ShieldCheck, Upload, Volume2, VolumeX, Shuffle, AlertCircle, ArrowRight } from 'lucide-react';
import type { QualityPreset, SourceAnalysisResult } from '../types/video.ts';

interface QualityAndStreamSelectorProps {
  analysis: SourceAnalysisResult;
  selectedQuality: string;
  setSelectedQuality: (id: string) => void;
  audioAction: 'keep_audio' | 'mute_audio' | 'merge_audio';
  setAudioAction: (action: 'keep_audio' | 'mute_audio' | 'merge_audio') => void;
  allowReencode: boolean;
  setAllowReencode: (val: boolean) => void;
  universalWindowsFormat: boolean;
  setUniversalWindowsFormat: (val: boolean) => void;
  separateAudioFile: File | null;
  setSeparateAudioFile: (file: File | null) => void;
  onStartProcessing: () => void;
  isProcessing: boolean;
}

export const QualityAndStreamSelector: React.FC<QualityAndStreamSelectorProps> = ({
  analysis,
  selectedQuality,
  setSelectedQuality,
  audioAction,
  setAudioAction,
  allowReencode,
  setAllowReencode,
  universalWindowsFormat,
  setUniversalWindowsFormat,
  separateAudioFile,
  setSeparateAudioFile,
  onStartProcessing,
  isProcessing,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const resolutions = analysis.availableResolutions;

  return (
    <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-6">
      {/* 1. Quality / Resolution Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Выбор разрешения</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Отображаются только физически доступные потоки
          </span>
        </div>

        {resolutions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Разрешения определяются автоматически из источника.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {resolutions.map((preset) => {
              const isSelected = selectedQuality === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedQuality(preset.id)}
                  className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/40 shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500/50'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      {preset.label}
                    </span>
                    {preset.is4K && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        4K UHD
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <span>{preset.width}x{preset.height} px</span>
                    <span className={preset.isNative ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                      {preset.isNative ? 'Оригинал источника' : 'Масштабировано'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Audio Track & Merge Controls */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Управление звуковыми дорожками</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setAudioAction('keep_audio')}
            className={`p-3 rounded-xl border text-left transition-all ${
              audioAction === 'keep_audio'
                ? 'border-emerald-500 bg-emerald-950/30 text-white ring-1 ring-emerald-500/50'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Оригинальное аудио</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Сохранить исходную звуковую дорожку контейнера
            </p>
          </button>

          <button
            type="button"
            onClick={() => setAudioAction('mute_audio')}
            className={`p-3 rounded-xl border text-left transition-all ${
              audioAction === 'mute_audio'
                ? 'border-amber-500 bg-amber-950/30 text-white ring-1 ring-amber-500/50'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span>Без звука (Mute)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Получить чистое видео без аудиопотока
            </p>
          </button>

          <button
            type="button"
            onClick={() => setAudioAction('merge_audio')}
            className={`p-3 rounded-xl border text-left transition-all ${
              audioAction === 'merge_audio'
                ? 'border-purple-500 bg-purple-950/30 text-white ring-1 ring-purple-500/50'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <Shuffle className="w-4 h-4 text-purple-400" />
              <span>Слияние потоков (FFmpeg)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Объединить видео с отдельным аудиофайлом
            </p>
          </button>
        </div>

        {/* File picker for separate audio track if merge_audio is active */}
        {audioAction === 'merge_audio' && (
          <div className="mt-4 p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2">
            <span className="text-xs font-semibold text-purple-200 block">
              Выберите внешнюю звуковую дорожку (AAC, M4A, MP3, OPUS, WAV):
            </span>
            <input
              type="file"
              ref={audioInputRef}
              accept="audio/*,.m4a,.aac,.opus,.mp3,.wav"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSeparateAudioFile(f);
              }}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить аудиофайл</span>
              </button>
              {separateAudioFile ? (
                <span className="text-xs text-purple-300 font-mono truncate">
                  Выбран: {separateAudioFile.name} ({(separateAudioFile.size / 1024 / 1024).toFixed(2)} МБ)
                </span>
              ) : (
                <span className="text-xs text-slate-400 italic">Файл еще не выбран</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Re-encode & Stream Copy Discipline */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        {/* Universal Windows & TV Playback Card */}
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
          <label className="flex items-start sm:items-center justify-between gap-3 cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Универсальный формат (H.264 AVC + AAC) — Рекомендуется</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Автоматически гарантирует 100% совместимость со встроенным Windows Media Player («Кино и ТВ»), плеерами Smart TV, смартфонами и Mac <strong>без ошибки 0xc00d5212</strong> и без необходимости скачивать сторонние программы.
              </p>
            </div>
            <input
              type="checkbox"
              checked={universalWindowsFormat}
              onChange={(e) => setUniversalWindowsFormat(e.target.checked)}
              className="w-4 h-4 mt-0.5 sm:mt-0 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 shrink-0"
            />
          </label>
        </div>

        <label className="flex items-start sm:items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={allowReencode}
            onChange={(e) => setAllowReencode(e.target.checked)}
            className="mt-0.5 sm:mt-0 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
          />
          <span className="text-xs text-slate-400">
            Разрешить быстрое перекодирование аудиопотока в AAC при несовместимости исходного контейнера
          </span>
        </label>
      </div>

      {/* 4. Action Button */}
      <div className="pt-2">
        <button
          type="button"
          disabled={isProcessing || !analysis.directDownloadAllowed}
          onClick={onStartProcessing}
          className="w-full flex items-center justify-center space-x-3 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Выполняется получение и 9-этапная проверка...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Получить и верифицировать файл</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-slate-400 mt-2">
          Файл не будет объявлен готовым («Passed»), пока не пройдет проверку на декодирование и отсутствие черного экрана.
        </p>
      </div>
    </div>
  );
};
