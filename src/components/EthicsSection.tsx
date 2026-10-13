import React from 'react';
import { ShieldCheck, Lock, AlertTriangle, Cpu, Terminal, CheckCircle2, Server, Globe } from 'lucide-react';

export const EthicsSection: React.FC = () => {
  return (
    <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-8">
      {/* 1. Ethics & Permitted Sources Policy */}
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">
            Политика разрешенных источников и этичность
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          UltraDL 4K разработан как легитимный инструмент для исследователей, авторов контента и инженеров.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Разрешенные источники контента</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Прямые HTTP/HTTPS ссылки на открытые медиафайлы.</li>
              <li>Лицензии Creative Commons (CC-BY, CC0) и Public Domain.</li>
              <li>Собственные видеофайлы пользователя, загружаемые с диска.</li>
              <li>Официальные API и экспортные сервисы правообладателей.</li>
              <li>Синтетические тестовые генераторы калибровочных таблиц 4K.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2">
            <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
              <Lock className="w-4 h-4" />
              <span>Интеграция с YouTube и обход блокировок дата-центров</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              UltraDL 4K оснащен движком <strong>yt-dlp</strong> и модулем слияния <strong>FFmpeg</strong>. YouTube блокирует облачные дата-центры (Cloud Run) антибот-проверкой («Sign in to confirm you’re not a bot»). Для легитимного получения видеопотоков до 2160p (4K UHD) используйте встроенную панель загрузки <code>cookies.txt</code> из вашей учетной записи браузера. После этого видеопоток будет загружен, объединен и проверен через 9-этапный верификатор целостности.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Genuine 4K (2160p) vs Fake Upscale */}
      <div className="pt-6 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-purple-400" />
          <h2 className="text-lg font-bold text-white">
            Принцип честного 4K (Ultra HD 3840x2160)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
          В отличие от ненадежных конвертеров, UltraDL 4K никогда не называет искусственное увеличение разрешения (upscale) настоящим 4K. Доступные варианты качества формируются строго на основе физических потоков источника (до 2160p). Если исходное видео снято в 1080p, оно будет честно помечено как Full HD.
        </p>
      </div>

      {/* 3. Black Screen Protection Mechanism */}
      <div className="pt-6 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">
            Алгоритм защиты от черного экрана и повреждений (9 этапов)
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">1–3. Заголовки и ffprobe</span>
            <p className="text-slate-400 text-[11px]">
              Проверка ненулевого размера, сигнатур Magic Bytes (ftyp, EBML) и синтаксический анализ структуры потоков.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">4–6. Декодер FFmpeg</span>
            <p className="text-slate-400 text-[11px]">
              Декодирование контрольного участка кадров через null-муксер с отслеживанием поврежденных макроблоков и NAL-пакетов.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">7–9. blackdetect & Светимость</span>
            <p className="text-slate-400 text-[11px]">
              Фильтр FFmpeg blackdetect и измерение средней яркости YAVG для исключения полностью темных или пустых кадров.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Deployment Instructions (Docker / FastAPI / Cloud Run) */}
      <div className="pt-6 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-6 h-6 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">
            Развертывание: Docker, Python FastAPI и Cloud Run
          </h2>
        </div>

        <div className="bg-[#05070c] p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <span className="text-slate-400 font-bold block">Быстрый запуск в Docker (Python 3.12 + FFmpeg):</span>
          <pre className="text-emerald-400 overflow-x-auto p-2 bg-black/50 rounded">
            {`cd backend\ndocker build -t ultradl-4k-backend .\ndocker run -p 8000:8000 ultradl-4k-backend`}
          </pre>

          <span className="text-slate-400 font-bold block mt-3">Развертывание в Google Cloud Run:</span>
          <pre className="text-blue-400 overflow-x-auto p-2 bg-black/50 rounded">
            {`gcloud run deploy ultradl-4k \\\n  --image gcr.io/PROJECT_ID/ultradl-4k-backend \\\n  --platform managed \\\n  --memory 2Gi \\\n  --cpu 2 \\\n  --allow-unauthenticated`}
          </pre>
        </div>
      </div>
    </div>
  );
};
