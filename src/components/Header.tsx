import React from 'react';
import { ShieldCheck, Video, Activity, Sparkles, Terminal, FileCheck, AlertCircle, FolderDown } from 'lucide-react';

interface HeaderProps {
  activeTab: 'main' | 'upload' | 'tests' | 'docs';
  setActiveTab: (tab: 'main' | 'upload' | 'tests' | 'docs') => void;
  serverOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, serverOnline }) => {
  return (
    <header className="border-b border-slate-800/80 bg-[#090b12]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('main')}>
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
                <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  UltraDL <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">4K</span>
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  2160p UHD
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">
                Анализ, объединение и защита от черного экрана (FFmpeg / ffprobe)
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('main')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'main'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Анализ & Поток</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Свой файл</span>
            </button>

            <button
              onClick={() => setActiveTab('tests')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'tests'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Тесты (12)</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'docs'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Политика & 4K</span>
            </button>
          </nav>

          {/* System status indicators & GitHub export */}
          <div className="hidden lg:flex items-center space-x-2.5 text-xs">
            <a
              href="/api/export-zip"
              download="ultradl-4k-source.zip"
              title="Скачать чистый ZIP-архив исходников для GitHub"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-medium transition-all"
            >
              <FolderDown className="w-3.5 h-3.5 text-indigo-400" />
              <span>ZIP проекта (GitHub)</span>
            </a>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="font-mono text-[11px]">FFmpeg 4.4 Engine</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium text-[11px]">SSRF Guard Active</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
