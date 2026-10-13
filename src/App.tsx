/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { SourceSelector } from './components/SourceSelector.tsx';
import { MediaPreviewCard } from './components/MediaPreviewCard.tsx';
import { QualityAndStreamSelector } from './components/QualityAndStreamSelector.tsx';
import { VerificationPipelineView } from './components/VerificationPipelineView.tsx';
import { ResultCard } from './components/ResultCard.tsx';
import { FileUploadSection } from './components/FileUploadSection.tsx';
import { TestStandSection } from './components/TestStandSection.tsx';
import { EthicsSection } from './components/EthicsSection.tsx';
import type {
  SourceAnalysisResult,
  VerificationReport,
  VerificationStep,
  ProcessTaskRequest,
} from './types/video.ts';

import { YouTubeConfigBar } from './components/YouTubeConfigBar.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'main' | 'upload' | 'tests' | 'docs'>('main');
  const [serverOnline, setServerOnline] = useState(true);

  // Workflow states
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SourceAnalysisResult | null>(null);

  // Uploaded file identifier if uploaded
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);

  // Stream & Quality config
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [audioAction, setAudioAction] = useState<'keep_audio' | 'mute_audio' | 'merge_audio'>('keep_audio');
  const [allowReencode, setAllowReencode] = useState(true);
  const [universalWindowsFormat, setUniversalWindowsFormat] = useState(true);
  const [separateAudioFile, setSeparateAudioFile] = useState<File | null>(null);

  // Processing & Verification Pipeline states
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<VerificationStep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [report, setReport] = useState<VerificationReport | null>(null);

  // Check backend health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, []);

  const handleAnalyze = async (targetUrl?: string) => {
    const toAnalyze = targetUrl || url;
    if (!toAnalyze.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setReport(null);
    setSteps([]);
    setLogs([]);
    setUploadedFileId(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: toAnalyze.trim() }),
      });

      const data: SourceAnalysisResult = await res.json();
      setAnalysisResult(data);

      if (data.availableResolutions.length > 0) {
        setSelectedQuality(data.availableResolutions[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnalysisResult({
        isPermitted: false,
        sourceType: 'direct_url',
        sourceName: 'Ошибка соединения',
        title: 'Не удалось связаться с сервером',
        errorMessage: msg,
        availableResolutions: [],
        directDownloadAllowed: false,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectSynthetic4K = () => {
    const syntheticAnalysis: SourceAnalysisResult = {
      isPermitted: true,
      sourceType: 'synthetic_sample',
      sourceName: 'Синтетический генератор FFmpeg',
      title: 'UltraDL Synthetic Test Pattern (3840x2160 UHD 4K)',
      directDownloadAllowed: true,
      availableResolutions: [
        {
          id: '2160p',
          label: '2160p (3840x2160) — 4K Ultra HD',
          width: 3840,
          height: 2160,
          is4K: true,
          isNative: true,
        },
        {
          id: '1080p',
          label: '1080p (1920x1080) — Full HD',
          width: 1920,
          height: 1080,
          is4K: false,
          isNative: false,
        },
      ],
      probe: {
        formatName: 'mp4,mov',
        formatLongName: 'QuickTime / MOV / MP4',
        durationSec: 2,
        sizeBytes: 1500000,
        streams: [],
        is4K: true,
        resolutionLabel: '2160p (4K UHD)',
        width: 3840,
        height: 2160,
      },
    };

    setAnalysisResult(syntheticAnalysis);
    setSelectedQuality('2160p');
    setReport(null);
    setSteps([]);
    setLogs([]);
    setUrl('');
  };

  const handleFileUploaded = (analysis: SourceAnalysisResult, fileId: string) => {
    setAnalysisResult(analysis);
    setUploadedFileId(fileId);
    if (analysis.availableResolutions.length > 0) {
      setSelectedQuality(analysis.availableResolutions[0].id);
    }
    setReport(null);
    setSteps([]);
    setLogs([]);
    setActiveTab('main');
  };

  const startProcessing = async () => {
    if (!analysisResult) return;

    setIsProcessing(true);
    setReport(null);
    setLogs([
      `[${new Date().toLocaleTimeString('ru-RU')}] Задача зарегистрирована на сервере UltraDL 4K...`,
      `[${new Date().toLocaleTimeString('ru-RU')}] Назначен обработчик FFmpeg 4.4 / ffprobe...`,
    ]);

    // Initial draft steps to show user immediate pipeline visibility
    setSteps([
      { id: 'step1', stepNumber: 1, title: 'Проверка наличия файла на диске', status: 'running', timestamp: new Date().toLocaleTimeString('ru-RU') },
      { id: 'step2', stepNumber: 2, title: 'Анализ сигнатуры контейнера (Magic Bytes)', status: 'pending', timestamp: '' },
      { id: 'step3', stepNumber: 3, title: 'Глубокий анализ потоков (ffprobe)', status: 'pending', timestamp: '' },
      { id: 'step4', stepNumber: 4, title: 'Проверка видеопотока', status: 'pending', timestamp: '' },
      { id: 'step5', stepNumber: 5, title: 'Проверка аудиопотока', status: 'pending', timestamp: '' },
      { id: 'step6', stepNumber: 6, title: 'Тестовое декодирование кадров', status: 'pending', timestamp: '' },
      { id: 'step7', stepNumber: 7, title: 'Анализ черного экрана / пустых кадров', status: 'pending', timestamp: '' },
      { id: 'step8', stepNumber: 8, title: 'Проверка согласованности метаданных', status: 'pending', timestamp: '' },
      { id: 'step9', stepNumber: 9, title: 'Итоговое подтверждение целостности', status: 'pending', timestamp: '' },
    ]);

    let separateAudioFileId: string | undefined = undefined;

    // If separate audio upload is required
    if (audioAction === 'merge_audio' && separateAudioFile) {
      try {
        setLogs((prev) => [...prev, `Загрузка внешнего аудиофайла (${separateAudioFile.name})...`]);
        const formData = new FormData();
        formData.append('file', separateAudioFile);
        const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const upData = await upRes.json();
        separateAudioFileId = upData.fileId;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setLogs((prev) => [...prev, `Ошибка загрузки аудиофайла: ${msg}`]);
        setIsProcessing(false);
        return;
      }
    }

    const heightMatch = selectedQuality.match(/(\d+)p/);
    const targetQualityHeight = heightMatch ? parseInt(heightMatch[1], 10) : undefined;

    const payload: ProcessTaskRequest = {
      sourceType: analysisResult.sourceType as any,
      url: analysisResult.url,
      uploadedFileId: uploadedFileId || undefined,
      targetQualityHeight,
      audioAction,
      separateAudioFileId,
      allowReencode,
      universalWindowsFormat,
    };

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rep: VerificationReport = await res.json();
      setReport(rep);
      setSteps(rep.steps);
      setLogs(rep.logs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `Сбой обработки задачи: ${msg}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverOnline={serverOnline}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Tab 1: Main workflow (Analyze -> Inspect -> Quality -> Process & Verify) */}
        {activeTab === 'main' && (
          <div className="space-y-6">
            <YouTubeConfigBar
              onCookiesUpdated={() => {
                if (url && (url.includes('youtube') || url.includes('youtu.be'))) {
                  handleAnalyze(url);
                }
              }}
            />

            <SourceSelector
              url={url}
              setUrl={setUrl}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              analysisResult={analysisResult}
              onSelectSynthetic4K={handleSelectSynthetic4K}
            />

            {analysisResult && analysisResult.isPermitted && (
              <>
                <MediaPreviewCard analysis={analysisResult} />

                <QualityAndStreamSelector
                  analysis={analysisResult}
                  selectedQuality={selectedQuality}
                  setSelectedQuality={setSelectedQuality}
                  audioAction={audioAction}
                  setAudioAction={setAudioAction}
                  allowReencode={allowReencode}
                  setAllowReencode={setAllowReencode}
                  universalWindowsFormat={universalWindowsFormat}
                  setUniversalWindowsFormat={setUniversalWindowsFormat}
                  separateAudioFile={separateAudioFile}
                  setSeparateAudioFile={setSeparateAudioFile}
                  onStartProcessing={startProcessing}
                  isProcessing={isProcessing}
                />
              </>
            )}

            {(isProcessing || steps.length > 0 || logs.length > 0) && (
              <VerificationPipelineView
                steps={steps}
                logs={logs}
                isProcessing={isProcessing}
                report={report}
              />
            )}

            {report && <ResultCard report={report} />}
          </div>
        )}

        {/* Tab 2: Upload own local file */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <FileUploadSection onFileUploaded={handleFileUploaded} />
          </div>
        )}

        {/* Tab 3: Automated Test Stand (12 Scenarios) */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <TestStandSection />
          </div>
        )}

        {/* Tab 4: Ethics, 4K Integrity & Deployment */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            <EthicsSection />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-[#07080d] py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>UltraDL 4K • Профессиональная обработка и проверка видеофайлов</span>
          <span className="font-mono text-[11px] text-slate-400">
            FFmpeg 4.4 / ffprobe • SSRF Shield • Защита от черного экрана
          </span>
        </div>
      </footer>
    </div>
  );
}
