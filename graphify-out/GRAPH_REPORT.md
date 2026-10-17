# Graph Report - siyanat-portal  (2026-10-17)

## Corpus Check
- 84 files · ~322,067 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .css 2, (none) 1, .csv 1)

## Summary
- 367 nodes · 938 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App Shell & Core Navigation
- System Configuration & Bulk Inventory
- Project Dependencies & Tooling
- Routing, Auth Guards & Global Actions
- Events Approvals & Department Handoff
- Material Requisitions & Direct PO Modals
- Campus Locations, Zones & Landmarks
- Request Pipeline Visualizer & Tracking
- Event Asset Requester & Time Slots
- TypeScript App Compiler Configuration
- Developer Tooling & Build Plugins
- TypeScript Node & Vite Config
- PWA Web App Manifest
- Siyanat Operations & Maintenance Routing
- TypeScript Root Project References
- Vercel Hosting & Deployment Rewrites

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 61 edges
2. `react` - 52 edges
3. `lucide-react` - 47 edges
4. `supabase` - 46 edges
5. `useToast()` - 37 edges
6. `App()` - 28 edges
7. `compilerOptions` - 17 edges
8. `compilerOptions` - 15 edges
9. `react-router-dom` - 12 edges
10. `MaterialDispatch()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `TeamManagement()` --calls--> `useSystemConfig()`  [EXTRACTED]
  src/pages/TeamManagement.tsx → src/hooks/useSystemConfig.ts
- `Reports()` --calls--> `useToast()`  [EXTRACTED]
  src/pages/Reports.tsx → src/hooks/useToast.ts
- `App()` --calls--> `ForcePasswordChange()`  [EXTRACTED]
  src/App.tsx → src/components/ForcePasswordChange.tsx
- `App()` --calls--> `GlobalActionController()`  [EXTRACTED]
  src/App.tsx → src/components/GlobalActionController.tsx
- `App()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/contexts/AuthContext.tsx

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "App Shell & Core Navigation"
Cohesion: 0.08
Nodes (30): react-dom, @supabase/supabase-js, App(), AssetRegister, DesktopNavigation(), MobileDrawerNavigation(), NotificationManager(), PortalLayout() (+22 more)

### Community 1 - "System Configuration & Bulk Inventory"
Cohesion: 0.09
Nodes (33): papaparse, SystemConfigManager, SystemConfigManager(), BulkRestockTab(), Props, RestockRow, CatalogTab(), Props (+25 more)

### Community 2 - "Project Dependencies & Tooling"
Cohesion: 0.06
Nodes (34): dependencies, browser-image-compression, lucide-react, papaparse, react, react-dom, react-router-dom, @supabase/supabase-js (+26 more)

### Community 3 - "Routing, Auth Guards & Global Actions"
Cohesion: 0.16
Nodes (18): react-router-dom, ForcePasswordChange(), GlobalActionController(), RoleAwareActionModal(), AuthContext, AuthContextType, useAuth(), supabase (+10 more)

### Community 4 - "Events Approvals & Department Handoff"
Cohesion: 0.12
Nodes (21): lucide-react, DecisionState, EventsManager(), isAvitRequirement(), isSiyanatRequirement(), PERIOD_END_TIMES, Assignment, FleetEngine() (+13 more)

### Community 5 - "Material Requisitions & Direct PO Modals"
Cohesion: 0.15
Nodes (21): react, BatchDetailsModal(), DirectItem, DirectPOModal(), generateDirectPONumber(), Props, AlternativeItemModal(), InventoryItem (+13 more)

### Community 6 - "Campus Locations, Zones & Landmarks"
Cohesion: 0.12
Nodes (20): browser-image-compression, LOCAL_LANDMARKS, MAINTENANCE_ZONES, MASTER_ZONES, MAZAR_LOCATIONS, SubLocationConfig, SubLocationType, VenueConfig (+12 more)

### Community 7 - "Request Pipeline Visualizer & Tracking"
Cohesion: 0.10
Nodes (14): PERIOD_END_TIMES, StepperProps, VisualPipelineStepper(), ComplaintPhoto, ComplaintRecord, FleetBooking, MaterialReq, ReqItem (+6 more)

### Community 8 - "Event Asset Requester & Time Slots"
Cohesion: 0.20
Nodes (16): AssetRequester(), AssetRequesterProps, AFTER_CLASS_SLOTS, BETWEEN_CLASS_PERIODS, BookingForm(), HeadcountEngine(), EVENT_VENUES, EVENT_ZONES (+8 more)

### Community 9 - "TypeScript App Compiler Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 10 - "Developer Tooling & Build Plugins"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+10 more)

### Community 11 - "TypeScript Node & Vite Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "PWA Web App Manifest"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, id, name, orientation (+4 more)

### Community 13 - "Siyanat Operations & Maintenance Routing"
Cohesion: 0.29
Nodes (7): SiyanatOperations, CAMPUS_ZONES, MaintenanceRouting(), SiyanatOperations(), generateJobSheet(), JobSheetComplaint, JobSheetTechnician

## Knowledge Gaps
- **8 isolated node(s):** `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom`, `autoprefixer` (+3 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 175 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Material Requisitions & Direct PO Modals` to `App Shell & Core Navigation`, `System Configuration & Bulk Inventory`, `Project Dependencies & Tooling`, `Routing, Auth Guards & Global Actions`, `Events Approvals & Department Handoff`, `Campus Locations, Zones & Landmarks`, `Request Pipeline Visualizer & Tracking`, `Event Asset Requester & Time Slots`, `Siyanat Operations & Maintenance Routing`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **What connects `@types/node`, `@types/papaparse`, `@types/react` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Core Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.0797872340425532 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Events Approvals & Department Handoff` to `App Shell & Core Navigation`, `System Configuration & Bulk Inventory`, `Project Dependencies & Tooling`, `Routing, Auth Guards & Global Actions`, `Material Requisitions & Direct PO Modals`, `Campus Locations, Zones & Landmarks`, `Request Pipeline Visualizer & Tracking`, `Event Asset Requester & Time Slots`, `Siyanat Operations & Maintenance Routing`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Should `System Configuration & Bulk Inventory` be split into smaller, more focused modules?**
  _Cohesion score 0.08637873754152824 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `Developer Tooling & Build Plugins` to `Project Dependencies & Tooling`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `Project Dependencies & Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.06258890469416785 - nodes in this community are weakly interconnected._