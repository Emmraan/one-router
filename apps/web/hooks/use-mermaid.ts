'use client';

import * as React from 'react';

export function useMermaid() {
  const [loaded, setLoaded] = React.useState(() => typeof window !== 'undefined' && !!window.mermaid);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.mermaid) return;

    const scriptId = 'mermaid-cdn-js';
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      const handleLoad = () => setLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      if (window.mermaid) {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
        });
        setLoaded(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  return loaded;
}
