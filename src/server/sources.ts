import { validateUrlAgainstSSRF, safeDownloadFile } from './ssrf.ts';
import { runFfprobe } from './ffmpeg.ts';
import type { SourceAnalysisResult, QualityPreset, MediaProbeResult } from '../types/video.ts';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Standard resolution tiers
 */
const STANDARD_TIERS = [
  { id: '2160p', label: '2160p (4K Ultra HD)', width: 3840, height: 2160, is4K: true },
  { id: '1440p', label: '1440p (Quad HD)', width: 2560, height: 1440, is4K: false },
  { id: '1080p', label: '1080p (Full HD)', width: 1920, height: 1080, is4K: false },
  { id: '720p', label: '720p (HD)', width: 1280, height: 720, is4K: false },
  { id: '480p', label: '480p (SD)', width: 854, height: 480, is4K: false },
  { id: '360p', label: '360p', width: 640, height: 360, is4K: false },
  { id: '240p', label: '240p', width: 426, height: 240, is4K: false },
  { id: '144p', label: '144p', width: 256, height: 144, is4K: false },
];

/**
 * Derives available real resolutions without synthesizing fake upscales.
 */
export function deriveAvailableResolutions(nativeWidth?: number, nativeHeight?: number): QualityPreset[] {
  if (!nativeHeight || !nativeWidth) {
    return [
      {
        id: 'original',
        label: 'Оригинальное качество (как в источнике)',
        width: 1920,
        height: 1080,
        is4K: false,
        isNative: true,
      },
    ];
  }

  const isNative4K = nativeHeight >= 2160 || nativeWidth >= 3840;

  // Filter tiers that are <= native height
  const available: QualityPreset[] = [];

  // Always put native at top
  available.push({
    id: `native_${nativeHeight}p`,
    label: `${nativeHeight}p (${nativeWidth}x${nativeHeight}) — Исходный оригинал${isNative4K ? ' [4K UHD]' : ''}`,
    width: nativeWidth,
    height: nativeHeight,
    is4K: isNative4K,
    isNative: true,
  });

  for (const tier of STANDARD_TIERS) {
    // Only include lower standard tiers if they are significantly different from native
    if (tier.height < nativeHeight && Math.abs(tier.height - nativeHeight) > 50) {
      available.push({
        id: tier.id,
        label: tier.label,
        width: tier.width,
        height: tier.height,
        is4K: tier.is4K,
        isNative: false,
      });
    }
  }

  return available;
}

/**
 * Checks if the URL belongs to YouTube or restricted video platforms.
 */
export function checkRestrictedPlatform(urlStr: string): { isRestricted: boolean; platform?: string; message?: string } {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();

    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host === 'm.youtube.com'
    ) {
      return {
        isRestricted: true,
        platform: 'YouTube',
        message:
          'Платформа YouTube запрещает прямое извлечение медиапотоков третьими лицами и защищает видео с помощью авторизации/DRM. UltraDL 4K строго соблюдает условия платформ.',
      };
    }

    if (
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'instagram.com' ||
      host.endsWith('.instagram.com')
    ) {
      return {
        isRestricted: true,
        platform: host.includes('tiktok') ? 'TikTok' : 'Instagram',
        message:
          'Данная социальная платформа требует авторизованный API или запрещает прямое извлечение закрытых потоков без согласия правообладателя.',
      };
    }

    return { isRestricted: false };
  } catch {
    return { isRestricted: false };
  }
}

import { isYouTubeUrl, analyzeYouTubeUrl } from './youtube.ts';

/**
 * Analyzes a URL to determine source legitimacy and available streams.
 */
export async function analyzeVideoUrl(rawUrl: string, tmpDir: string): Promise<SourceAnalysisResult> {
  // If YouTube URL is provided, invoke the specialized yt-dlp YouTube integration engine
  if (isYouTubeUrl(rawUrl)) {
    return await analyzeYouTubeUrl(rawUrl);
  }

  const restricted = checkRestrictedPlatform(rawUrl);
  if (restricted.isRestricted && restricted.platform) {
    return {
      isPermitted: false,
      sourceType: 'unsupported_platform',
      sourceName: restricted.platform,
      title: `${restricted.platform} — Доступ ограничен платформой`,
      url: rawUrl,
      directDownloadAllowed: false,
      errorMessage: restricted.message,
      ethicalNotice: {
        platform: restricted.platform,
        reason: restricted.message || '',
        officialAlternative:
          'Используйте официальные инструменты экспорта контента или встроенные кнопки сохранения автора.',
      },
      availableResolutions: [],
    };
  }

  // Validate URL scheme and SSRF
  const ssrf = await validateUrlAgainstSSRF(rawUrl);
  if (!ssrf.valid) {
    return {
      isPermitted: false,
      sourceType: 'direct_url',
      sourceName: 'Недопустимый адрес',
      title: 'Ошибка безопасности (SSRF Guard)',
      url: rawUrl,
      directDownloadAllowed: false,
      errorMessage: ssrf.reason,
      availableResolutions: [],
    };
  }

  // Perform quick HEAD or Range GET probe to check content-type
  const tempProbePath = path.join(tmpDir, `probe_${Date.now()}.bin`);
  try {
    // Download first 2MB to probe container & metadata without fetching the entire file
    await fetchPartialChunk(rawUrl, tempProbePath, 2 * 1024 * 1024);
    const probe = await runFfprobe(tempProbePath);

    const resolutions = deriveAvailableResolutions(probe.width, probe.height);
    const fileName = path.basename(new URL(rawUrl).pathname) || 'video_source.mp4';

    try {
      if (fs.existsSync(tempProbePath)) fs.unlinkSync(tempProbePath);
    } catch {}

    return {
      isPermitted: true,
      sourceType: 'direct_url',
      sourceName: 'Прямой видеопоток (HTTP/HTTPS)',
      title: decodeURIComponent(fileName),
      url: rawUrl,
      probe,
      availableResolutions: resolutions,
      directDownloadAllowed: true,
    };
  } catch (err: unknown) {
    try {
      if (fs.existsSync(tempProbePath)) fs.unlinkSync(tempProbePath);
    } catch {}

    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isPermitted: false,
      sourceType: 'direct_url',
      sourceName: 'Прямой URL',
      title: 'Не удалось проанализировать медиапоток',
      url: rawUrl,
      directDownloadAllowed: false,
      errorMessage: `Удаленный сервер не предоставил доступный видеофайл или медиазаголовки повреждены (${errorMsg})`,
      availableResolutions: [],
    };
  }
}

/**
 * Fetches the initial partial chunk (up to maxBytes) of a remote file to probe metadata fast.
 */
function fetchPartialChunk(targetUrl: string, destPath: string, maxBytes: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          Range: `bytes=0-${maxBytes - 1}`,
          'User-Agent': 'UltraDL-4K-VideoEngine/2.0 (Metadata-Probe)',
        },
        timeout: 15000,
      },
      (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          req.destroy();
          reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage || ''}`));
          return;
        }

        const out = fs.createWriteStream(destPath);
        let downloaded = 0;

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          out.write(chunk);
          if (downloaded >= maxBytes) {
            req.destroy();
            out.end();
            resolve();
          }
        });

        res.on('end', () => {
          out.end();
          resolve();
        });

        res.on('error', (err) => {
          out.end();
          reject(err);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Превышен таймаут ответа сервера (15с)'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}
