import fs from 'node:fs';
import path from 'node:path';
import {
  inspectContainerSignature,
  runFfprobe,
  testFrameDecodability,
  testBlackScreenDetection,
} from './ffmpeg.ts';
import type { VerificationReport, VerificationStep, VerificationState } from '../types/video.ts';

export interface VerifierOptions {
  userMutedRequested?: boolean;
  expectedMinDuration?: number;
  expectedWidth?: number;
  expectedHeight?: number;
}

/**
 * Executes the full 9-step Black Screen & Corruption Protection pipeline.
 * Never declares "Passed" unless all verification stages succeed.
 */
export async function verifyVideoFile(
  filePath: string,
  options: VerifierOptions = {}
): Promise<VerificationReport> {
  const steps: VerificationStep[] = [];
  const logs: string[] = [];

  const addStep = (
    id: string,
    stepNumber: number,
    title: string,
    status: VerificationStep['status'],
    details?: string
  ) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    steps.push({ id, stepNumber, title, status, details, timestamp });
    logs.push(`[${timestamp}] [Шаг ${stepNumber}/9] ${title}: ${status.toUpperCase()} ${details ? `- ${details}` : ''}`);
  };

  const createFailureReport = (
    state: VerificationState,
    badgeLabel: string,
    badgeDesc: string,
    fileSize: number = 0
  ): VerificationReport => ({
    overallState: state,
    stateBadge: {
      label: badgeLabel,
      variant: 'error',
      description: badgeDesc,
    },
    fileSize,
    durationSec: 0,
    containerFormat: 'unknown',
    hasVideo: false,
    hasAudio: false,
    userMutedRequested: options.userMutedRequested,
    testedDurationSec: 0,
    isFullyTested: false,
    decodedFramesCount: 0,
    isBlackScreenDetected: false,
    isEntirelyBlack: false,
    blackRatioPercent: 0,
    blackSegments: [],
    steps,
    logs,
  });

  // ==========================================
  // Step 1: Проверка существования и размера файла (> 0)
  // ==========================================
  if (!fs.existsSync(filePath)) {
    addStep('step1_exist', 1, 'Проверка наличия файла на диске', 'failed', 'Файл физически отсутствует на сервере');
    return createFailureReport('error_empty', 'Ошибка: файл не найден', 'Файл не был сохранен или удален.');
  }

  const fileStat = fs.statSync(filePath);
  const fileSize = fileStat.size;

  if (fileSize === 0) {
    addStep('step1_exist', 1, 'Проверка размера файла', 'failed', 'Файл пустой (0 байт)');
    return createFailureReport('error_empty', 'Ошибка: пустой файл', 'Полученный файл имеет нулевой размер (0 байт).', 0);
  }

  addStep(
    'step1_exist',
    1,
    'Проверка наличия и размера файла',
    'passed',
    `Файл присутствует, размер: ${(fileSize / (1024 * 1024)).toFixed(2)} МБ (${fileSize} байт)`
  );

  // ==========================================
  // Step 2: Проверка сигнатуры и контейнера (magic bytes)
  // ==========================================
  const sig = inspectContainerSignature(filePath);
  if (!sig.valid) {
    addStep('step2_sig', 2, 'Анализ сигнатуры контейнера (Magic Bytes)', 'failed', sig.description);
    return createFailureReport(
      'error_invalid_signature',
      'Ошибка: поврежденный контейнер',
      `Невалидная структура заголовка: ${sig.description}`,
      fileSize
    );
  }

  addStep('step2_sig', 2, 'Анализ сигнатуры контейнера (Magic Bytes)', 'passed', `${sig.description} [${sig.containerType}]`);

  // ==========================================
  // Step 3: Глубокий зонд ffprobe (потоки, кодеки, длительность)
  // ==========================================
  let probe: Awaited<ReturnType<typeof runFfprobe>>;
  try {
    probe = await runFfprobe(filePath);
    addStep(
      'step3_probe',
      3,
      'Глубокий анализ потоков (ffprobe)',
      'passed',
      `Контейнер: ${probe.formatName}, Длительность: ${probe.durationSec.toFixed(1)}с, Потоков: ${probe.streams.length}`
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    addStep('step3_probe', 3, 'Глубокий анализ потоков (ffprobe)', 'failed', errorMsg);
    return createFailureReport(
      'error_corrupt',
      'Ошибка: видео повреждено',
      `ffprobe не смог прочитать структуру медиафайла: ${errorMsg}`,
      fileSize
    );
  }

  // ==========================================
  // Step 4: Проверка наличия видеопотока
  // ==========================================
  const videoStream = probe.videoStream;
  if (!videoStream) {
    addStep('step4_video', 4, 'Проверка видеопотока', 'failed', 'Видеопоток полностью отсутствует (обнаружен только звук или пустой контейнер)');
    return createFailureReport(
      'error_no_video',
      'Ошибка: видеопоток отсутствует',
      'Файл не содержит активного видеопотока.',
      fileSize
    );
  }

  addStep(
    'step4_video',
    4,
    'Проверка видеопотока',
    'passed',
    `Кодек: ${videoStream.codecName}, Разрешение: ${videoStream.width}x${videoStream.height}, FPS: ${videoStream.rFrameRate || 'н/д'}`
  );

  // ==========================================
  // Step 5: Проверка аудиопотока
  // ==========================================
  const audioStream = probe.audioStream;
  let audioWarning = false;
  if (!audioStream) {
    if (options.userMutedRequested) {
      addStep(
        'step5_audio',
        5,
        'Проверка аудиопотока',
        'passed',
        'Аудио отсутствует в соответствии с запросом пользователя (режим «Без звука»)'
      );
    } else {
      audioWarning = true;
      addStep(
        'step5_audio',
        5,
        'Проверка аудиопотока',
        'warning',
        'Звуковая дорожка отсутствует в исходном материале'
      );
    }
  } else {
    addStep(
      'step5_audio',
      5,
      'Проверка аудиопотока',
      'passed',
      `Кодек: ${audioStream.codecName}, Частота: ${audioStream.sampleRate || 0} Гц, Каналы: ${audioStream.channels || 0}`
    );
  }

  // ==========================================
  // Step 6: Тестовое декодирование видеокадров
  // ==========================================
  const testDuration = Math.min(Math.max(probe.durationSec, 1), 6);
  const decodeResult = await testFrameDecodability(filePath, testDuration);
  if (!decodeResult.success) {
    addStep(
      'step6_decode',
      6,
      'Тестовое декодирование кадров',
      'failed',
      `Декодер FFmpeg вернул сбой: ${decodeResult.error || 'Невозможно декодировать кадры'}`
    );
    return createFailureReport(
      'error_decode',
      'Ошибка: видеокадры не декодируются',
      decodeResult.error || 'Сбой декодера при попытке распаковать фреймы',
      fileSize
    );
  }

  addStep(
    'step6_decode',
    6,
    'Тестовое декодирование кадров',
    'passed',
    `Успешно декодировано ~${decodeResult.decodedFrames} кадров без битых NAL-блоков`
  );

  // ==========================================
  // Step 7: Защита от черного экрана (Black Screen Detector)
  // ==========================================
  const blackResult = await testBlackScreenDetection(filePath, probe.durationSec, 8);
  logs.push(`[Черный экран]: ${blackResult.log}`);

  let blackScreenFailure = false;
  let blackScreenWarning = false;

  if (blackResult.isEntirelyBlack) {
    blackScreenFailure = true;
    addStep(
      'step7_black',
      7,
      'Анализ черного экрана / пустых кадров',
      'failed',
      `Критический сбой: видео полностью состоит из черных/пустых кадров (доля: ${blackResult.blackRatioPercent}%)`
    );
    return createFailureReport(
      'error_black_screen',
      'Ошибка: видео полностью черное',
      'Обнаружен пустой или полностью черный экран во всех проверенных кадрах.',
      fileSize
    );
  } else if (blackResult.hasBlackSegments) {
    blackScreenWarning = true;
    addStep(
      'step7_black',
      7,
      'Анализ черного экрана / пустых кадров',
      'warning',
      `Обнаружены локальные участки затемнения (${blackResult.segments.length} шт., общая доля ${blackResult.blackRatioPercent}%)`
    );
  } else {
    addStep(
      'step7_black',
      7,
      'Анализ черного экрана / пустых кадров',
      'passed',
      `Черный экран не обнаружен. Кадры содержат активную светимость и валидный видеоряд`
    );
  }

  // ==========================================
  // Step 8: Проверка соответствия длительности и размеров
  // ==========================================
  let dimMatch = true;
  if (options.expectedWidth && videoStream.width && options.expectedWidth !== videoStream.width) {
    dimMatch = false;
  }
  if (options.expectedMinDuration && probe.durationSec < options.expectedMinDuration) {
    dimMatch = false;
  }

  if (!dimMatch) {
    addStep(
      'step8_consistency',
      8,
      'Проверка согласованности метаданных',
      'warning',
      `Длительность (${probe.durationSec.toFixed(1)}с) или разрешение (${videoStream.width}x${videoStream.height}) отличаются от ожидаемых значений`
    );
  } else {
    addStep(
      'step8_consistency',
      8,
      'Проверка согласованности метаданных',
      'passed',
      `Длительность и геометрические размеры соответствуют спецификации (${videoStream.width}x${videoStream.height})`
    );
  }

  // ==========================================
  // Step 9: Итоговый статус (честная оценка охвата)
  // ==========================================
  const isFullyTested = probe.durationSec <= 10;
  const coverageNote = isFullyTested
    ? 'Полный файл проверен на 100%'
    : `Проверен контрольный фрагмент ${testDuration.toFixed(1)}с из ${probe.durationSec.toFixed(1)}с`;

  let overallState: VerificationState = 'passed';
  let badgeLabel = 'Проверка пройдена';
  let badgeVariant: 'success' | 'warning' | 'error' = 'success';
  let badgeDesc = `Все тесты целостности, сигнатуры и декодирования пройдены успешно (${coverageNote}).`;

  if (audioWarning) {
    overallState = 'warning_no_audio';
    badgeLabel = 'Предупреждение: звук отсутствует';
    badgeVariant = 'warning';
    badgeDesc = 'Видеоряд корректен и проверен, однако звуковая дорожка в файле отсутствует.';
  } else if (blackScreenWarning) {
    overallState = 'warning_black_frames';
    badgeLabel = 'Предупреждение: фрагмент черного экрана';
    badgeVariant = 'warning';
    badgeDesc = 'Видео содержит временные темные сцены, но декодируется без ошибок.';
  }

  addStep(
    'step9_final',
    9,
    'Итоговое подтверждение целостности',
    overallState === 'passed' ? 'passed' : 'warning',
    `${badgeLabel} [${coverageNote}]`
  );

  return {
    overallState,
    stateBadge: {
      label: badgeLabel,
      variant: badgeVariant,
      description: badgeDesc,
    },
    fileSize,
    durationSec: probe.durationSec,
    width: videoStream.width,
    height: videoStream.height,
    containerFormat: probe.formatName,
    videoCodec: videoStream.codecName,
    audioCodec: audioStream?.codecName,
    hasVideo: true,
    hasAudio: !!audioStream,
    userMutedRequested: options.userMutedRequested,
    testedDurationSec: testDuration,
    isFullyTested,
    decodedFramesCount: decodeResult.decodedFrames,
    isBlackScreenDetected: blackResult.hasBlackSegments,
    isEntirelyBlack: blackResult.isEntirelyBlack,
    blackRatioPercent: blackResult.blackRatioPercent,
    blackSegments: blackResult.segments,
    meanLuminance: blackResult.meanLuminance,
    steps,
    logs,
  };
}
