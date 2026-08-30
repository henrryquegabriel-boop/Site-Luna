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

const gateStars = Array.from({ length: 34 }, (_, index) => ({
  delay: `${-((index * 0.83) % 12).toFixed(2)}s`,
  drift: `${((index * 19) % 76) - 38}px`,
  duration: `${7 + ((index * 5) % 7)}s`,
  left: `${(index * 31 + 7) % 100}%`,
  opacity: `${0.24 + ((index * 13) % 42) / 100}`,
  size: `${0.38 + ((index * 11) % 42) / 100}rem`,
  symbol: index % 4 === 0 ? "✦" : index % 3 === 0 ? "✧" : "·",
}));

const YOUTUBE_VIDEO_ID = "inQG5wTW20o";
const CHORUS_START_SECONDS = 48;
const CHORUS_END_SECONDS = 85;
const YOUTUBE_PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
const YOUTUBE_PLAYER_SRC =
  `${YOUTUBE_PLAYER_ORIGIN}/embed/${YOUTUBE_VIDEO_ID}` +
  `?autoplay=0&controls=0&disablekb=1&end=${CHORUS_END_SECONDS}` +
  `&enablejsapi=1&fs=0&loop=1&modestbranding=1&playlist=${YOUTUBE_VIDEO_ID}` +
  `&playsinline=1&rel=0&start=${CHORUS_START_SECONDS}`;

type YouTubeCommand = "pauseVideo" | "playVideo" | "seekTo" | "setVolume" | "unMute";

export function AmbientExperience() {
  const [gateOpening, setGateOpening] = useState(false);
  const [gateVisible, setGateVisible] = useState(true);
  const [playerPrepared, setPlayerPrepared] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playerReadyRef = useRef(false);
  const soundEnabledRef = useRef(false);
  const bootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (bootTimerRef.current) clearTimeout(bootTimerRef.current);
    bootTimerRef.current = null;
    setPlayerPrepared(true);
  }

  function openInvitation() {
    if (!playerPrepared || gateOpening) return;

    soundEnabledRef.current = true;
    setSoundEnabled(true);
    playChorus({ restart: true, unmute: true });
    setGateOpening(true);
    document.documentElement.classList.remove("invitation-locked");
    gateTimerRef.current = setTimeout(() => setGateVisible(false), 680);
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
    document.documentElement.classList.add("invitation-locked");
    bootTimerRef.current = setTimeout(() => {
      playerReadyRef.current = true;
      setPlayerPrepared(true);
    }, 900);

    return () => {
      document.documentElement.classList.remove("invitation-locked");
      if (bootTimerRef.current) clearTimeout(bootTimerRef.current);
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
      bootTimerRef.current = null;
      gateTimerRef.current = null;
      playerReadyRef.current = false;
    };
  }, []);

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
      {gateVisible ? (
        <div
          aria-labelledby="invitation-gate-title"
          aria-modal="true"
          className={`invitation-gate${gateOpening ? " is-opening" : ""}`}
          role="dialog"
        >
          <div className="invitation-gate-stars" aria-hidden="true">
            {gateStars.map((star, index) => (
              <span
                className="invitation-gate-falling-star"
                key={index}
                style={{
                  "--gate-star-delay": star.delay,
                  "--gate-star-drift": star.drift,
                  "--gate-star-duration": star.duration,
                  "--gate-star-left": star.left,
                  "--gate-star-opacity": star.opacity,
                  "--gate-star-size": star.size,
                } as CSSProperties}
              >
                {star.symbol}
              </span>
            ))}
          </div>
          <div className="invitation-gate-card">
            <div className="invitation-gate-celestial" aria-hidden="true">
              <span className="invitation-gate-orbit invitation-gate-orbit-one" />
              <span className="invitation-gate-orbit invitation-gate-orbit-two" />
              <span className="invitation-gate-moon">☾</span>
              <span className="invitation-gate-star invitation-gate-star-one">✦</span>
              <span className="invitation-gate-star invitation-gate-star-two">✧</span>
              <span className="invitation-gate-star invitation-gate-star-three">✦</span>
            </div>
            <p className="invitation-gate-eyebrow">Um convite muito especial</p>
            <h2 id="invitation-gate-title">E Deus criou Luna!</h2>
            <button
              aria-busy={!playerPrepared}
              className="invitation-gate-button"
              disabled={!playerPrepared}
              onClick={openInvitation}
              type="button"
            >
              {playerPrepared ? (
                <span>Abrir convite</span>
              ) : (
                <span>Preparando o convite…</span>
              )}
            </button>
            <small>Com carinho, família da Luna</small>
          </div>
        </div>
      ) : null}
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
