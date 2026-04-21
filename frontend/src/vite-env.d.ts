// vite-env.d.ts
// Type declarations for Vite-specific features.
// This file tells TypeScript about things Vite handles at build time
// that TypeScript doesn't know about natively — like importing CSS files.
//
// Without this, TypeScript sees "import './index.css'" and complains
// because CSS files don't export TypeScript types.
//
// This is the standard file that "npm create vite" generates automatically.
// Reference: https://vite.dev/guide/features.html#client-types

/// <reference types="vite/client" />