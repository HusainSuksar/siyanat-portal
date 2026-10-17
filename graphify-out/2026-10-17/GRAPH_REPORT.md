# Graph Report - siyanat-portal  (2026-10-17)

## Corpus Check
- 75 files · ~313,769 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .css 2, (none) 1, .csv 1)

## Summary
- 420 nodes · 1015 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c215dade`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase.ts
- MyRequests.tsx
- package.json
- useSystemConfig.ts
- App.tsx
- BookVehicle.tsx
- BookEvent.tsx
- compilerOptions
- devDependencies
- compilerOptions
- manifest.json
- End-to-End Business Logic, Workflow Duplication, and Optimization Audit Report
- MaintenanceRouting.tsx
- React + TypeScript + Vite
- tsconfig.json
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 61 edges
2. `react` - 53 edges
3. `lucide-react` - 47 edges
4. `supabase` - 46 edges
5. `useToast()` - 37 edges
6. `App()` - 28 edges
7. `compilerOptions` - 17 edges
8. `compilerOptions` - 15 edges
9. `useSystemConfig()` - 13 edges
10. `MaterialDispatch()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `2.3 Pipeline 3: Procurement & Vendor PO Lifecycle` --references--> `PendingPOsTab()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/components/inventory/PendingPOsTab.tsx
- `Priority 1: High-Yield Code Deduplication & File Deletions (Quick Wins)` --references--> `MaterialDispatch()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/components/siyanat/MaterialDispatch.tsx
- `Priority 2: Performance & Network Optimization` --references--> `useAuth()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/contexts/AuthContext.tsx
- `3.3 Module 3: Siyanat & Maintenance` --references--> `MaintenanceRouting()`  [INFERRED]
  AUDIT_REPORT.md → src/components/siyanat/MaintenanceRouting.tsx
- `2.1 Pipeline 1: Maintenance & Complaint Lifecycle` --references--> `VendorPOEngine()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/components/siyanat/VendorPOEngine.tsx

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "supabase.ts"
Cohesion: 0.11
Nodes (29): 3.4 Module 4: Inventory & Procurement, 3.2 Redundant Network Fetching & Missing State Caching, lucide-react, BulkRestockTab(), Props, RestockRow, CatalogTab(), Props (+21 more)

### Community 1 - "MyRequests.tsx"
Cohesion: 0.06
Nodes (48): 3.1 Module 1: Core & Auth, 3.2 Module 2: Role Dashboards, 3.3 Module 3: Siyanat & Maintenance, 3.5 Module 5: Tanzeem, Events & Fleet, 3.6 Module 6: Admin & Reporting, 3. Module-by-Module Integration Matrix Table, 2.1 Pipeline 1: Maintenance & Complaint Lifecycle, BatchDetailsModal() (+40 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (35): dependencies, browser-image-compression, lucide-react, papaparse, react, react-dom, react-router-dom, @supabase/supabase-js (+27 more)

### Community 3 - "useSystemConfig.ts"
Cohesion: 0.11
Nodes (19): Phase 3: Medium (P2) — Performance & Code Cleanliness, 2.5 Pipeline 5: Fleet & Supporting Operations, papaparse, @supabase/supabase-js, TeamManagement, SystemConfigManager(), CachedConfig, ClassHeadcount (+11 more)

### Community 4 - "App.tsx"
Cohesion: 0.07
Nodes (53): browser-image-compression, react, react-router-dom, App(), AssetRegister, DesktopNavigation(), MobileDrawerNavigation(), NotificationManager() (+45 more)

### Community 5 - "BookVehicle.tsx"
Cohesion: 0.07
Nodes (36): 1. Executive Summary & Build Status, 2.1 Supabase Tables Catalog (28 Tables), 2.2 Postgres RPC Stored Procedures Catalog (11 RPCs), 2.3 Storage Buckets & Realtime Channels, 2.4 Hook Layer & Utility Inspection, 2. Backend & Hook Layer Architecture Inventory, 4.1 P0: Lost Update Race Conditions in Inventory & Stock Management, 4.2 P0: Role-Based Access Control Fragmentation & Bypasses (+28 more)

### Community 6 - "BookEvent.tsx"
Cohesion: 0.16
Nodes (19): AssetRequester(), AssetRequesterProps, AFTER_CLASS_SLOTS, BETWEEN_CLASS_PERIODS, BookingForm(), HeadcountEngine(), DecisionState, PERIOD_END_TIMES (+11 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 8 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+10 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 10 - "manifest.json"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, id, name, orientation (+4 more)

### Community 11 - "End-to-End Business Logic, Workflow Duplication, and Optimization Audit Report"
Cohesion: 0.09
Nodes (22): 1.1 Unused Database Objects (Dead Schema Weight), 1.2 Client-Side Work Doing Database Jobs, 1.3 Type & Default Drift, 2.2 Pipeline 2: Material Requisition & Split Dispatch Lifecycle, 2.3 Pipeline 3: Procurement & Vendor PO Lifecycle, 2.4 Pipeline 4: Event Booking & Asset Reconciliation Lifecycle, 3.1 UI & Page Duplication (Code Clone Analysis), A. Unused Tables (2 Tables) (+14 more)

### Community 12 - "MaintenanceRouting.tsx"
Cohesion: 0.33
Nodes (6): CAMPUS_ZONES, MaintenanceRouting(), SiyanatOperations(), generateJobSheet(), JobSheetComplaint, JobSheetTechnician

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **8 isolated node(s):** `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom`, `autoprefixer` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 193 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.tsx` to `supabase.ts`, `MyRequests.tsx`, `package.json`, `useSystemConfig.ts`, `BookVehicle.tsx`, `BookEvent.tsx`, `MaintenanceRouting.tsx`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `useAuth()` (e.g. with `3.2 Module 2: Role Dashboards` and `3.2 Redundant Network Fetching & Missing State Caching`) actually correct?**
  _`useAuth()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/papaparse`, `@types/react` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11201079622132254 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `App.tsx` to `supabase.ts`, `MyRequests.tsx`, `BookVehicle.tsx`, `BookEvent.tsx`, `End-to-End Business Logic, Workflow Duplication, and Optimization Audit Report`, `MaintenanceRouting.tsx`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Should `MyRequests.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05593220338983051 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `supabase.ts` to `MyRequests.tsx`, `package.json`, `useSystemConfig.ts`, `App.tsx`, `BookVehicle.tsx`, `BookEvent.tsx`, `MaintenanceRouting.tsx`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._