# Graph Report - siyanat-portal  (2026-10-17)

## Corpus Check
- 75 files · ~317,842 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .css 2, (none) 1, .csv 1)

## Summary
- 424 nodes · 1034 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16d083db`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase.ts
- MaterialDispatch.tsx
- package.json
- EventsManager.tsx
- App.tsx
- roles.ts
- BookEvent.tsx
- compilerOptions
- devDependencies
- compilerOptions
- manifest.json
- End-to-End Business Logic, Workflow Duplication, and Optimization Audit Report
- useSystemConfig.ts
- React + TypeScript + Vite
- tsconfig.json
- vercel.json
- MyRequests.tsx
- canBookFleet
- locations.ts
- 2. Backend & Hook Layer Architecture Inventory
- 4. Schema, Security & Concurrency Gaps
- BookVehicle.tsx
- 3. Module-by-Module Integration Matrix Table

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 63 edges
2. `react` - 53 edges
3. `lucide-react` - 47 edges
4. `supabase` - 46 edges
5. `useToast()` - 37 edges
6. `App()` - 28 edges
7. `compilerOptions` - 17 edges
8. `compilerOptions` - 15 edges
9. `MaterialDispatch()` - 13 edges
10. `useSystemConfig()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `2.3 Pipeline 3: Procurement & Vendor PO Lifecycle` --references--> `PendingPOsTab()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/components/inventory/PendingPOsTab.tsx
- `Priority 1: High-Yield Code Deduplication & File Deletions (Quick Wins)` --references--> `MaterialDispatch()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/components/siyanat/MaterialDispatch.tsx
- `2.1 Pipeline 1: Maintenance & Complaint Lifecycle` --references--> `VendorPOEngine()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/components/siyanat/VendorPOEngine.tsx
- `Priority 2: Performance & Network Optimization` --references--> `useAuth()`  [INFERRED]
  LOGIC_OPTIMIZATION_REPORT.md → src/contexts/AuthContext.tsx
- `3.1 Module 1: Core & Auth` --references--> `UserRole`  [INFERRED]
  AUDIT_REPORT.md → src/utils/roles.ts

## Import Cycles
- None detected.

## Communities (24 total, 3 thin omitted)

### Community 0 - "supabase.ts"
Cohesion: 0.11
Nodes (28): 3.4 Module 4: Inventory & Procurement, 3.2 Redundant Network Fetching & Missing State Caching, BulkRestockTab(), Props, RestockRow, CatalogTab(), Props, DirectItem (+20 more)

### Community 1 - "MaterialDispatch.tsx"
Cohesion: 0.10
Nodes (28): 3.3 Module 3: Siyanat & Maintenance, SiyanatOperations, BatchDetailsModal(), AlternativeItemModal(), InventoryItem, Props, CAMPUS_ZONES, MaintenanceRouting() (+20 more)

### Community 2 - "package.json"
Cohesion: 0.05
Nodes (40): dependencies, browser-image-compression, lucide-react, papaparse, react, react-dom, react-router-dom, @supabase/supabase-js (+32 more)

### Community 3 - "EventsManager.tsx"
Cohesion: 0.16
Nodes (16): 3.5 Module 5: Tanzeem, Events & Fleet, TanzeemCommandCenter, DecisionState, EventsManager(), isAvitRequirement(), isSiyanatRequirement(), PERIOD_END_TIMES, Assignment (+8 more)

### Community 4 - "App.tsx"
Cohesion: 0.10
Nodes (42): lucide-react, react, react-router-dom, App(), AssetRegister, ReceptionWatchtower, Reports, RestockInventory (+34 more)

### Community 5 - "roles.ts"
Cohesion: 0.18
Nodes (14): 2.4 Hook Layer & Utility Inspection, 3.3 Dead Code & Unused Exports, SubLocationConfig, SubLocationType, VenueConfig, InventoryItem, Profile, WorkOrderItem (+6 more)

### Community 6 - "BookEvent.tsx"
Cohesion: 0.20
Nodes (16): AssetRequester(), AssetRequesterProps, AFTER_CLASS_SLOTS, BETWEEN_CLASS_PERIODS, BookingForm(), HeadcountEngine(), EVENT_VENUES, EVENT_ZONES (+8 more)

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
Cohesion: 0.11
Nodes (17): 1.1 Unused Database Objects (Dead Schema Weight), 1.2 Client-Side Work Doing Database Jobs, 1.3 Type & Default Drift, 3.1 UI & Page Duplication (Code Clone Analysis), A. Unused Tables (2 Tables), B. Unused Callable RPC Functions (6 Functions), C. Unused Columns on Active Tables, End-to-End Business Logic, Workflow Duplication, and Optimization Audit Report (+9 more)

### Community 12 - "useSystemConfig.ts"
Cohesion: 0.10
Nodes (21): Phase 3: Medium (P2) — Performance & Code Cleanliness, 2.1 Pipeline 1: Maintenance & Complaint Lifecycle, 2.2 Pipeline 2: Material Requisition & Split Dispatch Lifecycle, 2.3 Pipeline 3: Procurement & Vendor PO Lifecycle, 2.4 Pipeline 4: Event Booking & Asset Reconciliation Lifecycle, 2.5 Pipeline 5: Fleet & Supporting Operations, Phase 2: End-to-End Functional Logic Flow Simulation (All 5 Pipelines), State Machine Reference Model (+13 more)

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 17 - "MyRequests.tsx"
Cohesion: 0.20
Nodes (9): PERIOD_END_TIMES, StepperProps, VisualPipelineStepper(), ComplaintPhoto, ComplaintRecord, FleetBooking, MaterialReq, ReqItem (+1 more)

### Community 18 - "canBookFleet"
Cohesion: 0.20
Nodes (11): 1. Executive Summary & Build Status, 5. Prioritized Action Plan, Comprehensive Frontend-to-Backend (Supabase) Integration Audit Report, Phase 1: Critical (P0) — Data Integrity & Security, Phase 2: High (P1) — Mutation Integrity & Error Handling, DesktopNavigation(), MobileDrawerNavigation(), NotificationManager() (+3 more)

### Community 19 - "locations.ts"
Cohesion: 0.22
Nodes (9): browser-image-compression, LOCAL_LANDMARKS, MAINTENANCE_ZONES, MASTER_ZONES, MAZAR_LOCATIONS, ZONE_COORDINATES, ZONE_FLOW_MAP, CATEGORIES (+1 more)

### Community 20 - "2. Backend & Hook Layer Architecture Inventory"
Cohesion: 0.33
Nodes (6): 2.1 Supabase Tables Catalog (28 Tables), 2.2 Postgres RPC Stored Procedures Catalog (11 RPCs), 2.3 Storage Buckets & Realtime Channels, 2. Backend & Hook Layer Architecture Inventory, Realtime Channels (3), Storage Bucket (1)

### Community 21 - "4. Schema, Security & Concurrency Gaps"
Cohesion: 0.33
Nodes (6): 4.1 P0: Lost Update Race Conditions in Inventory & Stock Management, 4.2 P0: Role-Based Access Control Fragmentation & Bypasses, 4.3 P1: Over 60 Unchecked Async Supabase Mutations, 4.4 P1: Silent Photo Upload Failure, 4.5 P1: Cascading Effect Render Warning in TechnicianPortal, 4. Schema, Security & Concurrency Gaps

### Community 22 - "BookVehicle.tsx"
Cohesion: 0.70
Nodes (4): addMinutesToTime(), BookVehicle(), formatMinutesToHours(), getMinBookingDate()

### Community 23 - "3. Module-by-Module Integration Matrix Table"
Cohesion: 0.50
Nodes (4): 3.1 Module 1: Core & Auth, 3.2 Module 2: Role Dashboards, 3.6 Module 6: Admin & Reporting, 3. Module-by-Module Integration Matrix Table

## Knowledge Gaps
- **8 isolated node(s):** `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom`, `autoprefixer` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 193 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `App.tsx` to `supabase.ts`, `MaterialDispatch.tsx`, `EventsManager.tsx`, `BookEvent.tsx`, `End-to-End Business Logic, Workflow Duplication, and Optimization Audit Report`, `MyRequests.tsx`, `locations.ts`, `BookVehicle.tsx`, `3. Module-by-Module Integration Matrix Table`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `useAuth()` (e.g. with `3.2 Module 2: Role Dashboards` and `3.2 Redundant Network Fetching & Missing State Caching`) actually correct?**
  _`useAuth()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/papaparse`, `@types/react` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10960960960960961 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `supabase.ts`, `MaterialDispatch.tsx`, `package.json`, `EventsManager.tsx`, `BookEvent.tsx`, `useSystemConfig.ts`, `MyRequests.tsx`, `locations.ts`, `BookVehicle.tsx`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Should `MaterialDispatch.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09759759759759759 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `supabase.ts`, `MaterialDispatch.tsx`, `package.json`, `EventsManager.tsx`, `BookEvent.tsx`, `MyRequests.tsx`, `locations.ts`, `BookVehicle.tsx`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._