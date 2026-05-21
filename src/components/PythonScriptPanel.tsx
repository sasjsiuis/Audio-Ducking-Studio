import React, { useState } from 'react';
import { Copy, Check, Download, AlertTriangle, Terminal, Code2 } from 'lucide-react';

const PYTHON_CODE = `import streamlit as st
from pydub import AudioSegment
import numpy as np
import io

# Set up page styling
st.set_page_config(
    page_title="Professional Automatic Audio Ducking Studio",
    page_icon="🎙️",
    layout="wide",
)

st.title("🎙️ Professional Automatic Audio Ducking Studio")
st.markdown("""
This application performs automatic audio ducking of background music when a dialogue/voiceover track is active.
It mirrors Adobe Premiere Pro's Essential Sound panel algorithms to deliver clean, professional-sounding crossfades!
""")

# Sidebar layout for controls and sliders
st.sidebar.header("🎛️ Essential Sound Controls")

sensitivity = st.sidebar.slider(
    "Sensitivity (Threshold dB)",
    min_value=-50,
    max_value=-10,
    value=-30,
    step=1,
    help="Dialogue volume threshold. If dialogue exceeds this, music volume decreases."
)

duck_amount = st.sidebar.slider(
    "Duck Amount (Reduction dB)",
    min_value=-30,
    max_value=-5,
    value=-18,
    step=1,
    help="How much the music volume will be lowered when dialogue is detected."
)

fade_time = st.sidebar.slider(
    "Fade Time (ms)",
    min_value=100,
    max_value=2000,
    value=800,
    step=50,
    help="How quickly the music fades out when dialogue starts, and fades in when dialogue ends."
)

# Main Workspace
col1, col2 = st.columns(2)

with col1:
    st.subheader("1. Dialogue / Voiceover Track (Target)")
    dialogue_file = st.file_uploader(
        "Upload Speech (WAV or MP3)", 
        type=["wav", "mp3"], 
        key="dialogue"
    )

with col2:
    st.subheader("2. Background Music Track (To Duck)")
    music_file = st.file_uploader(
        "Upload Music (WAV or MP3)", 
        type=["wav", "mp3"], 
        key="music"
    )

def pydub_auto_duck(dialogue_track, music_track, sensitivity_db, duck_amount_db, fade_time_ms):
    # Standardize sample rate and channels to match dialogue settings
    sample_rate = dialogue_track.frame_rate
    channels = dialogue_track.channels
    
    dialogue = dialogue_track.set_frame_rate(sample_rate).set_channels(channels)
    music = music_track.set_frame_rate(sample_rate).set_channels(channels)
    
    dialogue_duration_ms = len(dialogue)
    music_duration_ms = len(music)
    
    # 1. Conform music length to match speech duration
    if music_duration_ms < dialogue_duration_ms:
        # Loop music if it is shorter
        loops = int(np.ceil(dialogue_duration_ms / music_duration_ms))
        music = (music * loops)[:dialogue_duration_ms]
    else:
        # Trim music if it is longer and apply a smooth fade at the end of dialogue
        music = music[:dialogue_duration_ms]
        music = music.fade_out(min(1200, dialogue_duration_ms))
        
    # 2. Analyze dialogue in 50ms chunks
    chunk_ms = 50
    total_chunks = dialogue_duration_ms // chunk_ms
    is_active = []
    
    for i in range(total_chunks):
        start_ms = i * chunk_ms
        end_ms = min((i + 1) * chunk_ms, dialogue_duration_ms)
        chunk = dialogue[start_ms:end_ms]
        
        # dbfs is Pydub's native dB volume calculation relative to full scale
        dbfs = chunk.dbfs
        is_active.append(dbfs > sensitivity_db)
        
    # Standard hold hysteresis window (approx 150ms / 3 chunks) to avoid rapid fluttering
    holds = 3
    active_with_hold = []
    hold_rem = 0
    
    for val in is_active:
        if val:
            active_with_hold.append(True)
            hold_rem = holds
        else:
            if hold_rem > 0:
                active_with_hold.append(True)
                hold_rem -= 1
            else:
                active_with_hold.append(False)
                
    # 3. Formulate the Duck gain transitions
    duck_gain = 10 ** (duck_amount_db / 20.0)
    ducked_music_chunks = []
    
    # Ramping step size per chunk
    current_gain = 1.0
    fade_step = (1.0 - duck_gain) * (chunk_ms / max(chunk_ms, fade_time_ms))
    
    for i, active in enumerate(active_with_hold):
        start_ms = i * chunk_ms
        end_ms = min((i + 1) * chunk_ms, dialogue_duration_ms)
        music_chunk = music[start_ms:end_ms]
        
        target_gain = duck_gain if active else 1.0
        
        # Smooth gain updates
        if current_gain < target_gain:
            new_gain = min(target_gain, current_gain + fade_step)
        elif current_gain > target_gain:
            new_gain = max(target_gain, current_gain - fade_step)
        else:
            new_gain = current_gain
            
        # Convert average chunk linear multiplier to decibel gain
        avg_gain = (current_gain + new_gain) / 2.0
        gain_db = 20 * np.log10(avg_gain) if avg_gain > 0 else -100.0
        
        ducked_music_chunks.append(music_chunk + gain_db)
        current_gain = new_gain
        
    # Assemble chunks together
    ducked_music = sum(ducked_music_chunks, AudioSegment.empty())
    
    # Pad remainders
    if len(ducked_music) < dialogue_duration_ms:
        remaining_music = music[len(ducked_music):dialogue_duration_ms]
        rem_gain_db = 20 * np.log10(current_gain) if current_gain > 0 else -100.0
        ducked_music += remaining_music + rem_gain_db
        
    # 4. Superimpose dialogue and output
    final_mix = dialogue.overlay(ducked_music)
    return final_mix

# Trigger Audio Processing
if dialogue_file is not None and music_file is not None:
    st.info("🔄 Audio tracks loaded. Click 'Process and Render Mix' below to begin!")
    
    if st.button("🚀 Process and Render Mix", type="primary"):
        with st.spinner("Processing audio signals... Please wait..."):
            try:
                # Load assets into AudioSegment
                dial_bytes = dialogue_file.read()
                mus_bytes = music_file.read()
                
                dial_seg = AudioSegment.from_file(io.BytesIO(dial_bytes))
                mus_seg = AudioSegment.from_file(io.BytesIO(mus_bytes))
                
                # Execute Ducking process
                output_mix = pydub_auto_duck(
                    dial_seg, 
                    mus_seg, 
                    sensitivity, 
                    duck_amount, 
                    fade_time
                )
                
                st.success("✅ Mix Rendered Successfully!")
                
                # Audio players
                st.markdown("### 🎧 Listen to Final Output Mix")
                out_buffer = io.BytesIO()
                # Export to WAV as standard uncompressed studio output
                output_mix.export(out_buffer, format="wav")
                st.audio(out_buffer.getvalue(), format="audio/wav")
                
                # Download Button
                st.download_button(
                    label="📥 Download Studio WAV Mix",
                    data=out_buffer.getvalue(),
                    file_name="automatic_ducked_mix.wav",
                    mime="audio/wav"
                )
                
            except Exception as e:
                st.error(f"Error during rendering: {str(e)}")
                st.warning("Note: Make sure FFmpeg is installed on your operating system for Pydub to correctly process complex formats.")
else:
    st.warning("Please upload both a Dialogue track and Background Music track to initialize processing.")
`;

