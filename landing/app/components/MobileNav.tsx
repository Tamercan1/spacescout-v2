'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, Rocket, ExternalLink, Telescope, Shield, Layers, Sparkles } from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';

interface MobileNavProps {
  appUrl: string;
  githubUrl: string;
}

export function MobileNav({ appUrl, githubUrl }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Manage focus, Escape key, scroll locking, and focus trapping
  useEffect(() => {
    if (!isOpen) return;

    // Shift focus into the drawer upon opening without scrolling viewport
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 50);

    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus({ preventScroll: true });
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      // Restore focus to opener button when drawer closes without viewport jump
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen, close]);

  const drawerContent = (
    <>
      {/* Overlay */}
      <div
        className="mobile-nav-overlay"
        data-open={isOpen}
        onClick={close}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <nav
        ref={panelRef}
        className="mobile-nav-panel"
        data-open={isOpen}
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
      >
        <div className="mobile-nav-header">
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Navigation</span>
          <button
            ref={closeBtnRef}
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

  return (
    <>
      <button
        ref={openerRef}
        className="mobile-menu-toggle"
        onClick={open}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <Menu size={22} />
      </button>

      {mounted && typeof document !== 'undefined'
        ? createPortal(drawerContent, document.body)
        : null}
    </>
  );
}
