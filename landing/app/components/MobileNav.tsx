'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu, X, Rocket, ExternalLink, Telescope, Shield, Layers, Sparkles } from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';

interface MobileNavProps {
  appUrl: string;
  githubUrl: string;
}

export function MobileNav({ appUrl, githubUrl }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <Menu size={22} />
      </button>

      {/* Overlay */}
      <div
        className="mobile-nav-overlay"
        data-open={isOpen}
        onClick={close}
        style={{ display: isOpen ? 'block' : 'none' }}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <nav
        className="mobile-nav-panel"
        data-open={isOpen}
        style={{ display: isOpen ? 'flex' : undefined }}
        aria-label="Mobile navigation"
        role="navigation"
      >
        <div className="mobile-nav-header">
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Navigation</span>
          <button
            className="mobile-menu-toggle"
            onClick={close}
            aria-label="Close navigation menu"
            style={{ display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mobile-nav-body">
          <a href="#product" className="mobile-nav-link" onClick={close}>
            <Telescope size={18} />
            Product
          </a>
          <a href="#integrations" className="mobile-nav-link" onClick={close}>
            <Sparkles size={18} />
            Integrations
          </a>
          <a href="#security" className="mobile-nav-link" onClick={close}>
            <Shield size={18} />
            Security
          </a>
          <a href="#architecture" className="mobile-nav-link" onClick={close}>
            <Layers size={18} />
            Architecture
          </a>
          <a
            href={githubUrl}
            className="mobile-nav-link"
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            <GitHubIcon size={18} />
            GitHub
            <ExternalLink size={13} style={{ opacity: 0.5, marginLeft: 'auto' }} />
          </a>
        </div>

        <div className="mobile-nav-footer">
          <a
            href={appUrl}
            className="btn btn-primary btn-lg"
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={close}
          >
            <Rocket size={18} />
            Launch SpaceScout
          </a>
        </div>
      </nav>
    </>
  );
}
