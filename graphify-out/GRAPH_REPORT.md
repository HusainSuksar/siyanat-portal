# Graph Report - siyanat-portal  (2026-10-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 348 nodes · 878 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `035b60d5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase.ts
- react
- package.json
- App.tsx
- supabase
- BookVehicle.tsx
- BookEvent.tsx
- compilerOptions
- devDependencies
- compilerOptions
- manifest.json
- lucide-react
- MaintenanceRouting.tsx
- roles.ts
- tsconfig.json
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `react` - 53 edges
2. `lucide-react` - 47 edges
3. `supabase` - 47 edges
4. `useAuth()` - 43 edges
5. `useToast()` - 39 edges
6. `App()` - 28 edges
7. `compilerOptions` - 17 edges
8. `compilerOptions` - 15 edges
9. `useSystemConfig()` - 11 edges
10. `react-router-dom` - 11 edges

## Surprising Connections (you probably didn't know these)
- `SystemConfigManager()` --calls--> `useToast()`  [EXTRACTED]
  src/components/admin/SystemConfigManager.tsx → src/hooks/useToast.ts
- `VendorPOEngineProps` --references--> `WorkOrder`  [EXTRACTED]
  src/components/siyanat/VendorPOEngine.tsx → src/types.ts
- `Profile` --references--> `UserRole`  [EXTRACTED]
  src/types.ts → src/utils/roles.ts
- `BulkRestockTab()` --calls--> `useAuth()`  [EXTRACTED]
  src/components/inventory/BulkRestockTab.tsx → src/contexts/AuthContext.tsx
- `BulkRestockTab()` --calls--> `useToast()`  [EXTRACTED]
  src/components/inventory/BulkRestockTab.tsx → src/hooks/useToast.ts

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "supabase.ts"
Cohesion: 0.07
Nodes (35): papaparse, @supabase/supabase-js, TeamManagement, BulkRestockTab(), CatalogTab(), Props, DirectItem, DirectPOModal() (+27 more)

### Community 1 - "react"
Cohesion: 0.10
Nodes (32): react, Props, RestockRow, isAvitItem(), MaterialDispatch(), getDefaultDeliveryDate(), Vendor, VendorPOEngine() (+24 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (34): dependencies, browser-image-compression, lucide-react, papaparse, react, react-dom, react-router-dom, @supabase/supabase-js (+26 more)

### Community 3 - "App.tsx"
Cohesion: 0.10
Nodes (22): react-dom, App(), AssetRegister, DesktopNavigation(), MobileDrawerNavigation(), NotificationManager(), PortalLayout(), ReceptionWatchtower (+14 more)

### Community 4 - "supabase"
Cohesion: 0.16
Nodes (17): react-router-dom, ForcePasswordChange(), GlobalActionController(), InstallAppButton(), urlBase64ToUint8Array(), RoleAwareActionModal(), AuthContext, AuthContextType (+9 more)

### Community 5 - "BookVehicle.tsx"
Cohesion: 0.12
Nodes (20): browser-image-compression, LOCAL_LANDMARKS, MAINTENANCE_ZONES, MASTER_ZONES, MAZAR_LOCATIONS, SubLocationConfig, SubLocationType, VenueConfig (+12 more)

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

### Community 11 - "lucide-react"
Cohesion: 0.36
Nodes (8): lucide-react, BatchDetailsModal(), PERIOD_END_TIMES, StepperProps, VisualPipelineStepper(), MyRequests(), StandardUserDashboard(), BaseEventData

### Community 12 - "MaintenanceRouting.tsx"
Cohesion: 0.29
Nodes (7): SiyanatOperations, CAMPUS_ZONES, MaintenanceRouting(), SiyanatOperations(), generateJobSheet(), JobSheetComplaint, JobSheetTechnician

### Community 13 - "roles.ts"
Cohesion: 0.25
Nodes (3): Profile, ELEVATED_REQUESTER_ROLES, UserRole

## Knowledge Gaps
- **8 isolated node(s):** `autoprefixer`, `postcss`, `tailwindcss`, `@types/node`, `@types/papaparse` (+3 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 161 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `supabase.ts`, `package.json`, `App.tsx`, `supabase`, `BookVehicle.tsx`, `BookEvent.tsx`, `lucide-react`, `MaintenanceRouting.tsx`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **What connects `autoprefixer`, `postcss`, `tailwindcss` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06914893617021277 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `supabase.ts`, `react`, `package.json`, `App.tsx`, `supabase`, `BookVehicle.tsx`, `BookEvent.tsx`, `MaintenanceRouting.tsx`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.09797979797979799 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06258890469416785 - nodes in this community are weakly interconnected._