import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaProbeResult, MediaStreamInfo, BlackSegment } from '../types/video.ts';

/**
 * Executes a process safely with separate argument arrays (no shell injection).
 */
export function runProcess(command: string, args: string[], timeoutMs: number = 30000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let isSettled = false;

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        child.kill('SIGKILL');
        reject(new Error(`Команда ${command} превысила таймаут выполнения (${timeoutMs / 1000}с)`));
      }
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    child.on('close', (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? -1 });
      }
    });

    child.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

/**
 * Validates container magic signature directly from initial bytes.
 */
export function inspectContainerSignature(filePath: string): { valid: boolean; containerType: string; description: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, containerType: 'unknown', description: 'Файл не найден' };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { valid: false, containerType: 'empty', description: 'Файл пустой (0 байт)' };
  }

  const buffer = Buffer.alloc(Math.min(stat.size, 128));
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);

  // Check MP4 / QuickTime: contains 'ftyp' at offset 4
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).trim();
    return { valid: true, containerType: 'mp4', description: `MP4 ISO Base Media / QuickTime (${brand})` };
  }

  // Check QuickTime 'moov' or 'wide' at offset 4
  if (buffer.length >= 8 && (buffer.toString('ascii', 4, 8) === 'moov' || buffer.toString('ascii', 4, 8) === 'wide')) {
    return { valid: true, containerType: 'mov', description: 'QuickTime MOV container' };
  }

  // Check Matroska / WebM: starts with EBML ID \x1A\x45\xDF\xA3
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    const textSample = buffer.toString('utf-8', 0, Math.min(buffer.length, 64));
    const isWebm = textSample.includes('webm');
    return {
      valid: true,
      containerType: isWebm ? 'webm' : 'matroska',
      description: isWebm ? 'WebM (EBML)' : 'Matroska MKV (EBML)',
    };
  }

  // Check RIFF AVI: 'RIFF....AVI '
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'AVI ') {
    return { valid: true, containerType: 'avi', description: 'AVI Container (RIFF)' };
  }

  // Check MPEG-TS sync byte 0x47
  if (buffer.length >= 188 && buffer[0] === 0x47 && buffer[188] === 0x47) {
    return { valid: true, containerType: 'mpegts', description: 'MPEG Transport Stream (TS)' };
  }

  // Check FLV: starts with 'FLV\x01'
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 3) === 'FLV') {
    return { valid: true, containerType: 'flv', description: 'Flash Video Container (FLV)' };
  }

  // Check Ogg: 'OggS'
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return { valid: true, containerType: 'ogg', description: 'Ogg Media Container' };
  }

  return {
    valid: false,
    containerType: 'unrecognized',
    description: 'Сигнатура контейнера не распознана или повреждена (отсутствуют валидные magic bytes)',
  };
}

/**
 * Deep inspection of file streams and metadata using ffprobe.
 */
