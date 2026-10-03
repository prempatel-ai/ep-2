"""Application errors.

Every error that can reach a client carries a stable machine-readable ``code`` and
an HTTP status, so the API layer can translate it without inspecting messages.
"""

from __future__ import annotations


class SahayakError(Exception):
    code = "internal_error"
    http_status = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ConfigurationError(SahayakError):
    code = "configuration_error"


class InvalidRequestError(SahayakError):
    code = "invalid_request"
    http_status = 400


class InvalidAudioError(SahayakError):
    code = "invalid_audio"
    http_status = 400


class VoiceUnavailableError(SahayakError):
    code = "voice_unavailable"
    http_status = 503


class LanguageModelUnavailableError(SahayakError):
    code = "llm_unavailable"
    http_status = 503


class SpeechRecognitionError(SahayakError):
    code = "stt_failed"
    http_status = 500


class SpeechSynthesisError(SahayakError):
    code = "tts_failed"
    http_status = 500
