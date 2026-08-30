"use client";

import { useEffect, useRef, useState } from "react";

const EVENT_DATE = new Date("2026-10-03T17:00:00-03:00");
const AOS_SCRIPT_ID = "aos-cdn-script";
const AOS_SCRIPT_SRC = "https://unpkg.com/aos@2.3.4/dist/aos.js";

type AOSApi = {
  init: (options?: Record<string, boolean | number | string>) => void;
  refreshHard: () => void;
};

declare global {
  interface Window {
    AOS?: AOSApi;
  }
}

function getTimeLeft() {
  const distance = Math.max(0, EVENT_DATE.getTime() - Date.now());

  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance / 3_600_000) % 24),
    minutes: Math.floor((distance / 60_000) % 60),
  };
}

export function SiteExperience() {
  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) return;

    const initializeAOS = () => {
      if (!window.AOS) return;

      if (root.dataset.aosInitialized !== "true") {
        window.AOS.init({
          duration: 850,
          easing: "ease-out-cubic",
          offset: 72,
          once: true,
        });
        root.dataset.aosInitialized = "true";
      }

      root.classList.add("aos-ready");
      window.AOS.refreshHard();
    };

    if (window.AOS) {
      initializeAOS();
      return;
    }

    const existingScript = document.getElementById(AOS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    if (!existingScript) {
      script.id = AOS_SCRIPT_ID;
      script.src = AOS_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener("load", initializeAOS, { once: true });

    return () => script.removeEventListener("load", initializeAOS);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("motion-ready");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("is-revealed"));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -9%", threshold: 0.14 },
      );

      revealElements.forEach((element) => revealObserver.observe(element));

      return () => revealObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    let frame = 0;

    const updatePageState = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
        progressRef.current?.style.setProperty("--page-progress", `${progress}`);
        headerRef.current?.classList.toggle("is-scrolled", window.scrollY > 28);
      });
    };

    updatePageState();
    window.addEventListener("scroll", updatePageState, { passive: true });
    window.addEventListener("resize", updatePageState);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updatePageState);
      window.removeEventListener("resize", updatePageState);
    };
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const celestialFields = Array.from(
      document.querySelectorAll<HTMLElement>("[data-celestial-motion]"),
    );

    if (reduceMotion.matches || celestialFields.length === 0) return;

    let animationFrame = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetScroll = window.scrollY;
    let smoothScroll = targetScroll;

    const updatePointer = (event: PointerEvent) => {
      targetPointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetPointerY = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    const resetPointer = () => {
      targetPointerX = 0;
      targetPointerY = 0;
    };

    const updateScroll = () => {
      targetScroll = window.scrollY;
    };

    const animateCelestialFields = (time: number) => {
      pointerX += (targetPointerX - pointerX) * 0.045;
      pointerY += (targetPointerY - pointerY) * 0.045;
      smoothScroll += (targetScroll - smoothScroll) * 0.06;

      celestialFields.forEach((field, index) => {
        const depth = Number(field.dataset.celestialDepth ?? 1);
        const phase = Number(field.dataset.celestialPhase ?? index * 0.8);
        const direction = index % 2 === 0 ? 1 : -1;
        const scrollWave = Math.sin(smoothScroll * 0.0025 + phase);
        const x = (pointerX * 12 + Math.sin(time / 3100 + phase) * 3.4 * direction + scrollWave * 2) * depth;
        const y = (pointerY * 9 + Math.cos(time / 3700 + phase) * 3.8 + scrollWave * 2.4) * depth;
        const rotation = (pointerX * 0.4 + Math.sin(time / 5200 + phase) * 0.45) * depth;

        field.style.setProperty("--celestial-x", `${x.toFixed(2)}px`);
        field.style.setProperty("--celestial-y", `${y.toFixed(2)}px`);
        field.style.setProperty("--celestial-rotate", `${rotation.toFixed(3)}deg`);
      });

      animationFrame = requestAnimationFrame(animateCelestialFields);
    };

    const startAnimation = () => {
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(animateCelestialFields);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else {
        startAnimation();
      }
    };

    if (finePointer.matches) {
      window.addEventListener("pointermove", updatePointer, { passive: true });
      window.addEventListener("pointerleave", resetPointer);
      window.addEventListener("blur", resetPointer);
    }
    window.addEventListener("scroll", updateScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    startAnimation();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("scroll", updateScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      celestialFields.forEach((field) => {
        field.style.removeProperty("--celestial-x");
        field.style.removeProperty("--celestial-y");
        field.style.removeProperty("--celestial-rotate");
      });
    };
  }, []);

  return (
    <>
      <div className="page-progress" ref={progressRef} aria-hidden="true" />
      <header className="site-header" ref={headerRef}>
        <a className="site-brand" href="#inicio" aria-label="Voltar ao início">
          <span aria-hidden="true">✦</span>
          <strong>Luna faz um</strong>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#historia">O convite</a>
          <a href="#detalhes">Detalhes</a>
          <a href="#presentes">Presentes</a>
          <a className="nav-rsvp" href="#confirmar">Confirmar</a>
        </nav>
      </header>
    </>
  );
}

export function CelebrationCountdown() {
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft> | null>(null);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setTimeLeft(getTimeLeft()), 0);
    const timer = window.setInterval(() => setTimeLeft(getTimeLeft()), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  const parts = [
    [timeLeft?.days, "dias"],
    [timeLeft?.hours, "horas"],
    [timeLeft?.minutes, "minutos"],
  ] as const;

  return (
    <div className="countdown" aria-label="Contagem regressiva para a festa">
      {parts.map(([value, label]) => (
        <span className="countdown-part" key={label}>
          <strong>{value == null ? "--" : String(value).padStart(2, "0")}</strong>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}
