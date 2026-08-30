"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const glitterDrops = Array.from({ length: 42 }, (_, index) => ({
  delay: `${-((index * 1.37) % 15).toFixed(2)}s`,
  drift: `${((index * 23) % 90) - 45}px`,
  duration: `${10 + ((index * 7) % 8)}s`,
  left: `${(index * 37 + 9) % 101}%`,
  opacity: `${0.28 + ((index * 11) % 36) / 100}`,
  size: `${0.34 + ((index * 13) % 48) / 100}rem`,
  symbol: index % 5 === 0 ? "✦" : index % 3 === 0 ? "·" : "✧",
}));

const melody = [
  [392, 0, 1.5],
  [440, 1.55, 1.3],
  [523.25, 3, 1.8],
  [493.88, 4.9, 1.2],
  [440, 6.25, 1.7],
  [392, 8.05, 2.1],
] as const;

function scheduleFluteNote(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
) {
  const envelope = context.createGain();
  const mainTone = context.createOscillator();
  const airyTone = context.createOscillator();
  const vibrato = context.createOscillator();
  const vibratoDepth = context.createGain();

  mainTone.type = "sine";
  mainTone.frequency.setValueAtTime(frequency, start);
  airyTone.type = "triangle";
  airyTone.frequency.setValueAtTime(frequency * 2, start);
  airyTone.detune.setValueAtTime(5, start);
  vibrato.type = "sine";
  vibrato.frequency.setValueAtTime(5.1, start);
  vibratoDepth.gain.setValueAtTime(2.2, start);

  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(mainTone.frequency);
  mainTone.connect(envelope);
  airyTone.connect(envelope);
  envelope.connect(destination);

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(0.027, start + 0.24);
  envelope.gain.setValueAtTime(0.027, start + Math.max(0.3, duration - 0.38));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  mainTone.start(start);
  airyTone.start(start);
  vibrato.start(start);
  mainTone.stop(start + duration + 0.05);
  airyTone.stop(start + duration + 0.05);
  vibrato.stop(start + duration + 0.05);
}

export function AmbientExperience() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopSound() {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setSoundEnabled(false);
  }

  async function startSound() {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const filter = context.createBiquadFilter();
    const master = context.createGain();

    filter.type = "lowpass";
    filter.frequency.value = 2400;
    filter.Q.value = 0.7;
    master.gain.value = 0.72;
    filter.connect(master);
    master.connect(context.destination);

    const playMelody = () => {
      const start = context.currentTime + 0.12;
      melody.forEach(([frequency, offset, duration]) => {
        scheduleFluteNote(context, filter, frequency, start + offset, duration);
      });
    };

    audioContextRef.current = context;
    await context.resume();
    playMelody();
    loopRef.current = setInterval(playMelody, 12_500);
    setSoundEnabled(true);
  }

  function toggleSound() {
    if (soundEnabled) {
      stopSound();
      return;
    }
    void startSound();
  }

  useEffect(() => stopSound, []);

  return (
    <>
      <div className="glitter-rain" aria-hidden="true">
        {glitterDrops.map((drop, index) => (
          <span
            className="glitter-drop"
            key={index}
            style={{
              "--glitter-delay": drop.delay,
              "--glitter-drift": drop.drift,
              "--glitter-duration": drop.duration,
              "--glitter-left": drop.left,
              "--glitter-opacity": drop.opacity,
              "--glitter-size": drop.size,
            } as CSSProperties}
          >
            {drop.symbol}
          </span>
        ))}
      </div>
      <button
        aria-label={soundEnabled ? "Pausar trilha suave" : "Ativar trilha suave"}
        aria-pressed={soundEnabled}
        className="sound-control"
        onClick={toggleSound}
        type="button"
      >
        <span className="sound-control-icon" aria-hidden="true">
          {soundEnabled ? "♫" : "♪"}
        </span>
        <span>{soundEnabled ? "Trilha suave ativada" : "Ouvir trilha suave"}</span>
      </button>
    </>
  );
}
