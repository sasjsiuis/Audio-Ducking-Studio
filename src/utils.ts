import { DuckingParams } from './types';

/**
 * Extracts a compact peak array from an AudioBuffer to draw waveforms
 */
export function getWaveformPeaks(buffer: AudioBuffer, points: number = 400): number[] {
  const data = buffer.getChannelData(0); // Peak analyze first channel
  const step = Math.floor(data.length / points);
  const peaks: number[] = [];

  for (let i = 0; i < points; i++) {
    const start = i * step;
    const end = Math.min(start + step, data.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(data[j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }
  return peaks;
}

/**
 * Dynamic Voice Synthesizer to simulate dialogue track for testing
 */
export function generateDemoDialogue(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration = 12; // 12 seconds
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // We synthesize rhythmic blocks of "speech" with amplitude fluctuations
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    let isSpeaking = false;
    let amp = 0;

    // Block 1: 1.0s to 3.5s (Speech)
    if (t >= 1.0 && t <= 3.5) {
      isSpeaking = true;
      // Speech pitch base = 160Hz modulating with standard syllables (approx 6Hz modulation)
      amp = 0.28 * Math.sin(2 * Math.PI * 160 * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 5.5 * t));
    }
    // Block 2: 5.0s to 7.2s (Speech)
    else if (t >= 5.0 && t <= 7.2) {
      isSpeaking = true;
      amp = 0.32 * Math.sin(2 * Math.PI * 180 * t) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 6.5 * t));
    }
    // Block 3: 8.5s to 11.0s (Speech)
    else if (t >= 8.5 && t <= 11.0) {
      isSpeaking = true;
      amp = 0.25 * Math.sin(2 * Math.PI * 145 * t) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 4.8 * t));
    }

    if (isSpeaking) {
      // Add first vocal formant/harmonic for weight
      amp += 0.1 * Math.sin(2 * Math.PI * 320 * t + 0.8);
      // Fricative/breathy noise
      amp += 0.02 * (Math.random() - 0.5);
    } else {
      // Ambient room low floor
      amp = 0.001 * (Math.random() - 0.5);
    }

    data[i] = amp;
  }
  return buffer;
}

/**
 * Dynamic Pad Synthesizer to simulate rich ambient music track for testing
 */
export function generateDemoMusic(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration = 12; // 12 seconds
  const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
  const dataL = buffer.getChannelData(0);
  const dataR = buffer.getChannelData(1);

  // We synthesize a wide stereo ambient pad (Major 7th chord chord stack: C, E, G, B)
  const fLow = 130.81; // C3
  const fMid = 164.81; // E3
  const fHigh = 196.00; // G3
  const fTop = 246.94; // B3

  for (let i = 0; i < dataL.length; i++) {
    const t = i / sampleRate;

    // Harmonic sum
    const vC = 0.15 * Math.sin(2 * Math.PI * fLow * t);
    const vE = 0.12 * Math.sin(2 * Math.PI * fMid * t + 0.5);
    const vG = 0.12 * Math.sin(2 * Math.PI * fHigh * t + 1.2);
    const vB = 0.08 * Math.sin(2 * Math.PI * fTop * t + 2.0);

    const mix = (vC + vE + vG + vB) * 0.28;

    // Slower LFO modulation to simulate filter sweep (evolving pad)
    const lfoSpeedL = 0.25 * Math.sin(2 * Math.PI * 0.1 * t);
    const lfoSpeedR = 0.31 * Math.sin(2 * Math.PI * 0.12 * t);

    dataL[i] = mix * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t + lfoSpeedL));
    dataR[i] = mix * (0.7 + 0.3 * Math.cos(2 * Math.PI * 0.4 * t + lfoSpeedR));
  }
  return buffer;
}

/**
 * Accurate Digital Ducking Signal Processing Engine
 */
