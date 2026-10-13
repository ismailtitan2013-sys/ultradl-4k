export interface MediaStreamInfo {
  index: number;
  codecType: 'video' | 'audio' | 'subtitle' | 'other';
  codecName: string;
  codecLongName?: string;
  profile?: string;
  width?: number;
  height?: number;
  rFrameRate?: string;
  avgFrameRate?: string;
  bitRate?: number;
  channels?: number;
  sampleRate?: number;
  channelLayout?: string;
  duration?: number;
}

export interface MediaProbeResult {
  formatName: string;
  formatLongName: string;
  durationSec: number;
  sizeBytes: number;
  bitRate?: number;
  streams: MediaStreamInfo[];
  videoStream?: MediaStreamInfo;
  audioStream?: MediaStreamInfo;
  width?: number;
  height?: number;
  is4K: boolean;
  resolutionLabel: string;
}

export interface QualityPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  is4K: boolean;
  isNative: boolean;
  bitrateEstimateKbps?: number;
  fps?: number;
}

export type VerificationState =
  | 'idle'
  | 'acquired'
  | 'verifying'
  | 'passed'
  | 'warning_no_audio'
  | 'warning_black_frames'
  | 'error_empty'
  | 'error_invalid_signature'
  | 'error_no_video'
  | 'error_corrupt'
  | 'error_decode'
  | 'error_black_screen'
  | 'error_ssrf'
  | 'error_size_limit'
  | 'error_ffmpeg';

export interface VerificationStep {
  id: string;
  stepNumber: number;
  title: string;
  status: 'pending' | 'running' | 'passed' | 'warning' | 'failed' | 'skipped';
  details?: string;
  timestamp: string;
}

export interface BlackSegment {
  start: number;
  end: number;
  duration: number;
}

export interface VerificationReport {
  overallState: VerificationState;
  stateBadge: {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'neutral' | 'processing';
    description: string;
  };
  fileSize: number;
  durationSec: number;
  width?: number;
  height?: number;
  containerFormat: string;
  videoCodec?: string;
  audioCodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  userMutedRequested?: boolean;
  testedDurationSec: number;
  isFullyTested: boolean;
  decodedFramesCount: number;
  isBlackScreenDetected: boolean;
  isEntirelyBlack: boolean;
  blackRatioPercent: number;
  blackSegments: BlackSegment[];
  meanLuminance?: number;
  steps: VerificationStep[];
  logs: string[];
  outputUrl?: string;
  streamUrl?: string;
  downloadFileName?: string;
  thumbnailUrl?: string;
}

export interface SourceAnalysisResult {
  isPermitted: boolean;
  sourceType: 'direct_url' | 'uploaded_file' | 'synthetic_sample' | 'unsupported_platform';
  sourceName: string;
  title: string;
  url?: string;
  errorMessage?: string;
  ethicalNotice?: {
    platform: string;
    reason: string;
    officialAlternative: string;
  };
  probe?: MediaProbeResult;
  availableResolutions: QualityPreset[];
  thumbnailUrl?: string;
  directDownloadAllowed: boolean;
}

export interface ProcessTaskRequest {
  sourceType: 'direct_url' | 'uploaded_file' | 'synthetic_sample';
  url?: string;
  uploadedFileId?: string;
  targetQualityHeight?: number;
  audioAction: 'keep_audio' | 'mute_audio' | 'merge_audio';
  separateAudioUrl?: string;
  separateAudioFileId?: string;
  allowReencode?: boolean;
}

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  durationMs: number;
  details: string;
  log: string[];
}
