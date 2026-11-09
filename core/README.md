# core

Framework-free TypeScript: importing, detection, redaction and export.

Code here must not import Vue, Nuxt or anything from `app/`, so it can run in a Web Worker and be tested without a browser. ESLint enforces this.