export function computeClientAudioDucking(
  dialogueBuffer: AudioBuffer,
  musicBuffer: AudioBuffer,
  params: DuckingParams
): { mixedBuffer: AudioBuffer; isDuckingActive: Uint8Array; gainEnvelope: Float32Array; chunkMs: number } {
  const { sensitivityDB, duckAmountDB, fadeTimeMs } = params;
  const sampleRate = dialogueBuffer.sampleRate;
  const numChannels = 2; // Output forced to Stereo

  const duration = dialogueBuffer.duration;
  const outputLength = Math.floor(sampleRate * duration);

  const dialogueL = dialogueBuffer.getChannelData(0);
  const dialogueR = dialogueBuffer.numberOfChannels > 1 ? dialogueBuffer.getChannelData(1) : dialogueL;

  const musicL = musicBuffer.getChannelData(0);
  const musicR = musicBuffer.numberOfChannels > 1 ? musicBuffer.getChannelData(1) : musicL;
  const musicLength = musicBuffer.length;

  // Allocate destination structures
  const outDialogueL = new Float32Array(outputLength);
  const outDialogueR = new Float32Array(outputLength);
  const outMusicL = new Float32Array(outputLength);
  const outMusicR = new Float32Array(outputLength);

  // Copy dialogue to destination
  outDialogueL.set(dialogueL.subarray(0, Math.min(dialogueL.length, outputLength)));
  outDialogueR.set(dialogueR.subarray(0, Math.min(dialogueR.length, outputLength)));

  // Copy music, looping if the track is shorter
  for (let i = 0; i < outputLength; i++) {
    const musicIdx = i % musicLength;
    outMusicL[i] = musicL[musicIdx];
    outMusicR[i] = musicR[musicIdx];
  }

  // Smooth final music fade out at the very end of dialogue track
  const endFadeLen = Math.floor(Math.min(sampleRate * 1.5, outputLength * 0.1)); // trailing 10% or 1.5s
  for (let i = outputLength - endFadeLen; i < outputLength; i++) {
    const ratio = (outputLength - i) / endFadeLen;
    outMusicL[i] *= ratio;
    outMusicR[i] *= ratio;
  }

  // Define Chunk Analysis Parameters
  const chunkMs = 50;
  const chunkSize = Math.floor(sampleRate * (chunkMs / 1000));
  const totalChunks = Math.ceil(outputLength / chunkSize);

  const isDuckingActive = new Uint8Array(totalChunks);

  // Determine active dialogue inside each chunk based on RMS threshold
  for (let t = 0; t < totalChunks; t++) {
    const start = t * chunkSize;
    const end = Math.min((t + 1) * chunkSize, outputLength);

    let sum = 0;
    let count = 0;

    for (let s = start; s < end; s++) {
      const avgDial = (outDialogueL[s] + outDialogueR[s]) / 2.0;
      sum += avgDial * avgDial;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sum / count) : 0;
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    isDuckingActive[t] = db > sensitivityDB ? 1 : 0;
  }

  // Look-ahead / hysteresis smoothing: Prevent short 50ms voice drops by extending active window slightly
  // A standard hold-time of ~150ms (3 chunks) is extremely helpful
  const holdsCount = 3;
  const activeWithHold = new Uint8Array(totalChunks);
  let holdRemaining = 0;

  for (let t = 0; t < totalChunks; t++) {
    if (isDuckingActive[t] === 1) {
      activeWithHold[t] = 1;
      holdRemaining = holdsCount;
    } else {
      if (holdRemaining > 0) {
        activeWithHold[t] = 1;
        holdRemaining--;
      } else {
        activeWithHold[t] = 0;
      }
    }
  }

  // Apply Ducking Level with Linear Ramping (Fade Time)
  const fadeSamples = Math.floor((fadeTimeMs / 1000) * sampleRate);
  const duckGain = Math.pow(10, duckAmountDB / 20.0);

  let currentGain = 1.0;
  // Step added/subtracted per sample
  const fadeStep = fadeSamples > 0 ? (1.0 - duckGain) / fadeSamples : 1.0 - duckGain;

  const gainEnvelope = new Float32Array(outputLength);

  for (let s = 0; s < outputLength; s++) {
    const chunkIdx = Math.floor(s / chunkSize);
    const active = chunkIdx < totalChunks ? activeWithHold[chunkIdx] === 1 : false;
    const targetGain = active ? duckGain : 1.0;

    if (currentGain < targetGain) {
      currentGain += fadeStep;
      if (currentGain > targetGain) currentGain = targetGain;
    } else if (currentGain > targetGain) {
      currentGain -= fadeStep;
      if (currentGain < targetGain) currentGain = targetGain;
    }

    gainEnvelope[s] = currentGain;
    outMusicL[s] *= currentGain;
    outMusicR[s] *= currentGain;
  }

  // Create Mixed Output AudioBuffer
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const mixedBuffer = ctx.createBuffer(numChannels, outputLength, sampleRate);

  const finalL = mixedBuffer.getChannelData(0);
  const finalR = mixedBuffer.getChannelData(1);

  // Mix dialogue and ducked music with safe clipper
  for (let s = 0; s < outputLength; s++) {
    const sampleValL = outDialogueL[s] + outMusicL[s];
    const sampleValR = outDialogueR[s] + outMusicR[s];

    // Hard clipper
    finalL[s] = Math.max(-1, Math.min(1, sampleValL));
    finalR[s] = Math.max(-1, Math.min(1, sampleValR));
  }

  return { mixedBuffer, isDuckingActive: activeWithHold, gainEnvelope, chunkMs };
}

