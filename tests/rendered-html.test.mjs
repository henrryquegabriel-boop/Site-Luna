import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production bundle contains the finished Luna invitation", async () => {
  const bundle = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");

  assert.match(bundle, /E Deus criou/);
  assert.match(bundle, /Confirmar presença/);
  assert.match(bundle, /Espaço 45/);
  assert.match(bundle, /Como chegar/);
  assert.match(bundle, /Sugestões de presentes/);
  assert.match(bundle, /Bíblia infantil/);
  assert.match(bundle, /Calçado 21, 22 ou 23/);
  assert.doesNotMatch(bundle, /Building your site|Starter Project|codex-preview/i);
});

test("keeps the invitation self-contained and production-ready", async () => {
  const [page, layout, experience, orbit, ambient, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SiteExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OrbitExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AmbientExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /rainbow-symmetric\.png\?inline/);
  assert.match(page, /baby-luna\.png\?inline/);
  assert.match(page, /https:\/\/maps\.app\.goo\.gl\/ZKapPHJ2PfYyw7B3A/);
  assert.match(page, /<RsvpForm \/>/);
  assert.match(page, /id="presentes"/);
  assert.match(page, /gifts-moon/);
  assert.equal(page.match(/data-aos="fade-up"/g)?.length, 4);
  assert.match(layout, /Confirmação de presença/);
  assert.match(layout, /unpkg\.com\/aos@2\.3\.4\/dist\/aos\.css/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(experience, /IntersectionObserver/);
  assert.match(experience, /prefers-reduced-motion/);
  assert.match(experience, /\[data-celestial-motion\]/);
  assert.match(experience, /requestAnimationFrame/);
  assert.match(experience, /unpkg\.com\/aos@2\.3\.4\/dist\/aos\.js/);
  assert.match(experience, /AOS\.init/);
  assert.match(experience, /\.celestial-orbit, \.gifts-orbit, \.venue-path/);
  assert.match(experience, /js-motion-ready/);
  assert.match(experience, /2026-10-03T17:00:00-03:00/);
  assert.match(orbit, /orbit-system/);
  assert.match(orbit, /data-celestial-motion/);
  assert.doesNotMatch(orbit, /<button|Pausar órbita|Retomar órbita/);
  assert.match(styles, /@keyframes celestial-spin/);
  assert.match(styles, /@keyframes gifts-orbit/);
  assert.doesNotMatch(styles, /@keyframes balloon-float/);
  assert.match(styles, /@keyframes venue-path-spin/);
  assert.match(styles, /@keyframes sound-invitation-pulse/);
  assert.match(styles, /\.js-motion-ready \.celestial-orbit/);
  assert.match(styles, /repeat\(auto-fit/);
  assert.match(styles, /scale\(1\.05\)/);
  assert.match(ambient, /inQG5wTW20o/);
  assert.match(ambient, /CHORUS_START_SECONDS = 48/);
  assert.match(ambient, /CHORUS_END_SECONDS = 85/);
  assert.match(ambient, /youtube-nocookie\.com/);
  assert.match(ambient, /\/embed\/\$\{YOUTUBE_VIDEO_ID\}/);
  assert.match(ambient, /Abrir convite/);
  assert.match(ambient, /openInvitation/);
  assert.match(ambient, /invitation-gate-falling-star/);
  assert.doesNotMatch(ambient, /Toque para abrir o convite com o refrão/);
  assert.match(ambient, /useState\(false\)/);
  assert.match(ambient, /autoplay=0/);
  assert.doesNotMatch(ambient, /AudioContext|scheduleFluteNote/);
  assert.match(styles, /\.invitation-gate/);
  assert.match(styles, /@keyframes invitation-star-fall/);
});
