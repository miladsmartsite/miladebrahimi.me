/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Public Umami website id — safe to expose client-side (not a secret).
   * Analytics renders nothing at all when this is unset (see Analytics.astro). */
  readonly PUBLIC_UMAMI_WEBSITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Present only when the Umami tracker script has loaded. */
  umami?: {
    track: (eventName: string, data?: Record<string, unknown>) => void;
  };
}
