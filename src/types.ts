export interface DuckingParams {
  sensitivityDB: number;  // -50 to -10, default -30
  duckAmountDB: number;   // -5 to -30, default -18
  fadeTimeMs: number;     // 100 to 2000, default 800
}

export interface TrackState {
  name: string;
  duration: number;
  size: number;
  buffer: AudioBuffer | null;
  peaks: number[];
}

export type PlayMode = 'mix' | 'dialogue' | 'music';

export interface TimelineState {
  isPlaying: boolean;
  currentTime: number;
  playMode: PlayMode;
  dialogueVolume: number; // 0 to 1
  musicVolume: number;    // 0 to 1
}
