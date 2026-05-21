import React, { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

interface WaveformTimelineProps {
  dialoguePeaks: number[];
  musicPeaks: number[];
  sensitivityDB: number;
  duckAmountDB: number;
  gainEnvelope: Float32Array | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  dialoguePeaks,
  musicPeaks,
  sensitivityDB,
  duckAmountDB,
  gainEnvelope,
  currentTime,
  duration,
  onSeek,
}) => {
  const dialogueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const musicCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const sensitivityAmp = Math.pow(10, sensitivityDB / 20);
  const duckGain = Math.pow(10, duckAmountDB / 20);

  // Render Dialogue Waveform
  useEffect(() => {
    const canvas = dialogueCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Background horizontal divider
    ctx.strokeStyle = '#222225';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (dialoguePeaks.length === 0) {
      // Draw placeholder text
      ctx.fillStyle = '#555558';
      ctx.font = '13px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload Dialogue Track to View Waveform', width / 2, centerY + 5);
      return;
    }

    const maxPeak = Math.max(...dialoguePeaks, 0.05);
    const barsCount = dialoguePeaks.length;
    const gap = 1.5;
    const barWidth = (width / barsCount) - gap;

    // Draw Dialogue Peaks
    for (let i = 0; i < barsCount; i++) {
       const peak = dialoguePeaks[i];
       // Normalize peak size to scale properly
       const normalizedPeak = peak / maxPeak;
       // Amplitude matches height
       const barHeight = Math.max(2, normalizedPeak * (height * 0.85) / 2);

       const x = i * (barWidth + gap);

       // Check if peak triggers threshold
       const isVoiceActive = peak > sensitivityAmp;

       if (isVoiceActive) {
         ctx.fillStyle = '#fbbf24'; // Intense Amber Glow Trigger
       } else {
         ctx.fillStyle = '#4b4b4f'; // Professional Slate grey
       }

       // Draw symmetrical bars
       ctx.beginPath();
       ctx.roundRect(x, centerY - barHeight, Math.max(1.5, barWidth), barHeight * 2, 1);
       ctx.fill();
    }

    // Draw Sensitivity Threshold Line (Upper Half)
    const normSensitivity = sensitivityAmp / maxPeak;
    const thresholdY = centerY - Math.min(centerY - 5, normSensitivity * (height * 0.85) / 2);

    ctx.strokeStyle = '#ef4444'; // Red threshold line
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Draw Sensitivity Text
    ctx.fillStyle = '#ef4444';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Trigger (-${Math.abs(sensitivityDB)} dB)`, width - 10, thresholdY - 4);

  }, [dialoguePeaks, sensitivityDB, sensitivityAmp]);

  // Render Music Waveform + Gain Envelope
  useEffect(() => {
    const canvas = musicCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Background center divider
    ctx.strokeStyle = '#222225';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (musicPeaks.length === 0) {
      ctx.fillStyle = '#555558';
      ctx.font = '13px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload Background Music to View Ducking Overlay', width / 2, centerY + 5);
      return;
    }

    const maxPeak = Math.max(...musicPeaks, 0.05);
    const barsCount = musicPeaks.length;
    const gap = 1.5;
    const barWidth = (width / barsCount) - gap;

    // Prepare envelope mapping
    const envPoints: number[] = [];
    if (gainEnvelope && gainEnvelope.length > 0) {
      const step = Math.floor(gainEnvelope.length / barsCount);
      for (let i = 0; i < barsCount; i++) {
        envPoints.push(gainEnvelope[Math.min(i * step, gainEnvelope.length - 1)]);
      }
    } else {
      // Default to un-ducked 1.0 (0dB) envelope
      for (let i = 0; i < barsCount; i++) envPoints.push(1.0);
    }

    // Draw Background Music and Apply Ducking Reduction Look
    for (let i = 0; i < barsCount; i++) {
      const peak = musicPeaks[i];
      const envVal = envPoints[i]; // value in [duckGain, 1.0]

      const normalizedPeak = peak / maxPeak;
      // Normal unreduced visual scale
      const totalBarHeight = normalizedPeak * (height * 0.8) / 2;
      // Actual output sample height (ducked)
      const duckedBarHeight = Math.max(1, totalBarHeight * envVal);

      const x = i * (barWidth + gap);

      // Draw faint grey background wave showing original (un-ducked) volume level
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(x, centerY - totalBarHeight, Math.max(1.5, barWidth), totalBarHeight * 2, 1);
      ctx.fill();

      // Draw solid wave showing actual ducked level
      ctx.fillStyle = envVal < 0.95 ? '#d97706' : '#555558'; // Warm Amber if ducked, neutral medium grey if clean
      ctx.beginPath();
      ctx.roundRect(x, centerY - duckedBarHeight, Math.max(1.5, barWidth), duckedBarHeight * 2, 1);
      ctx.fill();
    }

    // Draw the Gain Envelope Line overlay (crimson red for dynamic attenuation visual)
    ctx.strokeStyle = '#ef4444'; 
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (let i = 0; i < barsCount; i++) {
      const envVal = envPoints[i];
      const x = i * (barWidth + gap) + (barWidth / 2);
      // Envelope maps from 1.0 (top padding) to duckGain (low padding)
      // Visual scale: map 1.0 to 12% height and duckGain to 88% height range
      const padding = 12;
      const rangeVal = height - (padding * 2);
      const y = padding + (1.0 - envVal) / (1.0 - Math.min(0.1, duckGain)) * rangeVal;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // label gain envelope
    ctx.fillStyle = '#ef4444';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`ATTENUATION CURVE (-${Math.abs(duckAmountDB)} dB)`, 15, 18);

  }, [musicPeaks, gainEnvelope, duckGain, duckAmountDB]);

  // Click on waveform to scrub timeline position
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Waveform Wrapper */}
      <div 
        className="relative bg-[#121214] border border-[#222225] rounded-xl overflow-hidden cursor-crosshair select-none"
        onClick={handleTimelineScrub}
      >
        {/* Playback Progress Tracker Needle (Visual Amber Bar) */}
        {duration > 0 && (
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-amber-500 shadow-lg shadow-amber-500/50 z-20 pointer-events-none transition-all duration-75"
            style={{ left: `${playheadPercent}%` }}
          >
            {/* Tiny Indicator Cap */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-500 rotate-45 border-r border-b border-amber-400 shadow rounded-sm" />
          </div>
        )}

        {/* 1. Track One Dialogue */}
        <div className="border-b border-[#222225]/40 p-4 relative bg-[#0a0a0b]/10">
          <div className="flex justify-between items-center mb-1 text-xs opacity-75 text-[#88888b]">
            <span className="font-semibold flex items-center gap-1.5 font-display text-[#c0c0c3]">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Dialogue Track
            </span>
            <span className="font-mono text-[10px]">Target Input (RMS Analyzed)</span>
          </div>
          <canvas
            ref={dialogueCanvasRef}
            width={850}
            height={130}
            className="w-full h-[130px]"
          />
        </div>

        {/* 2. Track Two Background Music */}
        <div className="p-4 relative bg-[#0a0a0b]/10">
          <div className="flex justify-between items-center mb-1 text-xs opacity-75 text-[#88888b]">
            <span className="font-semibold flex items-center gap-1.5 font-display text-[#c0c0c3]">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              Background Music
            </span>
            <span className="font-mono text-[10px] text-amber-500 flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Automatic Ducking Map (Smoothed)
            </span>
          </div>
          <canvas
            ref={musicCanvasRef}
            width={850}
            height={130}
            className="w-full h-[130px]"
          />
        </div>
      </div>

      {/* Grid Timeline Counter */}
      <div className="flex justify-between px-2 font-mono text-[10px] text-[#555558] uppercase">
        <span>00:00.00</span>
        <span>{(duration * 0.25).toFixed(2)}s</span>
        <span>{(duration * 0.5).toFixed(2)}s</span>
        <span>{(duration * 0.75).toFixed(2)}s</span>
        <span>{duration.toFixed(2)}s</span>
      </div>
    </div>
  );
};
