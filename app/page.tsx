import { AmbientExperience } from "./AmbientExperience";
import { OrbitExperience } from "./OrbitExperience";
import { RsvpForm } from "./RsvpForm";
import { CelebrationCountdown, SiteExperience } from "./SiteExperience";
import type { CSSProperties } from "react";
import balloons from "./assets/balloons.webp?inline";
import babyLuna from "./assets/baby-luna.png?inline";
import cloud from "./assets/cloud.png?inline";
import rainbowSymmetric from "./assets/rainbow-symmetric.png?inline";

/* Imagens embutidas em data URLs para dispensar requisições ao servidor. */
/* eslint-disable @next/next/no-img-element */

const stars = [
  { left: "7%", top: "22%", size: "1.1rem", delay: "0s" },
  { left: "17%", top: "68%", size: ".72rem", delay: ".8s" },
  { left: "43%", top: "18%", size: ".66rem", delay: "1.6s" },
  { left: "83%", top: "24%", size: ".92rem", delay: ".4s" },
  { left: "92%", top: "66%", size: ".68rem", delay: "1.2s" },
];

const details = [
  {
    accent: "rose",
    icon: "03",
    kicker: "Data",
    title: "Outubro de 2026",
    description: "Sábado, uma tarde para guardar na memória.",
  },
  {
    accent: "mint",
    icon: "17",
    kicker: "Horário",
    title: "Às 17 horas",
    description: "Chegue com calma para viver cada detalhe com a gente.",
  },
  {
    accent: "lilac",
    icon: "45",
    kicker: "Local",
    title: "Espaço 45",
    description: "Um cantinho especial preparado para o nosso encontro.",
  },
];

const giftSuggestions = [
  "Brinquedo",
  "Bíblia infantil",
  "Roupa 2 anos",
  "Calçado 21, 22 ou 23",
  "Livro infantil cristão",
];