export async function runFfprobe(filePath: string): Promise<MediaProbeResult> {
  const args = [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const { stdout, stderr, code } = await runProcess('ffprobe', args, 15000);
  if (code !== 0 || !stdout.trim()) {
    throw new Error(`ffprobe завершился с ошибкой (код ${code}): ${stderr || 'нет данных вывода'}`);
  }

  let data: any;
  try {
    data = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Не удалось распарсить JSON отчет ffprobe: ${stdout.slice(0, 200)}`);
  }

  const streams: MediaStreamInfo[] = (data.streams || []).map((s: any) => ({
    index: s.index,
    codecType: s.codec_type as 'video' | 'audio' | 'subtitle' | 'other',
    codecName: s.codec_name || 'unknown',
    codecLongName: s.codec_long_name,
    profile: s.profile,
    width: s.width ? parseInt(s.width, 10) : undefined,
    height: s.height ? parseInt(s.height, 10) : undefined,
    rFrameRate: s.r_frame_rate,
    avgFrameRate: s.avg_frame_rate,
    bitRate: s.bit_rate ? parseInt(s.bit_rate, 10) : undefined,
    channels: s.channels ? parseInt(s.channels, 10) : undefined,
    sampleRate: s.sample_rate ? parseInt(s.sample_rate, 10) : undefined,
    channelLayout: s.channel_layout,
    duration: s.duration ? parseFloat(s.duration) : undefined,
  }));

  const videoStream = streams.find((s) => s.codecType === 'video');
  const audioStream = streams.find((s) => s.codecType === 'audio');

  const format = data.format || {};
  const durationSec = format.duration
    ? parseFloat(format.duration)
    : videoStream?.duration || audioStream?.duration || 0;
  const sizeBytes = format.size ? parseInt(format.size, 10) : fs.statSync(filePath).size;
  const width = videoStream?.width;
  const height = videoStream?.height;

  const is4K = (width && width >= 3840) || (height && height >= 2160) || false;

  let resolutionLabel = 'Аудио / Без видео';
  if (height && width) {
    if (height >= 2160 || width >= 3840) resolutionLabel = '2160p (4K UHD)';
    else if (height >= 1440 || width >= 2560) resolutionLabel = '1440p (QHD)';
    else if (height >= 1080) resolutionLabel = '1080p (Full HD)';
    else if (height >= 720) resolutionLabel = '720p (HD)';
    else if (height >= 480) resolutionLabel = '480p (SD)';
    else if (height >= 360) resolutionLabel = '360p';
    else if (height >= 240) resolutionLabel = '240p';
    else resolutionLabel = `${width}x${height}`;
  }

  return {
    formatName: format.format_name || 'unknown',
    formatLongName: format.format_long_name || '',
    durationSec,
    sizeBytes,
    bitRate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
    streams,
    videoStream,
    audioStream,
    width,
    height,
    is4K,
    resolutionLabel,
  };
}

/**
 * Tests actual video frame decodability by decoding frames with FFmpeg null muxer.
 */
export async function testFrameDecodability(
  filePath: string,
  testDurationSec: number = 5
): Promise<{ success: boolean; decodedFrames: number; error?: string }> {
  const args = [
    '-v',
    'error',
    '-stats',
    '-i',
    filePath,
    '-t',
    testDurationSec.toString(),
    '-f',
    'null',
    '-',
  ];

  try {
    const { stderr, code } = await runProcess('ffmpeg', args, 20000);
    // FFmpeg prints errors to stderr if decoding fails
    const criticalErrors = [
      'Invalid data found when processing input',
      'error while decoding MB',
      'non-existing PPS',
      'corrupt decoded frame',
      'Fatal error',
      'Invalid NAL unit',
    ];

    const hasFatalDecodeError = criticalErrors.some((err) =>
      stderr.toLowerCase().includes(err.toLowerCase())
    );

    if (code !== 0 || hasFatalDecodeError) {
      return {
        success: false,
        decodedFrames: 0,
        error: stderr || `Ошибка декодирования (код возврата FFmpeg: ${code})`,
      };
    }

    // Parse frame count if present in stderr stats (e.g. frame=  120)
    let decodedFrames = 0;
    const frameMatch = stderr.match(/frame=\s*(\d+)/i);
    if (frameMatch) {
      decodedFrames = parseInt(frameMatch[1], 10);
    } else {
      // Estimate if success: ~30fps * testDurationSec
      decodedFrames = Math.round(testDurationSec * 25);
    }

    return { success: true, decodedFrames };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, decodedFrames: 0, error: errorMsg };
  }
}

/**
 * Detects black screen and empty frame sequences using FFmpeg blackdetect filter
 * and luminance inspection.
 */
export async function testBlackScreenDetection(
  filePath: string,
  probeDurationSec: number,
  maxCheckSec: number = 10
): Promise<{
  isEntirelyBlack: boolean;
  hasBlackSegments: boolean;
  blackRatioPercent: number;
  segments: BlackSegment[];
  meanLuminance?: number;
  log: string;
}> {
  const checkDuration = Math.min(Math.max(probeDurationSec, 1), maxCheckSec);
  const args = [
    '-i',
    filePath,
    '-t',
    checkDuration.toString(),
    '-vf',
    'blackdetect=d=0.5:pic_th=0.98:pix_th=0.10',
    '-an',
    '-f',
    'null',
    '-',
  ];

  try {
    const { stderr } = await runProcess('ffmpeg', args, 25000);

    const segments: BlackSegment[] = [];
    // blackdetect outputs lines like:
    // [blackdetect @ 0x...] black_start:0.123 black_end:2.456 black_duration:2.333
    const regex = /black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:([0-9.]+)/g;
    let match: RegExpExecArray | null;

    let totalBlackDuration = 0;
    while ((match = regex.exec(stderr)) !== null) {
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      const duration = parseFloat(match[3]);
      segments.push({ start, end, duration });
      totalBlackDuration += duration;
    }

    // Also perform sample luminance inspection on 3 frames to avoid false negatives
    let meanLuminance: number | undefined;
    try {
      const lumArgs = [
        '-i',
        filePath,
        '-t',
        checkDuration.toString(),
        '-vf',
        'signalstats',
        '-f',
        'null',
        '-',
      ];
      const lumResult = await runProcess('ffmpeg', lumArgs, 15000);
      const yavgMatch = lumResult.stderr.match(/YAVG=([0-9.]+)/i);
      if (yavgMatch) {
        meanLuminance = parseFloat(yavgMatch[1]);
      }
    } catch {}

    const blackRatioPercent = Math.min(
      100,
      Math.round((totalBlackDuration / checkDuration) * 100)
    );

    // If total black duration covers >= 92% of the checked segment OR luminance is extremely near 0
    const isEntirelyBlack =
      blackRatioPercent >= 92 || (meanLuminance !== undefined && meanLuminance < 1.0);
    const hasBlackSegments = segments.length > 0;

    return {
      isEntirelyBlack,
      hasBlackSegments,
      blackRatioPercent,
      segments,
      meanLuminance,
      log: `Проверено ${checkDuration.toFixed(1)} сек видео. Обнаружено сегментов черного экрана: ${segments.length}, общая доля: ${blackRatioPercent}%. Средняя яркость Y: ${meanLuminance !== undefined ? meanLuminance.toFixed(1) : 'н/д'}.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isEntirelyBlack: false,
      hasBlackSegments: false,
      blackRatioPercent: 0,
      segments: [],
      log: `Не удалось завершить проверку blackdetect: ${errorMsg}`,
    };
  }
}

