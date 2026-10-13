import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, Film, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { SourceAnalysisResult } from '../types/video.ts';

interface FileUploadSectionProps {
  onFileUploaded: (analysis: SourceAnalysisResult, fileId: string) => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({ onFileUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Ошибка сервера (HTTP ${res.status})`);
      }

      const data = await res.json();
      const analysis: SourceAnalysisResult = {
        isPermitted: true,
        sourceType: 'uploaded_file',
        sourceName: 'Локальный файл пользователя',
        title: data.originalName,
        probe: data.probe,
        availableResolutions: data.availableResolutions,
        thumbnailUrl: data.thumbnailUrl,
        directDownloadAllowed: true,
      };

      onFileUploaded(analysis, data.fileId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  };

  return (
    <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">
            Загрузка и проверка собственного видеофайла
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Загрузите видеофайл с компьютера (MP4, MKV, WebM, MOV) для глубокой диагностики кодеков, проверки целостности и объединения аудиодорожек.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv,.webm,.mov,.mp4,.avi"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 ${
          isDragging
            ? 'border-blue-500 bg-blue-950/30'
            : 'border-slate-700/80 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900/50'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center shadow-lg">
          {isUploading ? (
            <div className="w-7 h-7 border-3 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-blue-400" />
          )}
        </div>

        <div>
          <span className="text-base font-bold text-white block">
            {isUploading ? 'Загрузка и зондирование через ffprobe...' : 'Перетащите видеофайл сюда или нажмите для выбора'}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">
            Поддерживаются MP4, MKV, WebM, MOV до 300 МБ.
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">H.264 / HEVC / AV1 / VP9</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">До 2160p 4K</span>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Ошибка обработки файла:</strong>
            <span>{uploadError}</span>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs space-y-1">
        <span className="font-bold text-slate-300 block">Защита конфиденциальности:</span>
        <p>
          Файлы обрабатываются локально во временном хранилище контейнера и проверяются утилитами FFmpeg без передачи третьим сторонам. Временные данные автоматически очищаются.
        </p>
      </div>
    </div>
  );
};