export default function Home() {
  return (
    <main id="inicio">
      <SiteExperience />
      <AmbientExperience />

      <section className="hero" aria-labelledby="titulo-convite">
        <img
          className="balloon-garland"
          src={balloons}
          alt="Balões em tons pastel"
          width={800}
          height={800}
          fetchPriority="high"
        />

        {stars.map((star, index) => (
          <span
            className="floating-star"
            aria-hidden="true"
            key={index}
            style={{
              left: star.left,
              top: star.top,
              fontSize: star.size,
              animationDelay: star.delay,
            }}
          >
            ✦
          </span>
        ))}

        <div className="hero-inner">
          <div className="hero-copy hero-enter">
            <div className="event-badge">
              <span aria-hidden="true">✦</span>
              <p>Um convite muito especial</p>
              <time dateTime="2026-10-03">03 · 10 · 2026</time>
            </div>

            <h1 id="titulo-convite">
              <span className="title-prefix">E Deus criou</span>
              <span className="title-name">Luna!</span>
            </h1>

            <blockquote>
              “Tudo Ele fez formoso em seu devido tempo.”
              <cite>Eclesiastes 3:11</cite>
            </blockquote>

            <p className="intro">
              Há um ano, o Criador nos presenteou com a nossa maior obra-prima.
              Venha celebrar o primeiro aninho da nossa pequena Luna.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#confirmar">
                Confirmar presença
                <span aria-hidden="true">♡</span>
              </a>
              <a className="text-button" href="#detalhes">
                Ver os detalhes <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div className="hero-facts" aria-label="Resumo da celebração">
              <span>
                <small>Quando</small>
                <strong>03 de outubro · 17h</strong>
              </span>
              <span>
                <small>Onde</small>
                <strong>Espaço 45</strong>
              </span>
            </div>
          </div>

          <div className="hero-art art-enter">
            <div className="art-halo" />
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <OrbitExperience />
            <img
              className="rainbow"
              src={rainbowSymmetric}
              alt=""
              width={1647}
              height={955}
            />
            <img
              className="baby"
              src={babyLuna}
              alt=""
              width={150}
              height={150}
            />
            <img
              className="cloud cloud-main"
              src={cloud}
              alt=""
              width={200}
              height={200}
            />
            <div className="date-seal" aria-hidden="true">
              <small>out</small>
              <strong>03</strong>
              <span>2026</span>
            </div>
            <span className="art-caption" aria-hidden="true">um ano de amor</span>
          </div>
        </div>

        <a className="scroll-note" href="#historia" aria-label="Conheça o convite">
          <span aria-hidden="true" />
          role para descobrir
        </a>
      </section>

      <section
        className="story-section"
        id="historia"
        aria-labelledby="historia-titulo"
        data-aos="fade-up"
      >
        <div className="story-copy" data-reveal>
          <p className="eyebrow">Uma história escrita por Deus</p>
          <h2 id="historia-titulo">
            Um pedacinho do céu que transformou o nosso mundo
          </h2>
        </div>
        <div className="story-note" data-reveal style={{ "--reveal-delay": "120ms" } as CSSProperties}>
          <span className="story-quote" aria-hidden="true">“</span>
          <p>
            Cada sorriso, descoberta e abraço da Luna tornou este primeiro ano
            inesquecível. Agora queremos reunir quem amamos para agradecer e
            celebrar essa bênção tão linda.
          </p>
          <span className="signature">Com carinho, família da Luna</span>
        </div>

        <div className="milestone-ribbon" data-reveal>
          <div>
            <strong>365</strong>
            <span>dias de descobertas</span>
          </div>
          <i aria-hidden="true">✦</i>
          <div>
            <strong>12</strong>
            <span>meses de sorrisos</span>
          </div>
          <i aria-hidden="true">✦</i>
          <div>
            <strong>1</strong>
            <span>grande motivo para celebrar</span>
          </div>
        </div>
      </section>

      <section
        className="details-section"
        id="detalhes"
        aria-labelledby="detalhes-titulo"
        data-aos="fade-up"
      >
        <div className="section-heading" data-reveal>
          <span className="mini-star" aria-hidden="true">✦</span>
          <p>Reserve essa data</p>
          <h2 id="detalhes-titulo">Tudo para viver esse momento</h2>
          <span className="heading-rule" aria-hidden="true" />
        </div>

        <div className="details-grid">
          {details.map((detail, index) => (
            <article
              className={`detail-card detail-${detail.accent}`}
              data-reveal
              key={detail.kicker}
              style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
            >
              <span className="detail-number" aria-hidden="true">0{index + 1}</span>
              <span className="detail-kicker">{detail.kicker}</span>
              <strong>{detail.icon}</strong>
              <div>
                <h3>{detail.title}</h3>
                <p>{detail.description}</p>
              </div>
            </article>
          ))}
        </div>

        <article className="venue-panel" data-reveal>
          <div className="venue-visual" aria-hidden="true">
            <span className="venue-pin">⌖</span>
            <span className="venue-path path-one" />
            <span className="venue-path path-two" />
            <span className="venue-star">✦</span>
          </div>
          <div className="venue-copy">
            <p className="eyebrow">Seu caminho até a festa</p>
            <h3>Espaço 45</h3>
            <p>
              Abra a rota no seu aplicativo de mapas e chegue com tranquilidade
              para aproveitar cada minuto da celebração.
            </p>
            <a
              className="map-button"
              href="https://maps.app.goo.gl/ZKapPHJ2PfYyw7B3A"
              rel="noreferrer"
              target="_blank"
            >
              Como chegar <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
      </section>

      <section className="countdown-section" aria-labelledby="contagem-titulo">
        <div className="countdown-copy" data-reveal>
          <p className="eyebrow">A alegria já começou</p>
          <h2 id="contagem-titulo">Falta pouco para o nosso encontro</h2>
          <p>03 de outubro de 2026, às 17 horas</p>
        </div>
        <div data-reveal style={{ "--reveal-delay": "120ms" } as CSSProperties}>
          <CelebrationCountdown />
        </div>
      </section>

      <section
        className="gifts-section"
        id="presentes"
        aria-labelledby="presentes-titulo"
        data-aos="fade-up"
      >
        <div className="gifts-cosmos" aria-hidden="true" data-reveal>
          <div
            className="gifts-celestial-layer"
            data-celestial-depth="0.9"
            data-celestial-motion
            data-celestial-phase="1.4"
          >
            <span className="gifts-glow" />
            <span className="gifts-moon">☾</span>
            <span className="gifts-orbit gifts-orbit-one">
              <i>✦</i>
            </span>
            <span className="gifts-orbit gifts-orbit-two">
              <i>✧</i>
            </span>
            <span className="gifts-orbit gifts-orbit-three">
              <i>✦</i>
            </span>
            <span className="gifts-star gifts-star-one">✦</span>
            <span className="gifts-star gifts-star-two">✧</span>
            <span className="gifts-star gifts-star-three">✦</span>
            <p>Luna</p>
            <small>um pedacinho do céu</small>
          </div>
        </div>

        <div className="gifts-content">
          <div className="gifts-heading" data-reveal>
            <p className="eyebrow">Para quem quiser mimar a Luna</p>
            <h2 id="presentes-titulo">Sugestões de presentes</h2>
            <p>
              Sua presença já é o nosso maior presente. Mas, se desejar levar
              um carinho para a Luna, reunimos algumas ideias especiais.
            </p>
          </div>

          <ul className="gift-list" aria-label="Sugestões de presentes para Luna">
            {giftSuggestions.map((gift, index) => (
              <li
                data-reveal
                key={gift}
                style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}
              >
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <strong>{gift}</strong>
                <i aria-hidden="true">✦</i>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="rsvp-section"
        id="confirmar"
        aria-labelledby="rsvp-titulo"
        data-aos="fade-up"
      >
        <div
          className="rsvp-decoration"
          aria-hidden="true"
          data-celestial-depth="0.55"
          data-celestial-motion
          data-celestial-phase="2.7"
        >
          <span className="rsvp-moon">☾</span>
          <span className="rsvp-sparkle sparkle-one">✦</span>
          <span className="rsvp-sparkle sparkle-two">✧</span>
        </div>

        <div className="rsvp-intro" data-reveal>
          <p className="eyebrow">Faça parte desse momento</p>
          <h2 id="rsvp-titulo">Sua presença é o nosso presente</h2>
          <p>
            Conte para nós se você poderá estar presente. A resposta é simples,
            segura e fica registrada na mesma hora.
          </p>
          <div className="rsvp-deadline">
            <span aria-hidden="true">♡</span>
            <div>
              <small>Confirmação rápida</small>
              <strong>Leva menos de um minuto</strong>
            </div>
          </div>
          <div className="rsvp-assurance">
            <span>✓ Registro imediato</span>
            <span>✓ Dados protegidos</span>
          </div>
        </div>

        <div data-reveal style={{ "--reveal-delay": "130ms" } as CSSProperties}>
          <RsvpForm />
        </div>
      </section>

      <footer>
        <span aria-hidden="true">✦</span>
        <p>Com amor, família da Luna</p>
        <small>03 · 10 · 2026</small>
        <nav aria-label="Links do rodapé">
          <a href="#inicio">Início</a>
          <a href="#detalhes">Detalhes</a>
          <a href="#presentes">Presentes</a>
          <a href="#confirmar">Confirmar presença</a>
        </nav>
      </footer>
    </main>
  );
}
