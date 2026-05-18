'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

function cx(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(' ');
}

export interface FlowSectionProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  'aria-label'?: string;
  /** Slightly shorter panels when nested in the marketing page */
  compact?: boolean;
}

export const FlowSection: React.FC<FlowSectionProps> = ({
  className,
  style = {},
  children,
  'aria-label': ariaLabel,
  compact = false,
}) => (
  <section
    data-flow-section
    aria-label={ariaLabel}
    className={cx(
      'relative w-full overflow-hidden',
      compact ? 'min-h-[92vh]' : 'min-h-screen',
      className,
    )}
  >
    <div
      data-flow-inner
      className={cx(
        'flow-art-container relative flex w-full flex-col justify-center gap-6 px-[4vw] py-[clamp(2rem,6vw,3.5rem)]',
        compact ? 'min-h-[92vh]' : 'min-h-screen',
        'will-change-transform',
      )}
      style={{ transformOrigin: 'bottom left', ...style }}
    >
      {children}
    </div>
  </section>
);

export interface FlowArtProps {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  /** Embed inside another page (section + edge fades, gentler motion) */
  embedded?: boolean;
  id?: string;
}

const childCount = (children: React.ReactNode) => React.Children.count(children);

const FlowArt: React.FC<FlowArtProps> = ({
  children,
  className,
  'aria-label': ariaLabel = 'Story scroll',
  embedded = false,
  id,
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current || reducedMotion) return;

      const sections = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>('[data-flow-section]'),
      );
      if (sections.length === 0) return;

      const triggers: ScrollTrigger[] = [];
      const entryRotation = embedded ? 14 : 30;

      sections.forEach((section, i) => {
        gsap.set(section, { zIndex: i + 1 });

        const inner = section.querySelector<HTMLElement>('.flow-art-container');
        if (!inner) return;

        const content = section.querySelectorAll('[data-flow-content], [data-flow-visual]');

        if (i > 0) {
          gsap.set(inner, { rotation: entryRotation, transformOrigin: 'bottom left' });
          const rotTween = gsap.to(inner, {
            rotation: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: embedded ? 'top 35%' : 'top 25%',
              scrub: true,
            },
          });
          if (rotTween.scrollTrigger) triggers.push(rotTween.scrollTrigger);
        }

        if (content.length > 0) {
          gsap.set(content, { opacity: embedded ? 0.35 : 0.5, y: embedded ? 28 : 40 });
          const fadeTween = gsap.to(content, {
            opacity: 1,
            y: 0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 75%',
              end: 'top 40%',
              scrub: true,
            },
          });
          if (fadeTween.scrollTrigger) triggers.push(fadeTween.scrollTrigger);
        }

        if (i < sections.length - 1) {
          triggers.push(
            ScrollTrigger.create({
              trigger: section,
              start: 'bottom bottom',
              end: 'bottom top',
              pin: true,
              pinSpacing: false,
            }),
          );
        }
      });

      ScrollTrigger.refresh();

      return () => {
        triggers.forEach((t) => t.kill());
      };
    },
    { scope: containerRef, dependencies: [childCount(children), reducedMotion, embedded] },
  );

  const shellClass = cx(
    'relative w-full overflow-x-hidden',
    embedded && 'isolate',
    className,
  );

  if (embedded) {
    return (
      <section ref={containerRef} id={id} aria-label={ariaLabel} className={shellClass}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[80] h-32 bg-gradient-to-b from-[#06060b] to-transparent"
        />
        {children}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[80] h-40 bg-gradient-to-t from-[#06060b] via-[#06060b]/80 to-transparent"
        />
      </section>
    );
  }

  return (
    <main ref={containerRef} aria-label={ariaLabel} className={shellClass}>
      {children}
    </main>
  );
};

export default FlowArt;
