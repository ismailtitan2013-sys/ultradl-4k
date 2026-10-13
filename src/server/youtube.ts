import path from 'node:path';
import fs from 'node:fs';
import { runProcess } from './ffmpeg.ts';
import type { SourceAnalysisResult, QualityPreset, MediaProbeResult } from '../types/video.ts';

const COOKIES_DIR = path.resolve('storage/cookies');
const COOKIES_FILE = path.join(COOKIES_DIR, 'youtube_cookies.txt');

/**
 * Ensures yt-dlp and deno binaries have executable permissions (+x) to eliminate EACCES errors.
 */
export function ensureExecutables(): string {
  const candidates = [
    path.resolve('bin/yt-dlp'),
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ];

  let chosenBin = 'yt-dlp';

  for (const binPath of candidates) {
    if (fs.existsSync(binPath)) {
      try {
        fs.chmodSync(binPath, 0o755);
      } catch {}
      chosenBin = binPath;
      break;
    }
  }

  // Also ensure deno executable permissions if present
  const denoCandidates = ['/usr/local/bin/deno', path.resolve('bin/deno'), '/root/.deno/bin/deno'];
  for (const denoPath of denoCandidates) {
    if (fs.existsSync(denoPath)) {
      try {
        fs.chmodSync(denoPath, 0o755);
      } catch {}
    }
  }

  return chosenBin;
}

export function isYouTubeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host === 'm.youtube.com'
    );
  } catch {
    return false;
  }
}

export function extractYouTubeId(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('/')[0] || null;
    }
    if (parsed.pathname.includes('/shorts/')) {
      return parsed.pathname.split('/shorts/')[1].split('/')[0] || null;
    }
    if (parsed.pathname.includes('/embed/')) {
      return parsed.pathname.split('/embed/')[1].split('/')[0] || null;
    }
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

export function hasYouTubeCookies(): boolean {
  return fs.existsSync(COOKIES_FILE) && fs.statSync(COOKIES_FILE).size > 10;
}

export function saveYouTubeCookies(content: string): void {
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }
  fs.writeFileSync(COOKIES_FILE, content.trim(), 'utf-8');
}

export function clearYouTubeCookies(): void {
  if (fs.existsSync(COOKIES_FILE)) {
    fs.unlinkSync(COOKIES_FILE);
  }
}

function getJsRuntimesArg(): string[] {
  if (fs.existsSync('/usr/local/bin/deno')) {
    return ['--js-runtimes', 'deno:/usr/local/bin/deno'];
  }
  if (fs.existsSync('/usr/local/bin/node')) {
    return ['--js-runtimes', 'node:/usr/local/bin/node'];
  }
  return [];
}

