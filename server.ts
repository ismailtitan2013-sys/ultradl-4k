import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { analyzeVideoUrl, deriveAvailableResolutions } from './src/server/sources.ts';
import { safeDownloadFile, validateUrlAgainstSSRF } from './src/server/ssrf.ts';
import {
  runFfprobe,
  extractVideoThumbnail,
  mergeVideoAndAudio,
  createSyntheticTestFile,
} from './src/server/ffmpeg.ts';
import { verifyVideoFile } from './src/server/verifier.ts';
import { runAllAutomatedTests } from './src/server/test_runner.ts';
import type { ProcessTaskRequest, VerificationReport } from './src/types/video.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

let PORT = 3000;
const portArgIdx = process.argv.indexOf('--port');
if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
  PORT = parseInt(process.argv[portArgIdx + 1], 10);
} else if (process.env.PORT) {
  PORT = parseInt(process.env.PORT, 10);
}

let HOST = '0.0.0.0';
const hostArgIdx = process.argv.indexOf('--host');
if (hostArgIdx !== -1 && process.argv[hostArgIdx + 1]) {
  HOST = process.argv[hostArgIdx + 1];
}

// Setup directories
const STORAGE_DIR = path.join(__dirname, 'storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const DOWNLOADS_DIR = path.join(STORAGE_DIR, 'downloads');
const THUMBNAILS_DIR = path.join(STORAGE_DIR, 'thumbnails');
const TMP_DIR = path.join(STORAGE_DIR, 'tmp');

[STORAGE_DIR, UPLOADS_DIR, DOWNLOADS_DIR, THUMBNAILS_DIR, TMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer for secure file uploads
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300 MB max for upload
  },
});

app.use(express.json());

// API: Health check and environment probe
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'UltraDL 4K Video Engine',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    capabilities: {
      ffmpeg: true,
      ffprobe: true,
      blackScreenDetector: true,
      maxQuality: '2160p (4K UHD)',
      ssrfProtection: true,
    },
  });
});

// API: Curated legal and synthetic sample videos
app.get('/api/samples', (req, res) => {
  res.json([
    {
      id: 'sample_blender_tears_4k',
      title: 'Tears of Steel (Blender Open Movie) — 4K UHD 2160p',
      license: 'Creative Commons Attribution 3.0',
      sourceType: 'direct_url',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      resolution: '3840x2160 (или 1920x1080 в зависимости от CDN)',
      description: 'Официальный тестовый ролик открытого проекта Blender Foundation.',
    },
    {
      id: 'sample_big_buck_bunny',
      title: 'Big Buck Bunny (Blender Open Movie) — 1080p Full HD',
      license: 'Creative Commons Attribution 3.0',
      sourceType: 'direct_url',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      resolution: '1920x1080',
      description: 'Легальный открытый ролик для проверки видеопотока и звука.',
    },
    {
      id: 'sample_wikimedia_commons',
      title: 'Wikimedia Commons: NASA Apollo 11 Launch — Открытый архив',
      license: 'Public Domain / NASA',
      sourceType: 'direct_url',
      url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1b/Apollo_11_Launch_-_Saturn_V.ogv/Apollo_11_Launch_-_Saturn_V.ogv.480p.vp9.webm',
      resolution: '854x480 (WebM VP9)',
      description: 'Исторический архивный ролик из общественного достояния (Wikimedia Commons).',
    },
  ]);
});

// API: File upload (custom video or audio)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не передан' });
  }

  const fileId = req.file.filename;
  const originalName = req.file.originalname;
  const filePath = req.file.path;

  try {
    const probe = await runFfprobe(filePath);
    const resolutions = deriveAvailableResolutions(probe.width, probe.height);

    // Extract thumbnail
    const thumbName = `${fileId}.jpg`;
    const thumbPath = path.join(THUMBNAILS_DIR, thumbName);
    await extractVideoThumbnail(filePath, thumbPath, 0.5);

    res.json({
      fileId,
      originalName,
      size: req.file.size,
      mimeType: req.file.mimetype,
      probe,
      availableResolutions: resolutions,
      thumbnailUrl: fs.existsSync(thumbPath) ? `/api/media/thumbnail/${thumbName}` : undefined,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(400).json({
      error: `Файл не является валидным мультимедиа контейнером: ${errorMsg}`,
    });
  }
});

