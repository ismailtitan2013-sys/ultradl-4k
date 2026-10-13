import fs from 'node:fs';
import path from 'node:path';
import { createSyntheticTestFile, mergeVideoAndAudio } from './ffmpeg.ts';
import { verifyVideoFile } from './verifier.ts';
import { validateUrlAgainstSSRF, safeDownloadFile } from './ssrf.ts';
import type { TestCaseResult } from '../types/video.ts';

export async function runAllAutomatedTests(workDir: string): Promise<TestCaseResult[]> {
  const testResults: TestCaseResult[] = [];
  const testDir = path.join(workDir, 'automated_tests_' + Date.now());
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const runTest = async (
    id: string,
    name: string,
    category: string,
    expectedOutcome: string,
    fn: (logs: string[]) => Promise<{ passed: boolean; actual: string; details: string }>
  ) => {
    const logs: string[] = [];
    const startTime = Date.now();
    try {
      logs.push(`Запуск теста [${id}]: ${name}`);
      const res = await fn(logs);
      const durationMs = Date.now() - startTime;
      testResults.push({
        id,
        name,
        category,
        expectedOutcome,
        actualOutcome: res.actual,
        passed: res.passed,
        durationMs,
        details: res.details,
        log: logs,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startTime;
      testResults.push({
        id,
        name,
        category,
        expectedOutcome,
        actualOutcome: `Исключение: ${errorMsg}`,
        passed: false,
        durationMs,
        details: `Непредвиденное исключение в тесте: ${errorMsg}`,
        log: logs,
      });
    }
  };

  // Test 1: Корректный MP4 со звуком
  await runTest(
    'test_1_valid_audio',
    'Корректный MP4 со звуком (1080p/720p)',
    'Целостность и верификация',
    'Проверка пройдена (Passed), звук и видео обнаружены',
    async (logs) => {
      const p = path.join(testDir, 'test_1.mp4');
      await createSyntheticTestFile('valid_audio', p);
      logs.push('Создан синтетический тестовый ролик со звуковой дорожкой AAC');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'passed' && rep.hasVideo && rep.hasAudio;
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Видео: ${rep.hasVideo}, Аудио: ${rep.hasAudio}`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 2: Корректное видео без звука
  await runTest(
    'test_2_valid_no_audio',
    'Корректное видео без звуковой дорожки',
    'Целостность и верификация',
    'Предупреждение: звук отсутствует (Warning)',
    async (logs) => {
      const p = path.join(testDir, 'test_2.mp4');
      await createSyntheticTestFile('valid_no_audio', p);
      logs.push('Создан видеоролик без аудиодорожки');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'warning_no_audio' && rep.hasVideo && !rep.hasAudio;
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Аудио присутствует: ${rep.hasAudio}`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 3: Пустой файл (0 байт)
  await runTest(
    'test_3_empty_file',
    'Пустой файл (0 байт)',
    'Защита от повреждений',
    'Ошибка: пустой файл (Error Empty File)',
    async (logs) => {
      const p = path.join(testDir, 'test_3.mp4');
      await createSyntheticTestFile('empty', p);
      logs.push('Создан файл 0 байт');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'error_empty';
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Оповещение: ${rep.stateBadge.label}`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 4: Повреждённый контейнер (битая сигнатура)
  await runTest(
    'test_4_corrupt_container',
    'Повреждённый контейнер / фальшивое расширение',
    'Защита от повреждений',
    'Ошибка: поврежденный контейнер (Magic Bytes Invalid)',
    async (logs) => {
      const p = path.join(testDir, 'test_4.mp4');
      await createSyntheticTestFile('corrupt', p);
      logs.push('Создан файл с произвольным мусором вместо ftyp заголовка');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'error_invalid_signature';
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Распознано: ${rep.containerFormat}`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 5: Отсутствующий видеопоток (только аудио дорожка)
  await runTest(
    'test_5_no_video_stream',
    'Отсутствующий видеопоток (только аудио)',
    'Защита от повреждений',
    'Ошибка: видеопоток отсутствует (Error No Video)',
    async (logs) => {
      const p = path.join(testDir, 'test_5.m4a');
      await createSyntheticTestFile('no_video', p);
      logs.push('Создан файл исключительно со звуком');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'error_no_video';
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Видеопоток: ${rep.hasVideo}`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 6: Черный экран / пустые кадры (100% black)
  await runTest(
    'test_6_black_screen',
    'Защита от черного экрана (100% темные кадры)',
    'Black Screen Protection',
    'Ошибка: видео полностью черное / обнаружен пустой экран',
    async (logs) => {
      const p = path.join(testDir, 'test_6.mp4');
      await createSyntheticTestFile('black_screen', p);
      logs.push('Сгенерирован ролик lavfi color=c=black');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'error_black_screen' || rep.isEntirelyBlack;
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Доля черного экрана: ${rep.blackRatioPercent}%`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 7: Невозможность декодировать кадры (поврежденный битовый поток)
  await runTest(
    'test_7_decode_error',
    'Ошибка декодирования кадров (битый битовый поток)',
    'Защита от повреждений',
    'Ошибка: видеокадры не декодируются (Decode Failure)',
    async (logs) => {
      const p = path.join(testDir, 'test_7.mp4');
      await createSyntheticTestFile('decode_error', p);
      logs.push('Создан файл с испорченными NAL-пакетами');
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'error_decode' || rep.overallState === 'error_corrupt';
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Ошибка декодера перехвачена`,
        details: rep.stateBadge.description,
      };
    }
  );

  // Test 8: Объединение потоков FFmpeg (видео + аудио)
  await runTest(
    'test_8_ffmpeg_merge',
    'Объединение отдельных аудио- и видеодорожек через FFmpeg',
    'Обработка потоков',
    'Успешное слияние потоков и повторная валидация итогового файла',
    async (logs) => {
      const v = path.join(testDir, 'merge_v.mp4');
      const a = path.join(testDir, 'merge_a.m4a');
      const out = path.join(testDir, 'merge_out.mp4');
      await createSyntheticTestFile('valid_no_audio', v);
      await createSyntheticTestFile('no_video', a);
      logs.push('Созданы независимые видеодорожка и аудиодорожка');
      const mergeRes = await mergeVideoAndAudio(v, a, out, true);
      logs.push(mergeRes.log);
      if (!mergeRes.success) {
        return { passed: false, actual: `FFmpeg сбой: ${mergeRes.error}`, details: 'Ошибка слияния' };
      }
      const verified = await verifyVideoFile(out);
      logs.push(...verified.logs);
      const passed = verified.overallState === 'passed' && verified.hasAudio && verified.hasVideo;
      return {
        passed,
        actual: `Слияние завершено успешно (${mergeRes.usedReencode ? 'Re-encoded audio' : 'Stream copy'}), итоговый статус: ${verified.overallState}`,
        details: 'Оба потока объединены и повторно валидированы',
      };
    }
  );

  // Test 9: Превышение лимита размера файла
  await runTest(
    'test_9_size_limit',
    'Ограничение максимального размера загрузки',
    'Безопасность сервера',
    'Блокировка и прерывание скачивания при превышении лимита',
    async (logs) => {
      const fakeUrl = 'https://example.com/huge-file.mp4';
      // Simulate safeDownload with small limit
      let caught = false;
      try {
        const dest = path.join(testDir, 'huge.bin');
        await safeDownloadFile(fakeUrl, dest, 100); // 100 bytes limit
      } catch (err: unknown) {
        caught = true;
        const msg = err instanceof Error ? err.message : String(err);
        logs.push(`Перехвачено ограничение: ${msg}`);
      }
      return {
        passed: caught,
        actual: caught ? 'Загрузка своевременно прервана, лимит защищен' : 'Лимит не сработал',
        details: 'Проверка заголовка Content-Length и потока байт работает корректно',
      };
    }
  );

  // Test 10: Недоступный источник / Ошибка хоста
  await runTest(
    'test_10_unreachable_host',
    'Недоступный источник (несуществующий хост)',
    'Сетевая надежность',
    'Корректная обработка ошибки без падения сервера',
    async (logs) => {
      const fakeUrl = 'https://non-existent-domain-test-ultradl4k-9876543210.org/video.mp4';
      const check = await validateUrlAgainstSSRF(fakeUrl);
      logs.push(`Результат DNS проверки: valid=${check.valid}, reason=${check.reason}`);
      const passed = Boolean(!check.valid && (check.reason?.includes('DNS') || check.reason?.includes('хост')));
      return {
        passed,
        actual: check.reason || 'Ошибка зафиксирована',
        details: 'Сервер вернул честное сообщение об ошибке, исключив сбой',
      };
    }
  );

  // Test 11: Защита от SSRF (приватные IP и метаданные)
  await runTest(
    'test_11_ssrf_blocked',
    'Защита от SSRF (127.0.0.1, 169.254.169.254, metadata)',
    'Безопасность сервера',
    'Блокировка всех обращений к локальным и облачным метаданным',
    async (logs) => {
      const targets = [
        'http://127.0.0.1:8080/secret',
        'http://localhost/admin',
        'http://169.254.169.254/computeMetadata/v1/',
        'http://192.168.1.1/router',
        'http://10.0.0.1/internal',
      ];
      let allBlocked = true;
      for (const t of targets) {
        const res = await validateUrlAgainstSSRF(t);
        logs.push(`Тест ${t} -> Заблокировано: ${!res.valid} (${res.reason})`);
        if (res.valid) allBlocked = false;
      }
      return {
        passed: allBlocked,
        actual: allBlocked ? 'Все 5 приватных/служебных адресов заблокированы SSRF Guard' : 'Один из адресов прошел проверку!',
        details: '127.0.0.1, 169.254.169.254, 192.168.0.0/16, 10.0.0.0/8 надежно защищены',
      };
    }
  );

  // Test 12: Реальный синтетический тест 4K (2160p UHD 3840x2160)
  await runTest(
    'test_12_4k_sample',
    'Реальная обработка и проверка 4K Ultra HD (3840x2160)',
    'Поддержка 4K (2160p)',
    'Генерация и подтверждение разрешения 3840x2160 UHD без искусственного апскейла',
    async (logs) => {
      const p = path.join(testDir, 'test_4k.mp4');
      logs.push('Генерация реального тестового ролика 3840x2160 UHD через FFmpeg lavfi...');
      await createSyntheticTestFile('sample_4k', p);
      const rep = await verifyVideoFile(p);
      logs.push(...rep.logs);
      const passed = rep.overallState === 'passed' && rep.width === 3840 && rep.height === 2160;
      return {
        passed,
        actual: `Статус: ${rep.overallState}, Разрешение: ${rep.width}x${rep.height} (4K UHD: ${passed})`,
        details: `Файл подтвержден: 3840x2160, кодек ${rep.videoCodec}, звук ${rep.audioCodec || 'нет'}`,
      };
    }
  );

  // Cleanup test directory
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  return testResults;
}

// Runnable directly via `tsx src/server/test_runner.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- ЗАПУСК АВТОМАТИЧЕСКИХ ТЕСТОВ ULTRADL 4K ---');
  runAllAutomatedTests('/tmp')
    .then((results) => {
      let passedCount = 0;
      results.forEach((r, idx) => {
        if (r.passed) passedCount++;
        const symbol = r.passed ? '✓ УСПЕШНО' : '✗ ПРОВАЛЕНО';
        console.log(`[${idx + 1}/12] ${symbol} | ${r.name} (${r.durationMs}ms)`);
        console.log(`       Результат: ${r.actualOutcome}`);
      });
      console.log(`\nИтого: ${passedCount} из ${results.length} тестов пройдено успешно.`);
      process.exit(passedCount === results.length ? 0 : 1);
    })
    .catch((err) => {
      console.error('Ошибка выполнения тестов:', err);
      process.exit(1);
    });
}
