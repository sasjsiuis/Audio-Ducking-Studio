import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  MoveHorizontal, 
  RotateCcw, 
  Infinity, 
  FileAudio, 
  Music, 
  History,
  Trash2,
  Crop,
  Sparkles
} from 'lucide-react';
import { TrackState } from '../types';

interface TrackAudioEditorProps {
  dialogue: TrackState;
  music: TrackState;
  currentTime: number;
  onRestore: (isSpeech: boolean) => void;
  onShiftDelay: (isSpeech: boolean, delay: number) => void;
  onTrim: (isSpeech: boolean, start: number, end: number) => void;
  onSliceAtPlayhead: (isSpeech: boolean, keepBefore: boolean) => void;
  onLoopExtend: (isSpeech: boolean, target: number) => void;
}

export function TrackAudioEditor({
  dialogue,
  music,
  currentTime,
  onRestore,
  onShiftDelay,
  onTrim,
  onSliceAtPlayhead,
  onLoopExtend,
}: TrackAudioEditorProps) {
  // Input local state management
  const [dialShift, setDialShift] = useState<number>(1.5);
  const [dialTrimStart, setDialTrimStart] = useState<number>(0);
  const [dialTrimEnd, setDialTrimEnd] = useState<number>(10);
  const [dialLoopLength, setDialLoopLength] = useState<number>(20);

  const [musicShift, setMusicShift] = useState<number>(2.0);
  const [musicTrimStart, setMusicTrimStart] = useState<number>(0);
  const [musicTrimEnd, setMusicTrimEnd] = useState<number>(10);
  const [musicLoopLength, setMusicLoopLength] = useState<number>(30);

  // Synchronize ranges to track durations when tracks are updated
  useEffect(() => {
    if (dialogue.buffer) {
      setDialTrimEnd(Math.round(dialogue.duration * 10) / 10);
      setDialLoopLength(Math.round(dialogue.duration * 1.5 * 10) / 10);
    }
  }, [dialogue.buffer, dialogue.duration]);

  useEffect(() => {
    if (music.buffer) {
      setMusicTrimEnd(Math.round(music.duration * 10) / 10);
      setMusicLoopLength(Math.round(music.duration * 1.5 * 10) / 10);
    }
  }, [music.buffer, music.duration]);

  const hasAnyTrack = !!(dialogue.buffer || music.buffer);

  if (!hasAnyTrack) return null;

  return (
    <div className="bg-[#121214] p-5 rounded-xl border border-[#222225] shadow-2xl flex flex-col gap-5">
      <div className="border-b border-[#222225] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="font-display font-semibold text-[#e0e0e0] text-sm tracking-wide">
            EASY TRACK WAVE EDITOR & CLIP MANIPULATION
          </h3>
          <p className="text-xs text-[#88888b] mt-0.5">
            Trim clips, shift offsets on the timeline, slice at the live playhead, or loop audio streams.
          </p>
        </div>
        <div className="bg-amber-500/10 text-amber-500 font-mono text-[10px] px-2.5 py-1 rounded-lg border border-amber-500/20 uppercase tracking-wider font-semibold">
          Active Playhead: {currentTime.toFixed(2)}s
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dialogue Track Tools */}
        <div className={`p-5 rounded-xl border ${dialogue.buffer ? 'border-[#333336] bg-[#0c0c0e]/80' : 'border-[#222225] bg-[#0a0a0b]/30 opacity-50'}`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-amber-500">
              <FileAudio className="w-4 h-4" />
              <h4 className="font-display font-medium text-xs uppercase tracking-wider text-[#e0e0e0]">Dialogue Clip Tools</h4>
            </div>
            {dialogue.buffer && (
              <button
                onClick={() => onRestore(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-[#88888b] hover:text-[#e0e0e0] bg-[#1c1c1f] hover:bg-[#28282c] border border-[#222225] rounded-md transition cursor-pointer"
                title="Discard all edits and restore original file"
              >
                <History className="w-3 h-3" />
                Restore Original
              </button>
            )}
          </div>

          {dialogue.buffer ? (
            <div className="flex flex-col gap-4 text-xs">
              <div className="bg-[#121214] p-3 rounded-lg border border-[#222225]">
                <span className="text-[10px] text-[#88888b] font-mono block mb-1">CURRENT CLIP METRIC</span>
                <span className="text-xs text-slate-300 font-medium truncate block">{dialogue.name}</span>
                <span className="text-[10px] text-[#88888b] font-mono block mt-0.5">Length: {dialogue.duration.toFixed(2)} seconds</span>
              </div>

              {/* 1. Shift Clip Offset */}
              <div className="space-y-2">
                <label className="text-[#88888b] font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MoveHorizontal className="w-3.5 h-3.5 text-amber-500" />
                    Move Clip / Shifting Delay
                  </span>
                  <span className="font-mono text-[10px] text-amber-500">+{dialShift.toFixed(1)}s</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="15"
                    step="0.1"
                    value={dialShift}
                    onChange={(e) => setDialShift(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500 h-1 bg-[#1c1c1f] rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={() => onShiftDelay(true, dialShift)}
                    className="px-3 py-1.5 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded text-[11px] transition cursor-pointer whitespace-nowrap"
                  >
                    Delay Clip
                  </button>
                </div>
              </div>

              {/* 2. Slice at playhead */}
              <div className="space-y-2 border-t border-[#222225]/60 pt-3">
                <span className="text-[#88888b] font-medium flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  Cut / Slice Clip at Playhead
                </span>
                <p className="text-[10px] text-[#555558] leading-relaxed">
                  Trims the audio track immediately relative to the yellow player coordinate ({currentTime.toFixed(2)}s).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSliceAtPlayhead(true, true)}
                    disabled={currentTime <= 0 || currentTime >= dialogue.duration}
                    className="py-1.5 px-2 bg-[#1c1c1f] hover:bg-[#28282c] text-[#e0e0e0] border border-[#222225] hover:border-amber-500/50 rounded text-[11px] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
                    title="Keep beginning up to playhead"
                  >
                    ✂️ Keep BEFORE Playhead
                  </button>
                  <button
                    onClick={() => onSliceAtPlayhead(true, false)}
                    disabled={currentTime <= 0 || currentTime >= dialogue.duration}
                    className="py-1.5 px-2 bg-[#1c1c1f] hover:bg-[#28282c] text-[#e0e0e0] border border-[#222225] hover:border-amber-500/50 rounded text-[11px] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
                    title="Keep from playhead to end"
                  >
                    ✂️ Keep AFTER Playhead
                  </button>
                </div>
              </div>

              {/* 3. Range Trimming */}
              <div className="space-y-2 border-t border-[#222225]/60 pt-3">
                <span className="text-[#88888b] font-medium flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-amber-500" />
                  Precise Range Trim (Crop)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[#555558] block mb-1">Start Trim (sec)</span>
                    <input
                      type="number"
                      min="0"
                      max={dialogue.duration}
                      step="0.1"
                      value={dialTrimStart}
                      onChange={(e) => setDialTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#121214] border border-[#222225] rounded px-2 py-1 text-xs text-[#e0e0e0] font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555558] block mb-1">End Trim (sec)</span>
                    <input
                      type="number"
                      min="0.1"
                      max={dialogue.duration}
                      step="0.1"
                      value={dialTrimEnd}
                      onChange={(e) => setDialTrimEnd(Math.min(dialogue.duration, parseFloat(e.target.value) || dialogue.duration))}
                      className="w-full bg-[#121214] border border-[#222225] rounded px-2 py-1 text-xs text-[#e0e0e0] font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={() => onTrim(true, dialTrimStart, dialTrimEnd)}
                  className="w-full py-1.5 bg-[#1c1c1f] hover:bg-amber-500 hover:text-black hover:border-transparent text-amber-500 border border-amber-500/30 rounded text-[11px] font-semibold transition cursor-pointer text-center"
                >
                  Apply Crop Range
                </button>
              </div>

              {/* 4. Loop / Extend */}
              <div className="space-y-2 border-t border-[#222225]/60 pt-3">
                <label className="text-[#88888b] font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Infinity className="w-3.5 h-3.5 text-amber-500" />
                    Extend Dialogue (Pad/Loop)
                  </span>
                  <span className="font-mono text-[10px] text-amber-500">{dialLoopLength}s</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={dialogue.duration}
                    max="180"
                    value={dialLoopLength}
                    onChange={(e) => setDialLoopLength(Math.max(dialogue.duration, parseInt(e.target.value) || dialogue.duration))}
                    className="w-24 bg-[#121214] border border-[#222225] rounded px-2.5 py-1 text-xs text-[#e0e0e0] font-mono"
                    title="Target extended length in seconds"
                  />
                  <button
                    onClick={() => onLoopExtend(true, dialLoopLength)}
                    className="flex-1 py-1.5 bg-[#1c1c1f] hover:bg-[#28282c] text-[#e0e0e0] border border-[#222225] rounded text-[11px] font-semibold transition cursor-pointer"
                  >
                    Apply Tile / Pad Extension
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <p className="text-xs text-[#555558] italic py-8 text-center">
              Please upload or load a Speech Target track to enable these wave editing features.
            </p>
          )}
        </div>

        {/* Background Music Track Tools */}
        <div className={`p-5 rounded-xl border ${music.buffer ? 'border-[#333336] bg-[#0c0c0e]/80' : 'border-[#222225] bg-[#0a0a0b]/30 opacity-50'}`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Music className="w-4 h-4" />
              <h4 className="font-display font-medium text-xs uppercase tracking-wider text-[#e0e0e0]">Bed Music Clip Tools</h4>
            </div>
            {music.buffer && (
              <button
                onClick={() => onRestore(false)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-[#88888b] hover:text-[#e0e0e0] bg-[#1c1c1f] hover:bg-[#28282c] border border-[#222225] rounded-md transition cursor-pointer"
                title="Discard all edits and restore original file"
              >
                <History className="w-3 h-3" />
                Restore Original
              </button>
            )}
          </div>

          {music.buffer ? (
            <div className="flex flex-col gap-4 text-xs">
              <div className="bg-[#121214] p-3 rounded-lg border border-[#222225]">
                <span className="text-[10px] text-[#88888b] font-mono block mb-1">CURRENT CLIP METRIC</span>
                <span className="text-xs text-slate-300 font-medium truncate block">{music.name}</span>
                <span className="text-[10px] text-[#88888b] font-mono block mt-0.5">Length: {music.duration.toFixed(2)} seconds</span>
              </div>

              {/* 1. Shift Clip Offset */}
              <div className="space-y-2">
                <label className="text-[#88888b] font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MoveHorizontal className="w-3.5 h-3.5 text-amber-500" />
                    Move Clip / Shifting Delay
                  </span>
                  <span className="font-mono text-[10px] text-amber-500">+{musicShift.toFixed(1)}s</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="15"
                    step="0.1"
                    value={musicShift}
                    onChange={(e) => setMusicShift(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500 h-1 bg-[#1c1c1f] rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={() => onShiftDelay(false, musicShift)}
                    className="px-3 py-1.5 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded text-[11px] transition cursor-pointer whitespace-nowrap"
                  >
                    Delay Clip
                  </button>
                </div>
              </div>

              {/* 2. Slice at playhead */}
              <div className="space-y-2 border-t border-[#222225]/60 pt-3">
                <span className="text-[#88888b] font-medium flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  Cut / Slice Clip at Playhead
                </span>
                <p className="text-[10px] text-[#555558] leading-relaxed">
                  Trims the audio track immediately relative to the yellow player coordinate ({currentTime.toFixed(2)}s).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSliceAtPlayhead(false, true)}
                    disabled={currentTime <= 0 || currentTime >= music.duration}
                    className="py-1.5 px-2 bg-[#1c1c1f] hover:bg-[#28282c] text-[#e0e0e0] border border-[#222225] hover:border-amber-500/50 rounded text-[11px] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
                    title="Keep beginning up to playhead"
                  >
                    ✂️ Keep BEFORE Playhead
                  </button>
                  <button
                    onClick={() => onSliceAtPlayhead(false, false)}
                    disabled={currentTime <= 0 || currentTime >= music.duration}
                    className="py-1.5 px-2 bg-[#1c1c1f] hover:bg-[#28282c] text-[#e0e0e0] border border-[#222225] hover:border-amber-500/50 rounded text-[11px] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
                    title="Keep from playhead to end"
                  >
                    ✂️ Keep AFTER Playhead
                  </button>
                </div>
              </div>

              {/* 3. Range Trimming */}
              <div className="space-y-2 border-t border-[#222225]/60 pt-3">
                <span className="text-[#88888b] font-medium flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-amber-500" />
                  Precise Range Trim (Crop)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[#555558] block mb-1">Start Trim (sec)</span>
                    <input
                      type="number"
                      min="0"
                      max={music.duration}
                      step="0.1"
                      value={musicTrimStart}
                      onChange={(e) => setMusicTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#121214] border border-[#222225] rounded px-2 py-1 text-xs text-[#e0e0e0] font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555558] block mb-1">End Trim (sec)</span>
                    <input
                      type="number"
                      min="0.1"
                      max={music.duration}
                      step="0.1"
                      value={musicTrimEnd}
                      onChange={(e) => setMusicTrimEnd(Math.min(music.duration, parseFloat(e.target.value) || music.duration))}
                      className="w-full bg-[#121214] border border-[#222225] rounded px-2 py-1 text-xs text-[#e0e0e0] font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={() => onTrim(false, musicTrimStart, musicTrimEnd)}
                  className="w-full py-1.5 bg-[#1c1c1f] hover:bg-amber-500 hover:text-black hover:border-transparent text-amber-500 border border-amber-500/30 rounded text-[11px] font-semibold transition cursor-pointer text-center"
                >
                  Apply Crop Range
                </button>
              </div>

              {/* 4. Loop / Extend */}
              <div className="space-y-2 border-t border-[#222225]/60 pt-3">
                <label className="text-[#88888b] font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Infinity className="w-3.5 h-3.5 text-amber-500" />
                    Extend Bed Music (Tile Loop)
                  </span>
                  <span className="font-mono text-[10px] text-amber-500">{musicLoopLength}s</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={music.duration}
                    max="180"
                    value={musicLoopLength}
                    onChange={(e) => setMusicLoopLength(Math.max(music.duration, parseInt(e.target.value) || music.duration))}
                    className="w-24 bg-[#121214] border border-[#222225] rounded px-2.5 py-1 text-xs text-[#e0e0e0] font-mono"
                    title="Target extended length in seconds"
                  />
                  <button
                    onClick={() => onLoopExtend(false, musicLoopLength)}
                    className="flex-1 py-1.5 bg-[#1c1c1f] hover:bg-[#28282c] text-[#e0e0e0] border border-[#222225] rounded text-[11px] font-semibold transition cursor-pointer"
                  >
                    Apply Seamless Tile Loop
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <p className="text-xs text-[#555558] italic py-8 text-center">
              Please upload or load a Bed Music track to enable these wave editing features.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