/**
 * Merges video and audio tracks with stream copy (fast, lossless) when compatible,
 * or with safe transcode if audio codec needs muxing to MP4 container.
 */
export async function mergeVideoAndAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  allowReencode: boolean = true
): Promise<{ success: boolean; usedReencode: boolean; error?: string; log: string }> {
  // First attempt: Stream Copy (-c:v copy -c:a copy)
  const copyArgs = [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ];

  try {
    const { stderr, code } = await runProcess('ffmpeg', copyArgs, 60000);
    if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return {
        success: true,
        usedReencode: false,
        log: 'Успешное прямое объединение потоков без перекодирования (Stream Copy: 100% сохранение исходного качества).',
      };
    }
  } catch {}

  // If copy failed and reencoding is permitted
  if (!allowReencode) {
    return {
      success: false,
      usedReencode: false,
      error: 'Прямое объединение (Stream Copy) не удалось из-за несовместимости кодеков/контейнера, а перекодирование отключено пользователем.',
      log: 'Ошибка копирования потоков.',
    };
  }

  // Safe fallback: copy video stream, encode audio to standard AAC (safe for MP4)
  const fallbackArgs = [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outputPath,
  ];

  try {
    const { stderr, code } = await runProcess('ffmpeg', fallbackArgs, 90000);
    if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return {
        success: true,
        usedReencode: true,
        log: 'Объединение выполнено: видеопоток скопирован без потерь (-c:v copy), аудиодорожка безопасно перекодирована в AAC 192kbps для полной совместимости.',
      };
    }
    return {
      success: false,
      usedReencode: true,
      error: `Ошибка объединения FFmpeg (код ${code}): ${stderr.slice(-300)}`,
      log: stderr,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      usedReencode: true,
      error: `Критический сбой процесса FFmpeg: ${errorMsg}`,
      log: errorMsg,
    };
  }
}