/**
 * Encodes AudioBuffer to 16-bit PCM WAV File Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM Linear
  const bitDepth = 16;

  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  const bufferByteLength = result.length * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferByteLength);
  const view = new DataView(wavBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferByteLength, true); // Size of remaining package
  writeString(view, 8, 'WAVE');

  // Format chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, format, true); // PCM Format ID
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true); // Byte rate
  view.setUint16(32, numOfChan * (bitDepth / 8), true); // Block align
  view.setUint16(34, bitDepth, true);

  // Data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, bufferByteLength, true);

  // Convert floats [-1.0, 1.0] to 16-bit PCM signed integers
  floatTo16BitPCM(view, 44, result);

  return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Inserts silence of delaySeconds at the start of the AudioBuffer
 * to shift/move the clip forward in time.
 */
export function delayAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, delaySeconds: number): AudioBuffer {
  if (delaySeconds <= 0) return buffer;
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const delaySamples = Math.floor(delaySeconds * sampleRate);
  const newLength = buffer.length + delaySamples;
  
  const newBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const oldData = buffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    // Silent padding is 0 by default, let's copy oldData with the offset
    newData.set(oldData, delaySamples);
  }
  return newBuffer;
}

/**
 * Trims the AudioBuffer to keep only the segment between startSeconds and endSeconds
 */
export function trimAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, startSeconds: number, endSeconds: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSeconds * sampleRate));
  
  if (startSample >= endSample) {
    throw new Error('Crop range is empty. Trim start must be less than trim end.');
  }
  
  const newLength = endSample - startSample;
  const newBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const oldData = buffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    newData.set(oldData.subarray(startSample, endSample));
  }
  return newBuffer;
}

/**
 * Repeats and loops the AudioBuffer until it matches targetLengthSeconds
 */
export function loopExtendAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, targetLengthSeconds: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const targetSamples = Math.floor(targetLengthSeconds * sampleRate);
  if (targetSamples <= 0) return buffer;
  
  const newBuffer = ctx.createBuffer(numChannels, targetSamples, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const oldData = buffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    
    let offset = 0;
    while (offset < targetSamples) {
      const remaining = targetSamples - offset;
      if (remaining >= oldData.length) {
        newData.set(oldData, offset);
        offset += oldData.length;
      } else {
        newData.set(oldData.subarray(0, remaining), offset);
        offset += remaining;
      }
    }
  }
  return newBuffer;
}

/**
 * Truncates an AudioBuffer's duration to targetSeconds
 */
export function truncateAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, targetSeconds: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const targetSamples = Math.floor(targetSeconds * sampleRate);
  if (targetSamples >= buffer.length || targetSamples <= 0) return buffer;
  
  const newBuffer = ctx.createBuffer(numChannels, targetSamples, sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const oldData = buffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    newData.set(oldData.subarray(0, targetSamples));
  }
  return newBuffer;
}