// API: Analyze URL
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Требуется указать URL' });
  }

  try {
    const result = await analyzeVideoUrl(url.trim(), TMP_DIR);
    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Ошибка анализа: ${errorMsg}`,
    });
  }
});

// API: Process, merge streams and verify video
import {
  isYouTubeUrl,
  downloadYouTubeStream,
  hasYouTubeCookies,
  saveYouTubeCookies,
  clearYouTubeCookies,
} from './src/server/youtube.ts';

// API: YouTube cookies management
app.get('/api/youtube/cookies', (req, res) => {
  res.json({ hasCookies: hasYouTubeCookies() });
});

app.post('/api/youtube/cookies', (req, res) => {
  const { cookies } = req.body;
  if (!cookies || typeof cookies !== 'string') {
    return res.status(400).json({ error: 'Текст cookies не передан' });
  }
  saveYouTubeCookies(cookies);
  res.json({ success: true, hasCookies: true });
});

app.post('/api/youtube/cookies/upload', upload.single('cookiesFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл cookies.txt не передан' });
  }
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    saveYouTubeCookies(content);
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
    res.json({ success: true, hasCookies: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Ошибка сохранения cookies: ${errorMsg}` });
  }
});

app.post('/api/youtube/cookies/clear', (req, res) => {
  clearYouTubeCookies();
  res.json({ success: true, hasCookies: false });
});

app.post('/api/process', async (req, res) => {
  const body: ProcessTaskRequest = req.body;
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logs: string[] = [];

  const log = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`);
  };

  log(`Инициализация задачи ${taskId}...`);

  let sourceVideoPath = '';
  let needCleanupSource = false;
  let fileNameBase = 'video_processed';

  try {
    // 1. Acquire source video file
    if (body.sourceType === 'uploaded_file' && body.uploadedFileId) {
      sourceVideoPath = path.join(UPLOADS_DIR, body.uploadedFileId);
      if (!fs.existsSync(sourceVideoPath)) {
        throw new Error('Загруженный файл не найден на сервере');
      }
      log('Используется загруженный пользователем видеофайл');
    } else if (body.url && isYouTubeUrl(body.url)) {
      log(`Обнаружен источник YouTube: ${body.url}`);
      const downloadDest = path.join(TMP_DIR, `${taskId}_yt_merged.mp4`);
      const targetHeight = body.targetQualityHeight || 1080;
      await downloadYouTubeStream(body.url, targetHeight, downloadDest, log);
      sourceVideoPath = downloadDest;
      needCleanupSource = true;
      fileNameBase = `youtube_${taskId}`;
    } else if (body.sourceType === 'direct_url' && body.url) {
      log(`Проверка безопасности и загрузка потока из источника: ${body.url}`);
      const downloadDest = path.join(TMP_DIR, `${taskId}_download.tmp`);
      const dlRes = await safeDownloadFile(body.url, downloadDest, 400 * 1024 * 1024);
      sourceVideoPath = downloadDest;
      needCleanupSource = true;
      log(`Файл получен (${(dlRes.bytesReceived / 1024 / 1024).toFixed(1)} МБ)`);
      try {
        const urlName = path.basename(new URL(body.url).pathname);
        if (urlName && urlName.length > 3) fileNameBase = path.parse(urlName).name;
      } catch {}
    } else if (body.sourceType === 'synthetic_sample') {
      log('Генерация контрольного тестового ролика 4K UHD...');
      const synthDest = path.join(TMP_DIR, `${taskId}_4k.mp4`);
      await createSyntheticTestFile('sample_4k', synthDest);
      sourceVideoPath = synthDest;
      needCleanupSource = true;
      fileNameBase = 'ultradl_synthetic_4k';
    } else {
      throw new Error('Не указан валидный источник видео');
    }

    let finalProcessedPath = path.join(DOWNLOADS_DIR, `${taskId}_final.mp4`);

    // 2. Separate audio merge if requested
    if (body.audioAction === 'merge_audio' && body.separateAudioFileId) {
      const audioSourcePath = path.join(UPLOADS_DIR, body.separateAudioFileId);
      if (!fs.existsSync(audioSourcePath)) {
        throw new Error('Отдельный аудиофайл не найден на сервере');
      }
      log('Запуск объединения видеоряда и отдельной аудиодорожки через FFmpeg...');
      const mergeRes = await mergeVideoAndAudio(
        sourceVideoPath,
        audioSourcePath,
        finalProcessedPath,
        body.allowReencode ?? true
      );
      log(mergeRes.log);
      if (!mergeRes.success) {
        throw new Error(`Сбой объединения потоков: ${mergeRes.error}`);
      }
    } else {
      // Direct copy to downloads container
      fs.copyFileSync(sourceVideoPath, finalProcessedPath);
    }

    // 3. Run comprehensive 9-step verifier
    log('Запуск системы защиты от черного экрана и проверки целостности (9 шагов)...');
    const report: VerificationReport = await verifyVideoFile(finalProcessedPath, {
      userMutedRequested: body.audioAction === 'mute_audio',
    });

    // Merge server logs into report logs
    report.logs = [...logs, ...report.logs];

    // Generate thumbnail if video stream is valid
    if (report.hasVideo) {
      const thumbFile = `${taskId}.jpg`;
      const thumbPath = path.join(THUMBNAILS_DIR, thumbFile);
      const thumbOk = await extractVideoThumbnail(finalProcessedPath, thumbPath, 1);
      if (thumbOk) {
        report.thumbnailUrl = `/api/media/thumbnail/${thumbFile}`;
      }
    }

    if (fs.existsSync(finalProcessedPath)) {
      report.fileSize = fs.statSync(finalProcessedPath).size;
    }

    const cleanDownloadName = `${fileNameBase}_${report.height || 'video'}p.mp4`;
    report.outputUrl = `/api/media/download/${taskId}_final.mp4?name=${encodeURIComponent(cleanDownloadName)}`;
    report.streamUrl = `/api/media/stream/${taskId}_final.mp4`;
    report.downloadFileName = cleanDownloadName;

    res.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`КРИТИЧЕСКАЯ ОШИБКА: ${errorMsg}`);
    res.status(400).json({
      overallState: 'error_corrupt',
      stateBadge: {
        label: 'Ошибка обработки',
        variant: 'error',
        description: errorMsg,
      },
      fileSize: 0,
      durationSec: 0,
      containerFormat: 'unknown',
      hasVideo: false,
      hasAudio: false,
      testedDurationSec: 0,
      isFullyTested: false,
      decodedFramesCount: 0,
      isBlackScreenDetected: false,
      isEntirelyBlack: false,
      blackRatioPercent: 0,
      blackSegments: [],
      steps: [],
      logs,
    });
  } finally {
    if (needCleanupSource && sourceVideoPath && fs.existsSync(sourceVideoPath)) {
      try {
        fs.unlinkSync(sourceVideoPath);
      } catch {}
    }
  }
});

// API: Stream media for video player with HTTP 206 Range support
app.get('/api/media/stream/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(DOWNLOADS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Файл не найден');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'video/mp4');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

// API: Direct file download with full size and Range support
app.get('/api/media/download/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(DOWNLOADS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Файл не найден');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const customName = req.query.name ? String(req.query.name) : fileName;

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(customName)}"`);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'video/mp4');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

