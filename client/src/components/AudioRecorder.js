import React, { useState, useRef, useEffect } from 'react';
import './AudioRecorder.css';

function AudioRecorder({ onRecordingComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleSave = () => {
    if (audioBlob) {
      // Create a File object from the blob
      const file = new File([audioBlob], `audio_description_${Date.now()}.webm`, {
        type: audioBlob.type
      });
      onRecordingComplete(file);
    }
  };

  const handleRetry = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder">
      <div className="recorder-controls">
        {!audioBlob ? (
          <>
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="btn btn-record"
              >
                🎤 Start Recording
              </button>
            ) : (
              <div className="recording-active">
                <button
                  type="button"
                  onClick={stopRecording}
                  className="btn btn-stop"
                >
                  ⏹ Stop Recording
                </button>
                <div className="recording-indicator">
                  <span className="recording-dot"></span>
                  Recording: {formatTime(recordingTime)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="recording-preview">
            <audio src={audioUrl} controls className="preview-audio" />
            <div className="preview-actions">
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary"
              >
                ✓ Use This Recording
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="btn btn-secondary"
              >
                🔄 Record Again
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioRecorder;





