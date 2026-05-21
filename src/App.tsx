import React, { useState, useEffect, useRef } from 'react';
import { 
  FileAudio, 
  Music, 
  Play, 
  Pause, 
  Square, 
  Download, 
  RotateCcw, 
  Sparkles, 
  Check, 
  Volume2, 
  VolumeX,
  Upload,
  AlertCircle,
  HelpCircle,
  Scissors,
  MoveHorizontal,
  Infinity,
  History
} from 'lucide-react';
import { DuckingParams, TrackState, TimelineState, PlayMode } from './types';
import { 
  getWaveformPeaks, 
  generateDemoDialogue, 
  generateDemoMusic, 
  computeClientAudioDucking, 
  audioBufferToWav,
  delayAudioBuffer,
  trimAudioBuffer,
  loopExtendAudioBuffer,
  truncateAudioBuffer
} from './utils';
import { SidebarControls } from './components/SidebarControls';
import { WaveformTimeline } from './components/WaveformTimeline';
import { PythonScriptPanel } from './components/PythonScriptPanel';
import { TrackAudioEditor } from './components/TrackAudioEditor';

const INITIAL_PARAMS: DuckingParams = {
  sensitivityDB: -30,
  duckAmountDB: -18,
  fadeTimeMs: 800,
};

const INITIAL_TIMELINE: TimelineState = {
  isPlaying: false,
  currentTime: 0,
  playMode: 'mix',
  dialogueVolume: 0.85,
  musicVolume: 0.6,
};

