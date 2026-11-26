'use client';

import * as React from 'react';

export function useKatex() {
  const [loaded, setLoaded] = React.useState(() => typeof window !== 'undefined' && !!window.katex);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.katex) return;

    const linkId = 'katex-cdn-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }

    const scriptId = 'katex-cdn-js';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      const handleLoad = () => setLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  return loaded;
}
