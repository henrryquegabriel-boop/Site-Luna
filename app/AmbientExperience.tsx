"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const glitterDrops = Array.from({ length: 42 }, (_, index) => ({
  delay: `${-((index * 1.37) % 15).toFixed(2)}s`,
  drift: `${((index * 23) % 90) - 45}px`,
  duration: `${10 + ((index * 7) % 8)}s`,
  left: `${(index * 37 + 9) % 101}%`,
  opacity: `${0.28 + ((index * 11) % 36) / 100}`,
  size: `${0.34 + ((index * 13) % 48) / 100}rem`,
  symbol: index % 5 === 0 ? "✦" : index % 3 === 0 ? "·" : "✧",
}));

const YOUTUBE_VIDEO_ID = "inQG5wTW20o";
const CHORUS_START_SECONDS = 48;
const CHORUS_END_SECONDS = 85;
const YOUTUBE_PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
const YOUTUBE_PLAYER_SRC =
  `${YOUTUBE_PLAYER_ORIGIN}/embed/${YOUTUBE_VIDEO_ID}` +
  `?autoplay=1&controls=0&disablekb=1&end=${CHORUS_END_SECONDS}` +
  `&enablejsapi=1&fs=0&loop=1&modestbranding=1&playlist=${YOUTUBE_VIDEO_ID}` +
  `&playsinline=1&rel=0&start=${CHORUS_START_SECONDS}`;

type YouTubeCommand = "pauseVideo" | "playVideo" | "seekTo" | "setVolume" | "unMute";

export function AmbientExperience() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playerReadyRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const bootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendPlayerCommand = useCallback((command: YouTubeCommand, args: Array<boolean | number> = []) => {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args }),
      YOUTUBE_PLAYER_ORIGIN,
    );
  }, []);

  const playChorus = useCallback(({ restart = false, unmute = false } = {}) => {
    if (!playerReadyRef.current) return;
    if (restart) sendPlayerCommand("seekTo", [CHORUS_START_SECONDS, true]);
    sendPlayerCommand("setVolume", [38]);
    if (unmute) sendPlayerCommand("unMute");
    sendPlayerCommand("playVideo");
  }, [sendPlayerCommand]);

  function handlePlayerLoad() {
    playerReadyRef.current = true;
    if (!soundEnabledRef.current) return;

    if (bootTimerRef.current) clearTimeout(bootTimerRef.current);
    bootTimerRef.current = setTimeout(() => playChorus(), 500);
  }

  function toggleSound() {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      sendPlayerCommand("pauseVideo");
      setSoundEnabled(false);
      return;
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);
    playChorus({ restart: true, unmute: true });
  }

  useEffect(() => {
    const unlockAutomaticSound = () => {
      if (!soundEnabledRef.current) return;
      playChorus({ unmute: true });
    };

    window.addEventListener("pointerdown", unlockAutomaticSound, { once: true });
    window.addEventListener("keydown", unlockAutomaticSound, { once: true });
    window.addEventListener("touchstart", unlockAutomaticSound, { once: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAutomaticSound);
      window.removeEventListener("keydown", unlockAutomaticSound);
      window.removeEventListener("touchstart", unlockAutomaticSound);
      if (bootTimerRef.current) clearTimeout(bootTimerRef.current);
      bootTimerRef.current = null;
      playerReadyRef.current = false;
    };
  }, [playChorus]);

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
      <iframe
        allow="autoplay; encrypted-media"
        aria-hidden="true"
        className="soundtrack-player"
        loading="eager"
        onLoad={handlePlayerLoad}
        ref={playerRef}
        src={YOUTUBE_PLAYER_SRC}
        tabIndex={-1}
        title="Floresça — Claudia Canção e Dibs Aquino (refrão)"
      />
      <button
        aria-label={soundEnabled ? "Pausar o refrão de Floresça" : "Ouvir o refrão de Floresça"}
        aria-pressed={soundEnabled}
        className="sound-control"
        onClick={toggleSound}
        type="button"
      >
        <span className="sound-control-icon" aria-hidden="true">
          {soundEnabled ? "♫" : "♪"}
        </span>
        <span>{soundEnabled ? "Floresça · refrão" : "Ouvir Floresça"}</span>
      </button>
    </>
  );
}
