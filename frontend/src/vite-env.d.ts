/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_PINATA_GATEWAY?: string;
  readonly VITE_GOLDSKY_GRAPHQL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
