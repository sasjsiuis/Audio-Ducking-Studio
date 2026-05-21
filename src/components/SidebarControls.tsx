import React from 'react';
import { DuckingParams, TimelineState } from '../types';
import { Sliders, RefreshCw, AudioLines, Info, HelpCircle } from 'lucide-react';

interface SidebarControlsProps {
  params: DuckingParams;
  onChangeParams: (newParams: DuckingParams) => void;
  timeline: TimelineState;
  onChangeTimeline: (newTimeline: TimelineState) => void;
  onReset: () => void;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  params,
  onChangeParams,
  timeline,
  onChangeTimeline,
  onReset,
}) => {
  const updateParam = (key: keyof DuckingParams, val: number) => {
    onChangeParams({
      ...params,
      [key]: val,
    });
  };

  const updateVol = (key: 'dialogueVolume' | 'musicVolume', val: number) => {
    onChangeTimeline({
      ...timeline,
      [key]: val,
    });
  };

  return (
    <div className="flex flex-col gap-6 bg-[#121214] p-5 rounded-xl border border-[#222225] shadow-2xl h-full">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-[#222225]">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          <h3 className="font-display font-semibold text-[#e0e0e0] text-sm tracking-wide">ESSENTIAL SOUNDS</h3>
        </div>
        <button
          onClick={onReset}
          title="Reset to default settings"
          className="p-1.5 text-[#88888b] hover:text-[#e0e0e0] hover:bg-[#1c1c1f] rounded-lg transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Premiere Pro-style Sliders */}
      <div className="flex flex-col gap-6">
        {/* 1. Sensitivity Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-[#c0c0c3] flex items-center gap-1.5">
              Sensitivity (dB Threshold)
              <span className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-[#555558] hover:text-[#88888b] cursor-help" />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-5 hidden group-hover:block w-48 p-2 bg-[#121214] border border-[#222225] text-[10px] text-[#88888b] rounded shadow-2xl leading-normal z-50">
                  Threshold limit. Any dialogue exceeding this volume initiates background music ducking.
                </span>
              </span>
            </span>
            <span className="font-mono text-amber-500 font-semibold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {params.sensitivityDB} dB
            </span>
          </div>
          <input
            type="range"
            min="-50"
            max="-10"
            value={params.sensitivityDB}
            onChange={(e) => updateParam('sensitivityDB', parseInt(e.target.value))}
            className="w-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#555558] font-mono">
            <span>-50 dB (Very Sensitive)</span>
            <span>-10 dB (Loud Voice)</span>
          </div>
        </div>

        {/* 2. Duck Amount Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-[#c0c0c3] flex items-center gap-1.5">
              Duck Amount (Reduction dB)
              <span className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-[#555558] hover:text-[#88888b] cursor-help" />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-5 hidden group-hover:block w-48 p-2 bg-[#121214] border border-[#222225] text-[10px] text-[#88888b] rounded shadow-2xl leading-normal z-50">
                  How much music volume dampens when speech starts. -18 dB is clean standard.
                </span>
              </span>
            </span>
            <span className="font-mono text-amber-500 font-semibold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {params.duckAmountDB} dB
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="-5"
            value={params.duckAmountDB}
            onChange={(e) => updateParam('duckAmountDB', parseInt(e.target.value))}
            className="w-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#555558] font-mono">
            <span>-30 dB (Heavy Cut)</span>
            <span>-5 dB (Subtle Dip)</span>
          </div>
        </div>

        {/* 3. Fade Time Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-[#c0c0c3] flex items-center gap-1.5">
              Fade Time (ms)
              <span className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-[#555558] hover:text-[#88888b] cursor-help" />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-5 hidden group-hover:block w-48 p-2 bg-[#121214] border border-[#222225] text-[10px] text-[#88888b] rounded shadow-2xl leading-normal z-50">
                  The milliseconds it takes for music to smoothly transition to ducked level and swell back.
                </span>
              </span>
            </span>
            <span className="font-mono text-amber-500 font-semibold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {params.fadeTimeMs} ms
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={params.fadeTimeMs}
            onChange={(e) => updateParam('fadeTimeMs', parseInt(e.target.value))}
            className="w-full cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-[#555558] font-mono">
            <span>100ms (Fast Gate)</span>
            <span>2000ms (Ethereal Fade)</span>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-[#222225] my-1" />

      {/* Direct Playback Mixing Controls */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <AudioLines className="w-4 h-4 text-amber-500" />
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-[#88888b] font-display">LIVE MIXER</h4>
        </div>

        {/* Dialogue Audition Volume */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs text-[#a0a0a5] font-mono">
            <span>Voice Track Level</span>
            <span>{Math.round(timeline.dialogueVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={timeline.dialogueVolume}
            onChange={(e) => updateVol('dialogueVolume', parseFloat(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>

        {/* Music Audition Volume */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs text-[#a0a0a5] font-mono">
            <span>Music Track Level</span>
            <span>{Math.round(timeline.musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={timeline.musicVolume}
            onChange={(e) => updateVol('musicVolume', parseFloat(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-auto bg-[#1c1c1f]/40 border border-[#222225] p-3 rounded-lg flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#88888b] flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-[#88888b] leading-normal font-sans">
          Ducking applies real-time RMS parsing at <span className="font-semibold text-[#c0c0c3]">50ms intervals</span>. Sound envelopes are smoothed sample-by-sample with premium digital crossfading.
        </p>
      </div>
    </div>
  );
};