/**
 * Extracts a representative frame as JPG thumbnail.
 */
export async function extractVideoThumbnail(
  filePath: string,
  outputPath: string,
  seekSec: number = 1
): Promise<boolean> {
  const args = [
    '-y',
    '-ss',
    seekSec.toString(),
    '-i',
    filePath,
    '-vframes',
    '1',
    '-vf',
    'scale=640:-1',
    '-q:v',
    '3',
    outputPath,
  ];

  try {
    const { code } = await runProcess('ffmpeg', args, 10000);
    return code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch {
    return false;
  }
}

/**
 * Generates synthetic test video files using FFmpeg lavfi filters for automatic testing.
 */
export async function createSyntheticTestFile(
  type:
    | 'valid_audio'
    | 'valid_no_audio'
    | 'empty'
    | 'corrupt'
    | 'no_video'
    | 'black_screen'
    | 'decode_error'
    | 'sample_4k',
  outputPath: string
): Promise<string> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  switch (type) {
    case 'empty': {
      fs.writeFileSync(outputPath, Buffer.alloc(0));
      return outputPath;
    }

    case 'corrupt': {
      // Write corrupted garbage bytes with broken header
      const garbage = Buffer.from('NOT_A_VALID_MEDIA_FILE_HEADER_GARBAGE_RANDOM_BYTES_0123456789ABCDEF');
      fs.writeFileSync(outputPath, garbage);
      return outputPath;
    }

    case 'valid_audio': {
      // 1280x720 video with test audio tone
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=duration=2:size=1280x720:rate=25',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        outputPath,
      ];
      await runProcess('ffmpeg', args, 15000);
      return outputPath;
    }

    case 'valid_no_audio': {
      // 1280x720 video without audio
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=duration=2:size=1280x720:rate=25',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        outputPath,
      ];
      await runProcess('ffmpeg', args, 15000);
      return outputPath;
    }

    case 'no_video': {
      // Audio only file (AAC)
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-c:a',
        'aac',
        outputPath,
      ];
      await runProcess('ffmpeg', args, 15000);
      return outputPath;
    }

    case 'black_screen': {
      // 100% black color video
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=640x360:d=2:r=25',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        outputPath,
      ];
      await runProcess('ffmpeg', args, 15000);
      return outputPath;
    }

    case 'decode_error': {
      // Create valid short video then truncate or corrupt middle payload to trigger decode failure
      const tempValid = outputPath + '.tmp.mp4';
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=duration=2:size=320x240:rate=25',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        tempValid,
      ];
      await runProcess('ffmpeg', args, 15000);
      const validBuf = fs.readFileSync(tempValid);
      // Corrupt middle 70% with random zeroes/broken data
      const corruptedBuf = Buffer.from(validBuf);
      for (let i = 400; i < Math.min(corruptedBuf.length, 2500); i++) {
        corruptedBuf[i] = 0xff;
      }
      fs.writeFileSync(outputPath, corruptedBuf);
      try {
        fs.unlinkSync(tempValid);
      } catch {}
      return outputPath;
    }

    case 'sample_4k': {
      // Real 3840x2160 UHD 4K synthetic video
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=duration=1:size=3840x2160:rate=24',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=880:duration=1',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-c:a',
        'aac',
        outputPath,
      ];
      await runProcess('ffmpeg', args, 30000);
      return outputPath;
    }
  }
}
