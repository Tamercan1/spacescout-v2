import Image from 'next/image';
import {
  Rocket,
  ExternalLink,
  Telescope,
  MessageSquare,
  Sun,
  Globe,
  ImageIcon,
  Orbit,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  Layers,
  Server,
  Code2,
  Database,
  Cpu,
} from 'lucide-react';
import { FeaturedAstronomySection } from './components/FeaturedAstronomy';
import { MobileNav } from './components/MobileNav';
import { GitHubIcon } from './components/GitHubIcon';
import { getAppUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/Tamercan1/spacescout-v2';

interface HomePageProps {
  searchParams?: Promise<{ date?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const requestedDate = resolvedParams?.date;
  const appUrl = getAppUrl();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%' }}>
      {/* ================================================================
          Navigation
          ================================================================ */}
      <header className="site-header">
        <div className="container">
          <a href="/" className="brand-link" aria-label="SpaceScout home">
            <Image
              src="/spacescout-logo.png"
              alt="SpaceScout"
              width={140}
              height={32}
              priority
              style={{ objectFit: 'contain', width: 'auto', height: '32px' }}
            />
          </a>

          <nav aria-label="Main navigation">
            <ul className="nav-menu">
              <li>
                <a href="#product" className="nav-link">Product</a>
              </li>
              <li>
                <a href="#integrations" className="nav-link">Integrations</a>
              </li>
              <li>
                <a href="#security" className="nav-link">Security</a>
              </li>
              <li>
                <a href="#architecture" className="nav-link">Architecture</a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  className="nav-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <GitHubIcon size={16} />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={appUrl}
                  className="btn btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Rocket size={15} />
                  Launch SpaceScout
                </a>
              </li>
            </ul>
          </nav>

          <MobileNav appUrl={appUrl} githubUrl={GITHUB_URL} />
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* ================================================================
            Hero
            ================================================================ */}
        <section className="hero">
          <div className="container">
            <div className="hero-inner">
              <div className="hero-eyebrow">
                <span className="badge badge-blue">
                  <Telescope size={13} />
                  AI-Powered Space Exploration
                </span>
              </div>

              <h1 className="hero-title">
                Explore the cosmos with NASA data and AI reasoning
              </h1>

              <p className="hero-description">
                Ask questions in natural language. SpaceScout coordinates NASA data sources,
                retrieves real observations, and builds structured discoveries you can
                follow up on, compare, and revisit.
              </p>

              <div className="hero-actions">
                <a
                  href={appUrl}
                  className="btn btn-primary btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Rocket size={18} />
                  Start Exploring
                  <ExternalLink size={15} style={{ opacity: 0.7 }} />
                </a>
                <a
                  href={GITHUB_URL}
                  className="btn btn-secondary btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitHubIcon size={18} />
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            Featured Astronomy (NASA APOD – Server Component)
            ================================================================ */}
        <FeaturedAstronomySection date={requestedDate} />

        {/* ================================================================
            Product Experience
            ================================================================ */}
        <section id="product" className="product-section">
          <div className="container">
            <div className="product-header">
              <div className="section-overline">
                <Telescope size={14} />
                Product
              </div>
              <h2 className="section-title">
                Explorations that grow with your curiosity
              </h2>
              <p className="section-description">
                Each exploration is persistent and additive. Start with a question,
                receive NASA-backed discoveries, then follow up to go deeper
                without losing what you&apos;ve already found.
              </p>
            </div>

            <div className="product-grid">
              {/* Card: Natural Language Exploration */}
              <div className="product-card">
                <div className="product-card-visual">
                  <div className="mock-prompt">
                    &ldquo;What asteroids are approaching Earth this week?&rdquo;
                  </div>
                  <div className="mock-discovery">
                    <div className="mock-discovery-header">
                      <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                        Near-Earth Object
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        NeoWs
                      </span>
                    </div>
                    <div className="mock-discovery-title">(2024 MK) — Close Approach</div>
                    <div className="mock-discovery-text">
                      Estimated diameter 120–270m. Relative velocity 14.2 km/s.
                      Miss distance: 0.0019 AU.
                    </div>
                  </div>
                  <div className="mock-discovery" style={{ opacity: 0.6 }}>
                    <div className="mock-discovery-header">
                      <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                        Potentially Hazardous
                      </span>
                    </div>
                    <div className="mock-discovery-title">(2015 RN35) — Tracking Update</div>
                    <div className="mock-discovery-text" style={{ opacity: 0.7 }}>
                      Estimated diameter 90–200m…
                    </div>
                  </div>
                </div>
                <div className="product-card-body">
                  <h3 className="product-card-title">Natural-Language Exploration</h3>
                  <p className="product-card-text">
                    Ask about asteroids, solar flares, or deep-space imagery
                    in plain language. SpaceScout&apos;s AI planner selects the right
                    NASA tools, retrieves real data, and presents structured discovery cards.
                  </p>
                </div>
              </div>

              {/* Card: Multi-Turn Follow-Ups */}
              <div className="product-card">
                <div className="product-card-visual">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: 'var(--blue-dim)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '0.85rem',
                      color: 'var(--blue)',
                    }}>
                      <MessageSquare size={14} />
                      &ldquo;Tell me more about this asteroid&rdquo;
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: 'var(--blue-dim)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '0.85rem',
                      color: 'var(--blue)',
                    }}>
                      <MessageSquare size={14} />
                      &ldquo;Compare it with other nearby objects&rdquo;
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: 'var(--blue-dim)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '0.85rem',
                      color: 'var(--blue)',
                    }}>
                      <MessageSquare size={14} />
                      &ldquo;Show me related solar activity&rdquo;
                    </div>
                  </div>
                  <div className="mock-chips">
                    <span className="mock-chip">8 discoveries</span>
                    <span className="mock-chip">3 follow-ups</span>
                    <span className="mock-chip">4 sources</span>
                  </div>
                </div>
                <div className="product-card-body">
                  <h3 className="product-card-title">Multi-Turn Follow-Ups</h3>
                  <p className="product-card-text">
                    Each exploration is a persistent workspace. Follow up on individual
                    discoveries, request comparisons, or pivot to related topics. New
                    discoveries are added without overwriting what you&apos;ve already found.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ================================================================
            NASA Integrations
            ================================================================ */}
        <section id="integrations" className="section">
          <div className="container">
            <div className="product-header">
              <div className="section-overline">
                <Globe size={14} />
                NASA Integrations
              </div>
              <h2 className="section-title">
                Five NASA data sources, one conversation
              </h2>
              <p className="section-description">
                SpaceScout connects to NASA&apos;s open APIs to retrieve real observational data.
                The AI planner selects the right source based on your question.
              </p>
            </div>

            <div className="integrations-grid">
              <div className="integration-card">
                <div
                  className="integration-icon"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
                >
                  <ImageIcon size={20} />
                </div>
                <h3 className="integration-card-title">Astronomy Picture of the Day</h3>
                <p className="integration-card-text">
                  Daily curated astronomy images and explanations from NASA&apos;s APOD archive,
                  spanning decades of observations.
                </p>
              </div>

              <div className="integration-card">
                <div
                  className="integration-icon"
                  style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}
                >
                  <Orbit size={20} />
                </div>
                <h3 className="integration-card-title">Near-Earth Objects (NeoWs)</h3>
                <p className="integration-card-text">
                  Track asteroids and comets approaching Earth, including estimated sizes,
                  velocities, miss distances, and hazard classifications.
                </p>
              </div>

              <div className="integration-card">
                <div
                  className="integration-icon"
                  style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}
                >
                  <Sun size={20} />
                </div>
                <h3 className="integration-card-title">Space Weather (DONKI)</h3>
                <p className="integration-card-text">
                  Solar flare classifications, active region identifiers, peak times,
                  and event durations from NASA&apos;s space weather notification system.
                </p>
              </div>

              <div className="integration-card">
                <div
                  className="integration-icon"
                  style={{ background: 'var(--green-dim)', color: 'var(--green)' }}
                >
                  <ImageIcon size={20} />
                </div>
                <h3 className="integration-card-title">NASA Image &amp; Video Library</h3>
                <p className="integration-card-text">
                  Search NASA&apos;s media archive of spaceflight photography, satellite imagery,
                  and mission footage by topic or keyword.
                </p>
              </div>

              <div className="integration-card">
                <div
                  className="integration-icon"
                  style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}
                >
                  <Globe size={20} />
                </div>
                <h3 className="integration-card-title">EPIC Earth Imagery</h3>
                <p className="integration-card-text">
                  Full-disc Earth photographs from the DSCOVR satellite at Lagrange Point&nbsp;1,
                  with geographic coordinates and timestamps.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ================================================================
            BYOK & Data Handling
            ================================================================ */}
        <section id="security" className="section">
          <div className="container">
            <div className="byok-grid">
              <div className="byok-content">
                <div>
                  <div className="section-overline">
                    <ShieldCheck size={14} />
                    Security &amp; Credentials
                  </div>
                  <h2 className="section-title">Bring your own API keys</h2>
                  <p className="section-description">
                    SpaceScout supports Bring Your Own Key for OpenRouter and NASA.
                    You can optionally provide your own credentials for higher rate limits
                    and model access, or use the shared application defaults.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="byok-feature">
                    <div className="byok-feature-icon" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                      <Lock size={18} />
                    </div>
                    <div>
                      <div className="byok-feature-title">Encrypted before storage</div>
                      <p className="byok-feature-text">
                        User provider credentials are encrypted using Fernet symmetric encryption before
                        being persisted in PostgreSQL. Plaintext keys are never written to application logs.
                      </p>
                    </div>
                  </div>

                  <div className="byok-feature">
                    <div className="byok-feature-icon" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                      <Eye size={18} />
                    </div>
                    <div>
                      <div className="byok-feature-title">Masked read responses</div>
                      <p className="byok-feature-text">
                        Credential read endpoints expose only masked hints (e.g. ••••abcd) so you can
                        identify active keys without exposing plaintext to the browser.
                      </p>
                    </div>
                  </div>

                  <div className="byok-feature">
                    <div className="byok-feature-icon" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>
                      <Server size={18} />
                    </div>
                    <div>
                      <div className="byok-feature-title">Server-side execution</div>
                      <p className="byok-feature-text">
                        All AI completions and NASA queries execute server-side in Django. Keys are
                        decrypted only in memory at execution time and are never bundled into client scripts.
                      </p>
                    </div>
                  </div>

                  <div className="byok-feature">
                    <div className="byok-feature-icon" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <div className="byok-feature-title">Validated before saving &amp; fallback</div>
                      <p className="byok-feature-text">
                        Keys are validated against provider APIs upfront. Depending on deployment configuration,
                        server-side fallback keys may also be available so personal keys remain optional.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BYOK Visual */}
              <div className="byok-visual">
                <div className="byok-visual-header">
                  <KeyRound size={16} />
                  API Credentials
                </div>
                <div className="byok-visual-body">
                  <div className="byok-credential-row">
                    <div>
                      <div className="byok-provider-name">OpenRouter</div>
                      <div className="byok-key-hint">sk-or-v1-••••••••a1b2</div>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      Validated
                    </span>
                  </div>
                  <div className="byok-credential-row">
                    <div>
                      <div className="byok-provider-name">NASA API</div>
                      <div className="byok-key-hint">••••••••xY9z</div>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      Validated
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Your keys → encrypted PostgreSQL storage → decrypted server-side at execution time → masked in client views.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ================================================================
            Technology & Architecture
            ================================================================ */}
        <section id="architecture" className="section">
          <div className="container">
            <div className="product-header">
              <div className="section-overline">
                <Layers size={14} />
                Architecture
              </div>
              <h2 className="section-title">
                Built with modern, auditable tools
              </h2>
              <p className="section-description">
                SpaceScout is open-source. The entire stack is inspectable,
                from the AI orchestration layer to the credential encryption service.
              </p>
            </div>

            <div className="arch-grid">
              <div className="arch-card">
                <div className="arch-card-icon" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                  <Code2 size={20} />
                </div>
                <h3 className="arch-card-title">Frontend Application</h3>
                <p className="arch-card-text">
                  React 19 single-page application with TypeScript, built with Vite.
                  Responsive design system, multi-page routing, dynamic discovery cards,
                  and an additive interaction stream.
                </p>
                <div className="arch-tag-row">
                  <span className="arch-tag">React 19</span>
                  <span className="arch-tag">TypeScript</span>
                  <span className="arch-tag">Vite</span>
                </div>
              </div>

              <div className="arch-card">
                <div className="arch-card-icon" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                  <Server size={20} />
                </div>
                <h3 className="arch-card-title">Backend API</h3>
                <p className="arch-card-text">
                  Django REST Framework with JWT authentication, BYOK credential
                  encryption, and a modular tool registry that maps AI tool calls
                  to NASA service executions.
                </p>
                <div className="arch-tag-row">
                  <span className="arch-tag">Django</span>
                  <span className="arch-tag">DRF</span>
                  <span className="arch-tag">Python</span>
                </div>
              </div>

              <div className="arch-card">
                <div className="arch-card-icon" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>
                  <Cpu size={20} />
                </div>
                <h3 className="arch-card-title">AI Orchestrator</h3>
                <p className="arch-card-text">
                  Multi-turn tool-calling loop with safety limits, duplicate failure
                  suppression, post-tool enrichment, and provider-independent error codes.
                  Uses OpenRouter for LLM access.
                </p>
                <div className="arch-tag-row">
                  <span className="arch-tag">OpenRouter</span>
                  <span className="arch-tag">Tool Calling</span>
                  <span className="arch-tag">Pydantic</span>
                </div>
              </div>

              <div className="arch-card">
                <div className="arch-card-icon" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                  <Database size={20} />
                </div>
                <h3 className="arch-card-title">Data &amp; Persistence</h3>
                <p className="arch-card-text">
                  PostgreSQL with discovery deduplication, atomic result persistence,
                  and interaction history tracking. Explorations are resumable
                  and discoveries are never silently deleted.
                </p>
                <div className="arch-tag-row">
                  <span className="arch-tag">PostgreSQL</span>
                  <span className="arch-tag">Aiven</span>
                  <span className="arch-tag">Fernet</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <a
                href={GITHUB_URL}
                className="btn btn-secondary btn-lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon size={18} />
                Explore the Source Code
                <ExternalLink size={15} style={{ opacity: 0.5 }} />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================
          Footer
          ================================================================ */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            {/* Brand Column */}
            <div>
              <Image
                src="/spacescout-logo.png"
                alt="SpaceScout"
                width={140}
                height={32}
                style={{ objectFit: 'contain', width: 'auto', height: '28px' }}
              />
              <p className="footer-brand-text">
                AI-powered space exploration using NASA&apos;s open data.
              </p>
            </div>

            {/* Application */}
            <div>
              <div className="footer-col-title">Application</div>
              <ul className="footer-links">
                <li>
                  <a
                    href={appUrl}
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Launch App
                    <ExternalLink size={12} />
                  </a>
                </li>
                <li>
                  <a
                    href={`${appUrl}/register`}
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Create Account
                  </a>
                </li>
                <li>
                  <a
                    href={`${appUrl}/login`}
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sign In
                  </a>
                </li>
              </ul>
            </div>

            {/* Project */}
            <div>
              <div className="footer-col-title">Project</div>
              <ul className="footer-links">
                <li>
                  <a
                    href={GITHUB_URL}
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                    <ExternalLink size={12} />
                  </a>
                </li>
                <li>
                  <a href="#architecture" className="footer-link">
                    Architecture
                  </a>
                </li>
                <li>
                  <a href="#integrations" className="footer-link">
                    Integrations
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <div className="footer-col-title">Resources</div>
              <ul className="footer-links">
                <li>
                  <a
                    href="https://api.nasa.gov/"
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    NASA Open APIs
                    <ExternalLink size={12} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://openrouter.ai/"
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenRouter
                    <ExternalLink size={12} />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="footer-bottom">
            <div className="footer-nasa-attr">
              <Image
                src="/nasa-6-logo-svgrepo-com.svg"
                alt="NASA"
                width={22}
                height={18}
                style={{ opacity: 0.7 }}
              />
              <span>
                Astronomy data provided by NASA Open APIs. SpaceScout is not affiliated with
                or endorsed by NASA. Data availability depends on NASA&apos;s external services.
              </span>
            </div>
            <div className="footer-bottom-text">
              SpaceScout V2 © {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
