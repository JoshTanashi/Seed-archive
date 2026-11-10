import { Howl, Howler } from 'howler';
import { publicUrl } from '../lib/assets';

export type Channel = 'sfx' | 'ambience' | 'voice';
export type Sfx = 'tap' | 'dialogue-blip' | 'page-flip' | 'spell' | 'seed-found';

const VOLUME = { voice: 1.0, sfx: 0.6, ambience: 0.5, ambienceDucked: 0.2 };
const DUCK_MS = 300;
const AMBIENCE_FADE_MS = 1500;

/**
 * The one audio manager. Three channels, each with its own on/off switch.
 * Nothing plays until unlock() has been called from a user gesture (iOS).
 */
class AudioManager {
  private enabled: Record<Channel, boolean> = { sfx: true, ambience: true, voice: true };
  private unlocked = false;
  private sfxCache = new Map<Sfx, Howl>();
  private ambience: Howl | null = null;
  private ambienceWanted = false;
  private ambienceId: number | undefined;
  private voice: Howl | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  private backgrounded = false;

  /** Call from the first tap. Safe to call again. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setEnabled(channel: Channel, on: boolean): void {
    this.enabled[channel] = on;
    if (channel === 'ambience') {
      if (on && this.ambienceWanted) this.startAmbience();
      else if (!on) this.fadeOutAmbience();
    }
    if (channel === 'voice' && !on) this.stopVoice();
  }

  // ---- sfx ----
  sfx(name: Sfx): void {
    if (!this.unlocked || !this.enabled.sfx) return;
    let howl = this.sfxCache.get(name);
    if (!howl) {
      howl = new Howl({ src: [publicUrl(`audio/sfx/${name}.mp3`)], volume: VOLUME.sfx });
      this.sfxCache.set(name, howl);
    }
    howl.play();
  }

  // ---- ambience ----
  startAmbience(fadeMs = AMBIENCE_FADE_MS): void {
    this.ambienceWanted = true;
    if (!this.unlocked || !this.enabled.ambience || this.backgrounded) return;
    if (!this.ambience) {
      this.ambience = new Howl({
        src: [publicUrl('audio/sfx/ambience-forest-loop.mp3')],
        loop: true,
        volume: 0,
      });
    }
    const target = this.voice ? VOLUME.ambienceDucked : VOLUME.ambience;
    if (this.ambienceId === undefined) {
      this.ambienceId = this.ambience.play();
    } else if (!this.ambience.playing(this.ambienceId)) {
      this.ambience.play(this.ambienceId);
    }
    this.ambience.fade(this.ambience.volume(this.ambienceId) as number, target, fadeMs, this.ambienceId);
  }

  private fadeOutAmbience(): void {
    const amb = this.ambience;
    const id = this.ambienceId;
    if (!amb || id === undefined || !amb.playing(id)) return;
    amb.fade(amb.volume(id) as number, 0, AMBIENCE_FADE_MS, id);
    window.setTimeout(() => {
      if (!this.enabled.ambience || this.backgrounded) amb.pause(id);
    }, AMBIENCE_FADE_MS + 50);
  }

  private duck(down: boolean): void {
    const amb = this.ambience;
    const id = this.ambienceId;
    if (!amb || id === undefined || !amb.playing(id) || !this.enabled.ambience) return;
    amb.fade(amb.volume(id) as number, down ? VOLUME.ambienceDucked : VOLUME.ambience, DUCK_MS, id);
  }

  /** App went to the background / came back (Capacitor App pause / resume). */
  setBackgrounded(bg: boolean): void {
    this.backgrounded = bg;
    if (bg) {
      this.stopVoice();
      if (this.ambience && this.ambienceId !== undefined) this.ambience.pause(this.ambienceId);
    } else if (this.ambienceWanted) {
      this.startAmbience();
    }
  }

  // ---- voice ----
  /**
   * Plays a voice clip. Returns false straight away when the voice channel is
   * off (the caller then shows the line as a text-only bubble).
   */
  playVoice(file: string, onEnd?: () => void): boolean {
    this.stopVoice();
    if (!this.unlocked || !this.enabled.voice) return false;
    const howl = new Howl({ src: [publicUrl(file)], volume: VOLUME.voice });
    this.voice = howl;
    const finish = () => {
      if (this.voice !== howl) return;
      this.voice = null;
      this.duck(false);
      onEnd?.();
    };
    howl.once('play', () => {
      this.connectAnalyser(howl);
      this.duck(true);
    });
    howl.once('end', finish);
    howl.once('loaderror', finish);
    howl.once('playerror', finish);
    howl.play();
    return true;
  }

  stopVoice(): void {
    const howl = this.voice;
    if (!howl) return;
    this.voice = null;
    howl.stop();
    howl.unload();
    this.duck(false);
  }

  isVoicePlaying(): boolean {
    return !!this.voice;
  }

  private connectAnalyser(howl: Howl): void {
    const ctx = Howler.ctx;
    if (!ctx) return;
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.samples = new Float32Array(this.analyser.fftSize);
    }
    // In Web Audio mode each Howler sound owns a GainNode; tap it.
    const sounds = (howl as unknown as { _sounds: { _node?: AudioNode }[] })._sounds;
    for (const s of sounds) {
      try {
        if (s._node && typeof s._node.connect === 'function') s._node.connect(this.analyser);
      } catch {
        /* HTML5 audio fallback: no analyser, the mouth uses the fake flap */
      }
    }
  }

  /** Loudness (RMS, 0..1) of the voice clip playing right now. */
  getVoiceLevel(): number {
    if (!this.voice || !this.analyser || !this.samples) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) sum += this.samples[i] * this.samples[i];
    return Math.sqrt(sum / this.samples.length);
  }
}

export const audio = new AudioManager();