export default function App() {
  // Navigation Tabs: 'studio' (Interactive Web Audio) vs 'python' (Python Code Script)
  const [activeTab, setActiveTab] = useState<'studio' | 'python'>('studio');

  // Audio Context for Decoding and Auditioning
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Core Track States
  const [dialogue, setDialogue] = useState<TrackState>({
    name: '',
    duration: 0,
    size: 0,
    buffer: null,
    peaks: [],
  });

  const [music, setMusic] = useState<TrackState>({
    name: '',
    duration: 0,
    size: 0,
    buffer: null,
    peaks: [],
  });

  // Backup of original pristine uploads for quick undo/reverts
  const [originalDialogue, setOriginalDialogue] = useState<TrackState | null>(null);
  const [originalMusic, setOriginalMusic] = useState<TrackState | null>(null);

  // Drag over states for visual dropzones
  const [isDragDialogue, setIsDragDialogue] = useState(false);
  const [isDragMusic, setIsDragMusic] = useState(false);

  // Ducking Processing Outcome
  const [duckedMusicBuffer, setDuckedMusicBuffer] = useState<AudioBuffer | null>(null);
  const [gainEnvelope, setGainEnvelope] = useState<Float32Array | null>(null);
  
  // App Control States
  const [params, setParams] = useState<DuckingParams>(INITIAL_PARAMS);
  const [timeline, setTimeline] = useState<TimelineState>(INITIAL_TIMELINE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDemoLoaded, setIsDemoLoaded] = useState(false);

  // Web Audio Transportation Refs for concurrent playback loop
  const sourceDialRef = useRef<AudioBufferSourceNode | null>(null);
  const sourceMusRef = useRef<AudioBufferSourceNode | null>(null);
  const gainDialRef = useRef<GainNode | null>(null);
  const gainMusRef = useRef<GainNode | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausePositionRef = useRef<number>(0);

  // Max duration available for playing
  const playDuration = Math.max(dialogue.duration, music.duration);

  // Master Volume Gain node ref
  const masterGainRef = useRef<GainNode | null>(null);

  // Initialize Audio Context lazily on user gesture
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Safe reset utility
  const handleReset = () => {
    setParams(INITIAL_PARAMS);
    setTimeline(prev => ({
      ...prev,
      dialogueVolume: INITIAL_TIMELINE.dialogueVolume,
      musicVolume: INITIAL_TIMELINE.musicVolume,
    }));
  };

  // Decode file to AudioBuffer on upload
  const processIncomingFile = async (file: File, isSpeech: boolean) => {
    setErrorMsg('');
    const ctx = getAudioContext();

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Decode inside audio context
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const peaks = getWaveformPeaks(audioBuffer, 500);

      const track: TrackState = {
        name: file.name,
        duration: audioBuffer.duration,
        size: Math.round(file.size / 1024), // in KB
        buffer: audioBuffer,
        peaks,
      };

      if (isSpeech) {
        setDialogue(track);
        setOriginalDialogue(track);
        // Clear processed results since track changed
        setDuckedMusicBuffer(null);
        setGainEnvelope(null);
        setIsDemoLoaded(false);
      } else {
        setMusic(track);
        setOriginalMusic(track);
        setDuckedMusicBuffer(null);
        setGainEnvelope(null);
        setIsDemoLoaded(false);
      }
      stopPlayback();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to parse file "${file.name}". Ensure it is a valid, uncorrupted MP3/WAV audio track.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isSpeech: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processIncomingFile(file, isSpeech);
  };

  // Synthesize high-quality demo workspace
  const handleLoadDemo = () => {
    setErrorMsg('');
    const ctx = getAudioContext();
    stopPlayback();

    try {
      // 1. Voice
      const dialBuf = generateDemoDialogue(ctx);
      const dialPeaks = getWaveformPeaks(dialBuf, 500);
      const dialTrack: TrackState = {
        name: 'Voiceover_Pro_Demo.wav',
        duration: dialBuf.duration,
        size: 512, // mock kb
        buffer: dialBuf,
        peaks: dialPeaks,
      };
      setDialogue(dialTrack);
      setOriginalDialogue(dialTrack);

      // 2. Music Synth
      const musBuf = generateDemoMusic(ctx);
      const musPeaks = getWaveformPeaks(musBuf, 500);
      const musTrack: TrackState = {
        name: 'Ambient_Music_Bed.wav',
        duration: musBuf.duration,
        size: 2048, // mock kb
        buffer: musBuf,
        peaks: musPeaks,
      };
      setMusic(musTrack);
      setOriginalMusic(musTrack);

      // Reset ducked output
      setDuckedMusicBuffer(null);
      setGainEnvelope(null);
      setIsDemoLoaded(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to synthesize high quality demo channels.');
    }
  };

  // --- TRACK AUDIO EDITING HANDLERS ---

  // Revert track to its original uploaded state
  const handleRestoreTrack = (isSpeech: boolean) => {
    setErrorMsg('');
    const original = isSpeech ? originalDialogue : originalMusic;
    if (!original) {
      setErrorMsg(`No original backup found to restore for ${isSpeech ? 'Dialogue' : 'Music'} track.`);
      return;
    }
    stopPlayback();
    if (isSpeech) {
      setDialogue(original);
    } else {
      setMusic(original);
    }
    setDuckedMusicBuffer(null);
    setGainEnvelope(null);
  };

  // Shift track start position (add padding silence)
  const handleShiftDelay = (isSpeech: boolean, delaySeconds: number) => {
    setErrorMsg('');
    if (delaySeconds <= 0) return;
    const ctx = getAudioContext();
    const track = isSpeech ? dialogue : music;
    if (!track.buffer) {
      setErrorMsg('No audio track loaded to shift.');
      return;
    }

    try {
      stopPlayback();
      const newBuffer = delayAudioBuffer(ctx, track.buffer, delaySeconds);
      const peaks = getWaveformPeaks(newBuffer, 500);

      const updatedTrack: TrackState = {
        ...track,
        name: `Shifted_+${delaySeconds}s_` + track.name.replace(/^Shifted_\+\d+s_/, ''),
        duration: newBuffer.duration,
        buffer: newBuffer,
        peaks,
      };

      if (isSpeech) {
        setDialogue(updatedTrack);
      } else {
        setMusic(updatedTrack);
      }
      setDuckedMusicBuffer(null);
      setGainEnvelope(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to shift track: ${err.message}`);
    }
  };

  // Trim a custom range
  const handleTrimTrack = (isSpeech: boolean, startSec: number, endSec: number) => {
    setErrorMsg('');
    const ctx = getAudioContext();
    const track = isSpeech ? dialogue : music;
    if (!track.buffer) {
      setErrorMsg('No audio track loaded to trim.');
      return;
    }

    if (startSec < 0) startSec = 0;
    if (endSec > track.duration) endSec = track.duration;
    if (startSec >= endSec) {
      setErrorMsg('Trim start time must be less than trim end time.');
      return;
    }

    try {
      stopPlayback();
      const newBuffer = trimAudioBuffer(ctx, track.buffer, startSec, endSec);
      const peaks = getWaveformPeaks(newBuffer, 500);

      const updatedTrack: TrackState = {
        ...track,
        name: `Trimmed_${startSec}-${endSec}s_` + track.name.replace(/^Trimmed_\d+-\d+s_/, ''),
        duration: newBuffer.duration,
        buffer: newBuffer,
        peaks,
      };

      if (isSpeech) {
        setDialogue(updatedTrack);
      } else {
        setMusic(updatedTrack);
      }
      setDuckedMusicBuffer(null);
      setGainEnvelope(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to trim track: ${err.message}`);
    }
  };

  // Slice / Cut track at custom timestamp (e.g. current playhead)
  const handleSliceAtTimestamp = (isSpeech: boolean, keepBefore: boolean) => {
    setErrorMsg('');
    const track = isSpeech ? dialogue : music;
    if (!track.buffer) {
      setErrorMsg('No audio track loaded to cut.');
      return;
    }

    const t = timeline.currentTime;
    if (t <= 0 || t >= track.duration) {
      setErrorMsg(`Playhead is outside the loaded track range. Seek to a point between 0 and ${track.duration.toFixed(1)}s to cut.`);
      return;
    }

    try {
      stopPlayback();
      let newBuffer;
      const ctx = getAudioContext();
      if (keepBefore) {
        // Keep from 0 to current playhead (remove everything after)
        newBuffer = trimAudioBuffer(ctx, track.buffer, 0, t);
      } else {
        // Keep from current playhead to end (remove everything before)
        newBuffer = trimAudioBuffer(ctx, track.buffer, t, track.duration);
      }

      const peaks = getWaveformPeaks(newBuffer, 500);
      const updatedTrack: TrackState = {
        ...track,
        name: `Cut_${keepBefore ? 'Before' : 'After'}_${t.toFixed(1)}s_` + track.name,
        duration: newBuffer.duration,
        buffer: newBuffer,
        peaks,
      };

      if (isSpeech) {
        setDialogue(updatedTrack);
      } else {
        setMusic(updatedTrack);
      }
      
      // Reset playhead position if it's now out of bounds
      if (keepBefore) {
        setTimeline(prev => ({ ...prev, currentTime: Math.max(0, Math.min(prev.currentTime, t)) }));
      } else {
        setTimeline(prev => ({ ...prev, currentTime: 0 }));
      }
      setDuckedMusicBuffer(null);
      setGainEnvelope(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to cut track: ${err.message}`);
    }
  };

  // Loop/repeat track to extend its length
  const handleLoopExtendTrack = (isSpeech: boolean, targetDuration: number) => {
    setErrorMsg('');
    if (targetDuration <= 0) return;
    const ctx = getAudioContext();
    const track = isSpeech ? dialogue : music;
    if (!track.buffer) {
      setErrorMsg('No audio track loaded to extend.');
      return;
    }

    try {
      stopPlayback();
      const newBuffer = loopExtendAudioBuffer(ctx, track.buffer, targetDuration);
      const peaks = getWaveformPeaks(newBuffer, 500);

      const updatedTrack: TrackState = {
        ...track,
        name: `Extended_${targetDuration}s_` + track.name.replace(/^Extended_\d+s_/, ''),
        duration: newBuffer.duration,
        buffer: newBuffer,
        peaks,
      };

      if (isSpeech) {
        setDialogue(updatedTrack);
      } else {
        setMusic(updatedTrack);
      }
      setDuckedMusicBuffer(null);
      setGainEnvelope(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to extend track: ${err.message}`);
    }
  };

  // Perform Audio Ducking Math
  const handleProcessDucking = () => {
    if (!dialogue.buffer || !music.buffer) {
      setErrorMsg('You must upload/generate both a Dialogue track and a Background Music track before ducking calculations.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    stopPlayback();

    // Small delay to let React render a processing Spinner safely
    setTimeout(() => {
      try {
        const result = computeClientAudioDucking(dialogue.buffer!, music.buffer!, params);
        setDuckedMusicBuffer(result.mixedBuffer); // ducked music has been isolated under custom buffer
        setGainEnvelope(result.gainEnvelope);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Error running digital signal processing algorithm: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    }, 150);
  };

  // 16-Bit Studio WAV mixdown download
  const handleDownloadMix = () => {
    if (!dialogue.buffer || !duckedMusicBuffer) return;

    try {
      const sampleRate = dialogue.buffer.sampleRate;
      const numChannels = 2;
      const outputLength = duckedMusicBuffer.length;
      
      const ctx = getAudioContext();
      // Re-compile clean mixed buffer (dialogue + ducked music background)
      const finalMixBuffer = ctx.createBuffer(numChannels, outputLength, sampleRate);
      
      const dialL = dialogue.buffer.getChannelData(0);
      const dialR = dialogue.buffer.numberOfChannels > 1 ? dialogue.buffer.getChannelData(1) : dialL;
      
      const duckedMusL = duckedMusicBuffer.getChannelData(0);
      const duckedMusR = duckedMusicBuffer.getChannelData(1);

      const mixL = finalMixBuffer.getChannelData(0);
      const mixR = finalMixBuffer.getChannelData(1);

      for (let s = 0; s < outputLength; s++) {
        // Overlay both
        const valL = dialL[s] + duckedMusL[s];
        const valR = dialR[s] + duckedMusR[s];

        // Safe hard clipping
        mixL[s] = Math.max(-1, Math.min(1, valL));
        mixR[s] = Math.max(-1, Math.min(1, valR));
      }

      const wavBlob = audioBufferToWav(finalMixBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Studio_Mix_${isDemoLoaded ? 'Demo' : 'Ducked'}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg('Failed to encode mixed stream to WAV format: ' + err.message);
    }
  };

  // Playback Control: start playing streams
  const startPlayback = (offset: number) => {
    const ctx = getAudioContext();
    stopPlayback(); // make sure there's no overlapping streams

    // Create play nodes
    const sourceDial = ctx.createBufferSource();
    const sourceMus = ctx.createBufferSource();

    // Assign buffers safely
    sourceDial.buffer = dialogue.buffer;
    // If we have fully calculated ducked tracks, play ducked version. Otherwise play initial un-ducked track
    sourceMus.buffer = duckedMusicBuffer || music.buffer;

    // Create Volume Node splits
    const gainDial = ctx.createGain();
    const gainMus = ctx.createGain();

    // Route Volume weights depending on Solo buttons / Volumes
    const isMix = timeline.playMode === 'mix';
    const isSoloDial = timeline.playMode === 'dialogue';
    const isSoloMus = timeline.playMode === 'music';

    gainDial.gain.value = (isMix || isSoloDial) ? timeline.dialogueVolume : 0;
    gainMus.gain.value = (isMix || isSoloMus) ? timeline.musicVolume : 0;

    // Save node refs to dynamically adjust gains while playing!
    gainDialRef.current = gainDial;
    gainMusRef.current = gainMus;

    // Superimpose output destination
    sourceDial.connect(gainDial).connect(ctx.destination);
    sourceMus.connect(gainMus).connect(ctx.destination);

    // Record source refs to stop
    sourceDialRef.current = sourceDial;
    sourceMusRef.current = sourceMus;

    // Align start offsets
    if (dialogue.buffer) sourceDial.start(0, Math.min(offset, dialogue.duration));
    if (music.buffer) sourceMus.start(0, Math.min(offset, music.duration));

    // Save accurate starting marker
    startTimeRef.current = ctx.currentTime - offset;
    pausePositionRef.current = offset;

    setTimeline(prev => ({ ...prev, isPlaying: true }));
    
    // Begin continuous timeline frame sweep
    const tick = () => {
      const current = ctx.currentTime - startTimeRef.current;
      if (current >= playDuration) {
        // Complete of track
        setCurrentTimeDirectly(0);
        stopPlayback();
      } else {
        setTimeline(prev => ({ ...prev, currentTime: current }));
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const stopPlayback = () => {
    // Cancel render sweep animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop physical source nodes
    try {
      if (sourceDialRef.current) {
        sourceDialRef.current.stop();
        sourceDialRef.current.disconnect();
      }
    } catch {}
    try {
      if (sourceMusRef.current) {
        sourceMusRef.current.stop();
        sourceMusRef.current.disconnect();
      }
    } catch {}

    sourceDialRef.current = null;
    sourceMusRef.current = null;
    gainDialRef.current = null;
    gainMusRef.current = null;

    setTimeline(prev => ({ ...prev, isPlaying: false }));
  };

  const togglePrimaryPlayback = () => {
    if (!dialogue.buffer && !music.buffer) {
      setErrorMsg('No audio files loaded. Please upload your tracks or load our demo workspace to begin!');
      return;
    }

    if (timeline.isPlaying) {
      // Pause
      pausePositionRef.current = timeline.currentTime;
      stopPlayback();
    } else {
      // Resume
      startPlayback(pausePositionRef.current);
    }
  };

  const handleStopTransport = () => {
    pausePositionRef.current = 0;
    setCurrentTimeDirectly(0);
    stopPlayback();
  };

  const handleSeekOffset = (time: number) => {
    const boundedTime = Math.max(0, Math.min(time, playDuration));
    pausePositionRef.current = boundedTime;
    setTimeline(prev => ({ ...prev, currentTime: boundedTime }));

    if (timeline.isPlaying) {
      // Restart at new play coordinate
      startPlayback(boundedTime);
    }
  };

  const setCurrentTimeDirectly = (time: number) => {
    setTimeline(prev => ({ ...prev, currentTime: time }));
  };

  // Handle active solo configurations in real-time on live streams
  useEffect(() => {
    const isMix = timeline.playMode === 'mix';
    const isSoloDial = timeline.playMode === 'dialogue';
    const isSoloMus = timeline.playMode === 'music';

    if (gainDialRef.current) {
      gainDialRef.current.gain.value = (isMix || isSoloDial) ? timeline.dialogueVolume : 0;
    }
    if (gainMusRef.current) {
      gainMusRef.current.gain.value = (isMix || isSoloMus) ? timeline.musicVolume : 0;
    }
  }, [timeline.playMode, timeline.dialogueVolume, timeline.musicVolume]);

  // Handle parameter edits during active playback (stops streams and forces re-calculation notification)
  useEffect(() => {
    if (duckedMusicBuffer) {
      // If params changed, we set processed buffer to null so user knows to click "Process" to re-calculate!
      setDuckedMusicBuffer(null);
      setGainEnvelope(null);
      stopPlayback();
    }
  }, [params]);

  // Clean play nodes on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const formatPlaybackDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#e0e0e0] font-sans antialiased selection:bg-amber-500/20 selection:text-white">
      {/* Dynamic Header */}
      <header className="border-b border-[#222225] bg-[#0A0A0B]/90 backdrop-blur px-6 py-4 sticky top-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-none bg-gradient-to-r from-white via-[#c0c0c3] to-[#88888b] bg-clip-text text-transparent tracking-wide">
                Auto-Duck Pro
              </h1>
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mt-1">
                ESSENTIAL SOUND DIGITAL ENGINE
              </p>
            </div>
          </div>

          {/* Navigation Bar Selector */}
          <div className="bg-[#121214] p-1 border border-[#222225] rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'studio'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                  : 'text-[#88888b] hover:text-[#e0e0e0]'
              }`}
            >
              Interactive Studio
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'python'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                  : 'text-[#88888b] hover:text-[#e0e0e0]'
              }`}
            >
              Get Python Script
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        
        {activeTab === 'python' ? (
          /* Tab Two - Python Developer Script Panel */
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="font-display font-semibold text-2xl text-slate-100">Standalone Python Deployment</h2>
              <p className="text-sm text-slate-400 mt-1">Run this complete workspace locally using simple terminal tooling.</p>
            </div>
            <PythonScriptPanel />
          </div>
        ) : (
          /* Tab One - Fully Functional Interactive Web DAW Client Studio */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Sidebar Slider Controls and Param Settings (Covers Grid span 4) */}
            <div className="col-span-1 lg:col-span-4 h-full">
              <SidebarControls
                params={params}
                onChangeParams={setParams}
                timeline={timeline}
                onChangeTimeline={setTimeline}
                onReset={handleReset}
              />
            </div>

            {/* Right Core Processing & Timeline Workspace (Covers Grid span 8) */}
            <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
              
              {/* Errors Alert Notification banner */}
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-sm text-rose-300">
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-200">Processing Interrupted</p>
                    <p className="text-xs text-rose-400/90 mt-0.5 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Step one: Audio File uploads cards row */}
              <div className="bg-[#121214] p-5 rounded-xl border border-[#222225] shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4 pb-3 border-b border-[#222225]">
                  <div>
                    <h3 className="font-display font-semibold text-[#e0e0e0] text-sm tracking-wide">1. STAGE TRACK ASSETS</h3>
                    <p className="text-xs text-[#88888b]">Import recording files or synthesize an immediate demo mix.</p>
                  </div>
                  
                  <button
                    onClick={handleLoadDemo}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold bg-[#1c1c1f] text-amber-500 hover:text-white border border-[#222225] hover:border-amber-500/50 rounded-lg shadow-lg hover:shadow-amber-500/5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Demo Project
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dialogue Track Upload Card with Drag & Drop */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragDialogue(true); }}
                    onDragLeave={() => setIsDragDialogue(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragDialogue(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) await processIncomingFile(file, true);
                    }}
                    className={`p-4 bg-[#0a0a0b]/40 rounded-xl border transition-all relative ${
                      isDragDialogue 
                        ? 'border-amber-500 bg-amber-500/10 scale-[1.01] shadow-lg shadow-amber-500/5' 
                        : dialogue.buffer 
                          ? 'border-amber-500/20 bg-amber-500/5' 
                          : 'border-[#222225] hover:border-[#333336]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                        <FileAudio className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Speech Target
                      </span>
                    </div>

                    {dialogue.buffer ? (
                      <div className="h-[74px] flex flex-col justify-center">
                        <p className="text-sm font-semibold truncate text-slate-200" title={dialogue.name}>
                          {dialogue.name}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          Duration: {dialogue.duration.toFixed(2)}s | Size: {dialogue.size} KB
                        </p>
                        <label className="text-[10px] text-amber-500/80 hover:text-amber-400 mt-1 cursor-pointer underline decoration-dotted">
                          Drag new file or click here to replace
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, true)}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-[74px] border-2 border-dashed border-[#222225] hover:border-amber-500/40 rounded-lg cursor-pointer hover:bg-[#121214]/30 transition-all text-center">
                        <Upload className="w-4 h-4 text-[#555558] mb-1" />
                        <span className="text-xs font-medium text-[#88888b]">Drop files here or click to upload</span>
                        <span className="text-[9px] text-[#555558] mt-0.5">WAV, MP3 support</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, true)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Background Music Track Upload Card with Drag & Drop */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragMusic(true); }}
                    onDragLeave={() => setIsDragMusic(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragMusic(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) await processIncomingFile(file, false);
                    }}
                    className={`p-4 bg-[#0a0a0b]/40 rounded-xl border transition-all relative ${
                      isDragMusic 
                        ? 'border-amber-500 bg-amber-500/10 scale-[1.01] shadow-lg shadow-amber-500/5' 
                        : music.buffer 
                          ? 'border-amber-500/20 bg-amber-500/5' 
                          : 'border-[#222225] hover:border-[#333336]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                        <Music className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Bed Music
                      </span>
                    </div>

                    {music.buffer ? (
                      <div className="h-[74px] flex flex-col justify-center">
                        <p className="text-sm font-semibold truncate text-slate-200" title={music.name}>
                          {music.name}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          Duration: {music.duration.toFixed(2)}s | Size: {music.size} KB
                        </p>
                        <label className="text-[10px] text-amber-500/80 hover:text-amber-400 mt-1 cursor-pointer underline decoration-dotted">
                          Drag new file or click here to replace
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, false)}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-[74px] border-2 border-dashed border-[#222225] hover:border-amber-500/40 rounded-lg cursor-pointer hover:bg-[#121214]/30 transition-all text-center">
                        <Upload className="w-4 h-4 text-[#555558] mb-1" />
                        <span className="text-xs font-medium text-[#88888b]">Drop files here or click to upload</span>
                        <span className="text-[9px] text-[#555558] mt-0.5">WAV, MP3 support</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, false)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 1.5: Track Wave Editor & Clip Manipulation */}
              <TrackAudioEditor
                dialogue={dialogue}
                music={music}
                currentTime={timeline.currentTime}
                onRestore={handleRestoreTrack}
                onShiftDelay={handleShiftDelay}
                onTrim={handleTrimTrack}
                onSliceAtPlayhead={handleSliceAtTimestamp}
                onLoopExtend={handleLoopExtendTrack}
              />

              {/* Action Processor Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-[#1c1c1f]/40 to-[#121214] border border-[#222225] rounded-xl shadow-2xl">
                <div className="text-center sm:text-left">
                  <h3 className="font-display font-semibold text-[#e0e0e0] text-sm tracking-wide">2. AUDIO DUCKING RENDER</h3>
                  <p className="text-xs text-[#88888b] mt-0.5">Applies settings to background music and compiles real-time mix.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                  {dialogue.buffer && music.buffer && (
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-xs font-semibold bg-[#1c1c1f] hover:bg-[#28282b] text-[#e0e0e0] hover:text-white rounded-lg border border-[#222225] transition-all cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  )}
                  <button
                    onClick={handleProcessDucking}
                    disabled={isProcessing || !dialogue.buffer || !music.buffer}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold tracking-wide rounded-lg shadow-lg shadow-amber-950/20 transition-all ${
                      dialogue.buffer && music.buffer 
                        ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer hover:-translate-y-0.5 focus:translate-y-0 active:scale-95 shadow-amber-500/10'
                        : 'bg-[#1c1c1f] text-[#555558] cursor-not-allowed border border-[#222225]'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        Calculations Running...
                      </>
                    ) : duckedMusicBuffer ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-black" />
                        Re-Process Ducking
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Perform Audio Ducking
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step Three: Waveforms view Card */}
              <div className="bg-[#121214] p-5 rounded-xl border border-[#222225] shadow-2xl">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#222225]">
                  <div>
                    <h3 className="font-display font-semibold text-[#e0e0e0] text-sm tracking-wide">3. SIGNAL MONITOR & WAVEFORMS</h3>
                    <p className="text-xs text-[#88888b]">Track triggers and ducking attenuation curves visually on the timeline.</p>
                  </div>
                </div>

                {/* Plot Timeline Canvas */}
                <WaveformTimeline
                  dialoguePeaks={dialogue.peaks}
                  musicPeaks={music.peaks}
                  sensitivityDB={params.sensitivityDB}
                  duckAmountDB={params.duckAmountDB}
                  gainEnvelope={gainEnvelope}
                  currentTime={timeline.currentTime}
                  duration={playDuration}
                  onSeek={handleSeekOffset}
                />
              </div>

              {/* Player/Mixer Transport Panel */}
              <div className="bg-[#121214] p-5 rounded-xl border border-[#222225] flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl">
                
                {/* 1. Solo Selection Buttons */}
                <div className="flex flex-col gap-1.5 w-full md:w-auto">
                  <span className="text-[10px] uppercase font-bold text-[#88888b] tracking-wider font-display">Play Monitor Mode</span>
                  <div className="bg-[#0a0a0b] p-1 border border-[#222225] rounded-xl flex self-start">
                    <button
                      onClick={() => setTimeline(prev => ({ ...prev, playMode: 'mix' }))}
                      disabled={!dialogue.buffer}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeline.playMode === 'mix'
                          ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                          : 'text-[#88888b] hover:text-[#e0e0e0] disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      Studio Mix
                    </button>
                    <button
                      onClick={() => setTimeline(prev => ({ ...prev, playMode: 'dialogue' }))}
                      disabled={!dialogue.buffer}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeline.playMode === 'dialogue'
                          ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                          : 'text-[#88888b] hover:text-[#e0e0e0] disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      Dialogue Only
                    </button>
                    <button
                      onClick={() => setTimeline(prev => ({ ...prev, playMode: 'music' }))}
                      disabled={!music.buffer}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeline.playMode === 'music'
                          ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                          : 'text-[#88888b] hover:text-[#e0e0e0] disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      Music (Ducked)
                    </button>
                  </div>
                </div>

                {/* 2. Audio Control Playhead Deck */}
                <div className="flex items-center gap-3.5 py-1">
                  <button
                    onClick={handleStopTransport}
                    disabled={!dialogue.buffer && !music.buffer}
                    className="p-3 bg-[#1c1c1f] hover:bg-[#28282c] hover:text-white disabled:opacity-45 disabled:cursor-not-allowed border border-[#222225] rounded-xl transition cursor-pointer"
                    title="Stop and return to zero"
                  >
                    <Square className="w-4 h-4 fill-current text-[#88888b]" />
                  </button>

                  <button
                    onClick={togglePrimaryPlayback}
                    disabled={!dialogue.buffer && !music.buffer}
                    className={`p-4 rounded-full shadow-lg transition-all cursor-pointer ${
                      timeline.isPlaying 
                        ? 'bg-amber-500 shadow-amber-500/15 hover:bg-amber-400 hover:shadow-amber-500/35 text-black scale-105 active:scale-95'
                        : 'bg-[#1c1c1f] shadow-lg hover:bg-amber-500 hover:text-black border border-[#222225] hover:border-amber-400 text-[#e0e0e0] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {timeline.isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="flex flex-col text-left pl-2">
                    <span className="font-mono text-sm font-semibold tracking-wide text-[#e0e0e0]">
                      {formatPlaybackDuration(timeline.currentTime)}
                    </span>
                    <span className="text-[10px] text-[#555558] font-mono mt-0.5">
                      Total: {formatPlaybackDuration(playDuration)}
                    </span>
                  </div>
                </div>

                {/* 3. Export Downloader */}
                <div className="w-full md:w-auto">
                  <button
                    onClick={handleDownloadMix}
                    disabled={!duckedMusicBuffer}
                    className={`flex items-center justify-center gap-2 w-full md:w-auto px-5 py-3 text-xs font-bold tracking-wide rounded-xl shadow-lg border transition-all cursor-pointer ${
                      duckedMusicBuffer
                        ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/10 border-amber-400 hover:-translate-y-0.5'
                        : 'bg-[#1c1c1f] text-[#555558] cursor-not-allowed border border-[#222225]'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Export Studio Mix (WAV)
                  </button>
                  {!duckedMusicBuffer && (dialogue.buffer || music.buffer) && (
                    <p className="text-[9px] text-[#555558] font-mono text-center md:text-right mt-1.5 leading-normal">
                      *Click "Perform Audio Ducking" to unlock download
                    </p>
                  )}
                </div>

              </div>

            </div>
          </div>
        )}
      </main>

      {/* Decorative clean brand footer */}
      <footer className="mt-12 py-8 border-t border-[#222225] bg-[#0c0c0e] text-center text-xs text-[#555558]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>
            Auto-Duck Pro &copy; 2026. Designed with browser-native Web Audio engines.
          </p>
          <div className="flex gap-4 font-mono text-[10px]">
            <span>Stereo Output Matrix</span>
            <span className="text-[#222225]">|</span>
            <span>44100 Hz Linear PCM</span>
            <span className="text-[#222225]">|</span>
            <span>Unprecedented Precision</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
