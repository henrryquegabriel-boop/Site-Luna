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
  assert.match(layout, /Confirmação de presença/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(experience, /IntersectionObserver/);
  assert.match(experience, /prefers-reduced-motion/);
  assert.match(experience, /\[data-celestial-motion\]/);
  assert.match(experience, /requestAnimationFrame/);
  assert.match(experience, /2026-10-03T17:00:00-03:00/);
  assert.match(orbit, /orbit-system/);
  assert.match(orbit, /data-celestial-motion/);
  assert.doesNotMatch(orbit, /<button|Pausar órbita|Retomar órbita/);
  assert.match(styles, /@keyframes celestial-spin/);
  assert.match(styles, /@keyframes gifts-orbit/);
  assert.match(ambient, /AudioContext/);
});
