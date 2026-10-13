from typing import List, Optional
from pydantic import BaseModel, Field

class MediaStreamModel(BaseModel):
    index: int
    codec_type: str
    codec_name: str
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[str] = None
    bitrate: Optional[int] = None
    channels: Optional[int] = None
    sample_rate: Optional[int] = None

class MediaProbeModel(BaseModel):
    format_name: str
    duration_sec: float
    size_bytes: int
    bitrate: Optional[int] = None
    streams: List[MediaStreamModel]
    width: Optional[int] = None
    height: Optional[int] = None
    is_4k: bool
    resolution_label: str

class QualityPresetModel(BaseModel):
    id: str
    label: str
    width: int
    height: int
    is_4k: bool
    is_native: bool

class AnalyzeRequest(BaseModel):
    url: str

class AnalyzeResponse(BaseModel):
    is_permitted: bool
    source_type: str
    source_name: str
    title: str
    url: Optional[str] = None
    error_message: Optional[str] = None
    probe: Optional[MediaProbeModel] = None
    available_resolutions: List[QualityPresetModel] = []
    direct_download_allowed: bool

class VerificationStepModel(BaseModel):
    id: str
    step_number: int
    title: str
    status: str
    details: Optional[str] = None
    timestamp: str

class VerificationReportModel(BaseModel):
    overall_state: str
    badge_label: str
    badge_variant: str
    badge_description: str
    file_size: int
    duration_sec: float
    width: Optional[int] = None
    height: Optional[int] = None
    container_format: str
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    has_video: bool
    has_audio: bool
    user_muted_requested: bool = False
    tested_duration_sec: float
    is_fully_tested: bool
    decoded_frames_count: int
    is_black_screen_detected: bool
    is_entirely_black: bool
    black_ratio_percent: int
    steps: List[VerificationStepModel]
    logs: List[str]
    output_url: Optional[str] = None
    download_filename: Optional[str] = None

class ProcessTaskRequest(BaseModel):
    source_type: str = Field(..., description="direct_url, uploaded_file, synthetic_sample")
    url: Optional[str] = None
    uploaded_file_id: Optional[str] = None
    target_quality_height: Optional[int] = None
    audio_action: str = Field(default="keep_audio", description="keep_audio, mute_audio, merge_audio")
    separate_audio_file_id: Optional[str] = None
    allow_reencode: bool = True
