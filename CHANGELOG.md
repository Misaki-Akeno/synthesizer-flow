# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.2] - 2026-03-30

### Architecture & Framework Upgrade
- **Next.js 16 Upgrade**: Upgraded core framework to Next.js 16.2.1, including mandatory async request API migration and middleware to proxy transition.
- **React 19.2**: Updated React and React-dom to latest version 19.2.4.
- **Turbopack by Default**: Switched to Turbopack as the default compiler for dev and build processes, with optimized configuration for Node.js module fallbacks.

### Features & Fixes
- **Auth Adapter Fix**: Updated `DrizzleAdapter` to support new `AdapterUser` requirements in `next-auth` upgrade, including the `role` field.
- **SSR Store Safety**: Fixed a critical `TypeError` where `localStorage` was accessed during SSR in `settings-store.ts` by using `createJSONStorage` with an environment check.
- **UI & DX Polish**: 
  - Renamed `src/middleware.ts` to `src/proxy.ts` following Next.js 16 conventions.
  - Suppressed redundant `Invalid option` warnings in `ModuleBase` during device enumeration.
  - Improved `tsconfig.json` and `next.config.ts` compatibility with Next.js 16.

## [0.9.1] - 2026-03-30

### Features
- **RBAC Implementation**: Replaced hardcoded email checks with a complete Role-Based Access Control (RBAC) system.
- **Admin Dashboard**: Added initial support for admin-only RAG management routes.

## [0.9.0] - 2026-03-25

### Architecture
- **Server-Side Agents**: Migrated AI Agent logic to the server using LangGraph and Shadow State.
- **HIL Integration**: Implemented Human-In-The-Loop confirmation for sensitive canvas operations.

## [0.8.7] - 2026-03-10
...