app.get('/api/media/thumbnail/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(THUMBNAILS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Превью не найдено');
  }

  res.sendFile(filePath);
});

// API: Export project ZIP archive for easy GitHub upload
app.get('/api/export-zip', (req, res) => {
  const zipFile = path.join(DOWNLOADS_DIR, 'ultradl-4k-source.zip');
  if (!fs.existsSync(zipFile)) {
    return res.status(404).send('Архив еще не создан');
  }
  res.download(zipFile, 'ultradl-4k-source.zip');
});

// API: Direct push to GitHub if token provided
app.post('/api/github/push', async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'GitHub Personal Access Token не указан' });
  }

  try {
    const cleanToken = token.trim();
    const repoUrl = `https://${cleanToken}@github.com/ismailtitan2013-sys/ultradl-4k.git`;
    const { runProcess } = await import('./src/server/ffmpeg.ts');
    const { stdout, stderr, code } = await runProcess('git', ['push', repoUrl, 'main', '--force'], 30000);

    if (code !== 0) {
      return res.status(400).json({ error: `Сбой git push (код ${code}): ${stderr || stdout}` });
    }

    res.json({ success: true, message: 'Репозиторий успешно отправлен на GitHub!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// API: Run automated test suite
app.post('/api/run-tests', async (req, res) => {
  try {
    const results = await runAllAutomatedTests(TMP_DIR);
    res.json(results);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Сбой выполнения тестов: ${errorMsg}` });
  }
});

// Vite or Static file serving
async function setupViteOrStatic() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/`);
    console.log(`>>> UltraDL 4K Server running on http://${HOST}:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
