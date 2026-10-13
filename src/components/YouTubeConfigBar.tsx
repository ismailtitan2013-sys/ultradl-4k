import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Upload, Trash2, X, Info, ExternalLink } from 'lucide-react';

interface YouTubeConfigBarProps {
  onCookiesUpdated?: () => void;
}

export const YouTubeConfigBar: React.FC<YouTubeConfigBarProps> = ({ onCookiesUpdated }) => {
  const [hasCookies, setHasCookies] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [cookieText, setCookieText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/youtube/cookies');
      const data = await res.json();
      setHasCookies(Boolean(data.hasCookies));
    } catch {}
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSaveText = async () => {
    if (!cookieText.trim()) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/youtube/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookieText.trim() }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения cookies');
      setHasCookies(true);
      setStatusMessage({ text: 'Cookies успешно сохранены! Теперь доступно скачивание YouTube.' });
      setCookieText('');
      onCookiesUpdated?.();
      setTimeout(() => setIsOpen(false), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    setStatusMessage(null);
    const formData = new FormData();
    formData.append('cookiesFile', file);

    try {
      const res = await fetch('/api/youtube/cookies/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Ошибка загрузки файла');
      setHasCookies(true);
      setStatusMessage({ text: 'Файл cookies.txt успешно загружен и активирован!' });
      onCookiesUpdated?.();
      setTimeout(() => setIsOpen(false), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ text: msg, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      await fetch('/api/youtube/cookies/clear', { method: 'POST' });
      setHasCookies(false);
      setStatusMessage({ text: 'Cookies удалены.' });
      onCookiesUpdated?.();
    } catch {}
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-purple-400" />
          <span className="text-slate-300 font-medium">Статус авторизации YouTube:</span>
          {hasCookies ? (
            <span className="flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Cookies активны (Обход защиты ботов включен)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Cookies не загружены (может потребоваться подтверждение сессии)</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all"
          >
            {hasCookies ? 'Изменить Cookies' : 'Настроить Cookies (YouTube)'}
          </button>

          {hasCookies && (
            <button
              type="button"
              onClick={handleClear}
              title="Удалить cookies"
              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0e121d] border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Авторизация YouTube (yt-dlp Cookies)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs text-purple-200/90 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  YouTube блокирует облачные IP-адреса хостингов ошибкой <em>«Sign in to confirm you’re not a bot»</em>. Чтобы скачивать любые видео вплоть до <strong>4K UHD</strong>, загрузите ваши сессионные cookies из браузера.
                </p>
              </div>
              <p className="text-[11px] text-slate-400 pl-6">
                Как получить файл: установите бесплатное расширение браузера (например, «Get cookies.txt locally» для Chrome/Firefox), откройте YouTube и нажмите «Export».
              </p>
            </div>

            {/* Upload File button */}
            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                Вариант 1: Загрузить файл cookies.txt
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-purple-500/50 hover:border-purple-400 bg-purple-950/30 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Выбрать cookies.txt с компьютера</span>
              </button>
            </div>

            {/* Paste Textarea */}
            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                Вариант 2: Вставить текст cookies (Netscape format)
              </span>
              <textarea
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com TRUE / FALSE 1750000000 ..."
                rows={4}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs ${
                  statusMessage.isError
                    ? 'bg-rose-950/40 border border-rose-600/40 text-rose-200'
                    : 'bg-emerald-950/40 border border-emerald-600/40 text-emerald-200'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Закрыть
              </button>
              <button
                type="button"
                disabled={isSaving || !cookieText.trim()}
                onClick={handleSaveText}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить cookies'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