export async function analyzeYouTubeUrl(urlStr: string): Promise<SourceAnalysisResult> {
  const binPath = ensureExecutables();
  const videoId = extractYouTubeId(urlStr);
  const cookiesExist = hasYouTubeCookies();

  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    '--extractor-args',
    'youtube:player_client=web,android',
    ...getJsRuntimesArg(),
  ];

  if (cookiesExist) {
    args.push('--cookies', COOKIES_FILE);
  }

  args.push(urlStr);

  try {
    const { stdout, stderr, code } = await runProcess(binPath, args, 35000);

    if (code !== 0 || !stdout.trim()) {
      const errLower = (stderr || '').toLowerCase();
      const needsBotAuth =
        errLower.includes('sign in to confirm') ||
        errLower.includes('bot') ||
        errLower.includes('cookies') ||
        errLower.includes('login') ||
        errLower.includes('rotated');

      if (needsBotAuth) {
        return {
          isPermitted: false,
          sourceType: 'unsupported_platform',
          sourceName: 'YouTube (Защита от ботов)',
          title: `YouTube [${videoId || 'ID'}] — Защита платформы`,
          url: urlStr,
          directDownloadAllowed: false,
          errorMessage:
            'YouTube заблокировал облачный дата-центр проверкой на роботов: «Sign in to confirm you’re not a bot». Чтобы скачивать любые фильмы и видеоролики без ограничений, загрузите свежий cookies.txt из открытой вкладки YouTube.',
          ethicalNotice: {
            platform: 'YouTube',
            reason:
              'YouTube ограничивает прямые запросы из серверных дата-центров (Cloud Run) для предотвращения парсинга.',
            officialAlternative:
              'Экспортируйте файл cookies.txt на открытой вкладке YouTube (через расширение браузера) и загрузите в панели авторизации выше. После этого видеофайлы любого размера скачиваются без ограничений.',
          },
          availableResolutions: [],
          thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        };
      }

      return {
        isPermitted: false,
        sourceType: 'unsupported_platform',
        sourceName: 'YouTube',
        title: 'Ошибка анализа YouTube',
        url: urlStr,
        directDownloadAllowed: false,
        errorMessage: `yt-dlp вернул ошибку: ${stderr.slice(0, 300)}`,
        availableResolutions: [],
      };
    }

    const data = JSON.parse(stdout);
    const title = data.title || `YouTube Video ${videoId || ''}`;
    const durationSec = data.duration || 0;
    const thumbnail = data.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);

    // Extract real available formats and heights
    const formats: any[] = data.formats || [];
    const heightsSet = new Set<number>();

    formats.forEach((f) => {
      if (f.height && typeof f.height === 'number' && f.height >= 144) {
        heightsSet.add(f.height);
      }
    });

    const sortedHeights = Array.from(heightsSet).sort((a, b) => b - a);

    const availableResolutions: QualityPreset[] = sortedHeights.map((h) => {
      const is4K = h >= 2160;
      let label = `${h}p`;
      if (h >= 2160) label = '2160p (4K Ultra HD)';
      else if (h >= 1440) label = '1440p (Quad HD)';
      else if (h >= 1080) label = '1080p (Full HD)';
      else if (h >= 720) label = '720p (HD)';
      else if (h >= 480) label = '480p (SD)';

      const w = Math.round((h * 16) / 9);
      return {
        id: `${h}p`,
        label,
        width: w,
        height: h,
        is4K,
        isNative: h === sortedHeights[0],
      };
    });

    const highest = sortedHeights[0] || 1080;
    const probe: MediaProbeResult = {
      formatName: 'mp4,webm',
      formatLongName: 'YouTube Stream Container',
      durationSec,
      sizeBytes: data.filesize || data.filesize_approx || 0,
      streams: [],
      width: Math.round((highest * 16) / 9),
      height: highest,
      is4K: highest >= 2160,
      resolutionLabel: highest >= 2160 ? '2160p (4K UHD)' : `${highest}p`,
    };

    return {
      isPermitted: true,
      sourceType: 'direct_url',
      sourceName: 'YouTube Video (yt-dlp Engine)',
      title,
      url: urlStr,
      thumbnailUrl: thumbnail,
      probe,
      availableResolutions,
      directDownloadAllowed: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isPermitted: false,
      sourceType: 'unsupported_platform',
      sourceName: 'YouTube',
      title: 'Сбой анализа YouTube',
      url: urlStr,
      directDownloadAllowed: false,
      errorMessage: errorMsg,
      availableResolutions: [],
    };
  }
}

/**
 * Downloads a video or entire movie from YouTube with unlimited size support (up to 2 hours runtime).
 */
export async function downloadYouTubeStream(
  urlStr: string,
  targetHeight: number = 1080,
  destPath: string,
  logCallback: (msg: string) => void
): Promise<void> {
  const binPath = ensureExecutables();
  const cookiesExist = hasYouTubeCookies();
  logCallback(`Подготовка к загрузке потока YouTube (качество до ${targetHeight}p)...`);

  // Format selector: best video up to targetHeight merged with best audio
  const formatSelector = `bestvideo[height<=${targetHeight}]+bestaudio/best[height<=${targetHeight}]/best`;

  const args = [
    '-f',
    formatSelector,
    '--merge-output-format',
    'mp4',
    '--ffmpeg-location',
    '/usr/bin/ffmpeg',
    '--no-playlist',
    '--no-warnings',
    '--extractor-args',
    'youtube:player_client=web,android',
    ...getJsRuntimesArg(),
    '-o',
    destPath,
  ];

  if (cookiesExist) {
    logCallback('Использование сессионных cookies для авторизации YouTube...');
    args.push('--cookies', COOKIES_FILE);
  } else {
    logCallback('Cookies не обнаружены, выполняется попытка прямого получения...');
  }

  args.push(urlStr);

  logCallback(`Запуск yt-dlp с объединением аудио и видео через системный FFmpeg (режим неограниченного размера)...`);
  // 7200000ms = 2 hours timeout for massive 4K movie downloads
  const { stderr, code } = await runProcess(binPath, args, 7200000);

  if (code !== 0 || !fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
    const errText = stderr || 'Файл не был создан';
    if (errText.includes('Sign in to confirm') || errText.includes('bot') || errText.includes('rotated')) {
      throw new Error(
        'YouTube заблокировал скачивание: «Sign in to confirm you’re not a bot». Пожалуйста, загрузите свежий cookies.txt из вашего браузера в панели настроек YouTube.'
      );
    }
    throw new Error(`Ошибка загрузки через yt-dlp (код ${code}): ${errText.slice(-300)}`);
  }

  logCallback(`Поток YouTube успешно получен и объединен в контейнер MP4! Размер: ${(fs.statSync(destPath).size / 1024 / 1024).toFixed(1)} МБ`);
}