export const PythonScriptPanel: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([PYTHON_CODE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'auto_ducking.py';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#101319] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Panel Header */}
      <div className="border-b border-slate-800 bg-[#161a24] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg text-slate-100">Python Script (Streamlit + Pydub)</h3>
            <p className="text-xs text-slate-400">Offline deployment script mirroring Essential Sound Panel algorithms</p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                Copy Script
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Download .py File
          </button>
        </div>
      </div>

      {/* Warning Alert about FFmpeg */}
      <div className="mx-6 mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300 leading-relaxed">
          <span className="font-bold text-amber-400">Pydub Tooling Requirement:</span> This script requires <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-300">ffmpeg</code> and <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-300">ffprobe</code> to be installed on your host system to decode standard compressed formats (such as MP3). Streamlit serves as the lightweight local server and UI.
        </div>
      </div>

      {/* Installation terminal instructions */}
      <div className="mx-6 mt-4 bg-black/40 border border-slate-900 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-semibold text-slate-300">Local Setup & Warmup</span>
        </div>
        <p className="text-xs text-slate-400 mb-2">Run these command utilities in your terminal to install prerequisites:</p>
        <pre className="font-mono text-xs text-slate-200 bg-slate-950/80 p-3 rounded overflow-x-auto border border-slate-800">
          <div><span className="text-emerald-500"># 1. Install pip library requirements</span></div>
          <div>pip install streamlit pydub numpy</div>
          <div className="mt-2.5"><span className="text-emerald-500"># 2. Install FFmpeg (System Package)</span></div>
          <div><span className="text-slate-400"># macOS:</span> brew install ffmpeg</div>
          <div><span className="text-slate-400"># Windows:</span> scoop install ffmpeg <span className="text-slate-500">or download from ffmpeg.org</span></div>
          <div><span className="text-slate-400"># Ubuntu/Debian:</span> sudo apt-get update && sudo apt-get install -y ffmpeg</div>
          <div className="mt-2.5"><span className="text-emerald-500"># 3. Fire up Streamlit local live studio</span></div>
          <div>streamlit run auto_ducking.py</div>
        </pre>
      </div>

      {/* Code Text Window */}
      <div className="m-6 p-1 bg-slate-950 rounded-lg border border-slate-800">
        <div className="px-4 py-2 bg-slate-900 text-slate-400 text-xs flex justify-between items-center rounded-t border-b border-slate-800 font-mono">
          <span>auto_ducking.py</span>
          <span className="text-slate-500">Python 3.8+ | Streamlit</span>
        </div>
        <pre className="font-mono text-xs text-slate-300 p-5 overflow-auto max-h-[480px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
          <code>{PYTHON_CODE}</code>
        </pre>
      </div>
    </div>
  );
};
