# Obision Store - AI Agent Guide

GNOME GTK4/Libadwaita application store manager using TypeScript with GJS runtime.

## Architecture Overview

**Three-tier architecture**:
1. **Services**: Singleton business logic with pub/sub pattern (`src/services/`)
2. **Components**: UI components with lifecycle management (`src/components/`)
3. **Interfaces**: Shared TypeScript types (`src/interfaces/`)

**Package management delegation**: `PackagesService` coordinates between `DebianService` (AppStream) and `FlatpakService`, with persistent caching via `CacheService`.

## Architecture Patterns

### Service Layer (Singleton + Pub/Sub)
All services follow a singleton pattern with subscription-based updates:
```typescript
class AppsService {
    private static _instance: AppsService;
    private dataCallbacks: Array<(data: AppsData) => void> = [];
    
    public static get instance(): AppsService { /* singleton */ }
    public subscribeToUpdates(callback: (data: AppsData) => void): void { /* pub/sub */ }
    public unsubscribe(callback: (data: AppsData) => void): void { /* cleanup */ }
}
```
Services: `apps-service`, `categories-service`, `updates-service`, `cache-service`, `packages-service` (coordinator), `debian-service`, `flatpak-service`, `settings-service`, `utils-service`.

### Component Lifecycle (Activate/Deactivate)
Components implement `activate()`/`deactivate()` to manage subscriptions efficiently:
- `activate()`: Subscribe to cache/service updates when component becomes visible
- `deactivate()`: Unsubscribe to prevent memory leaks and unnecessary updates
- Components track `isActive` boolean to manage subscription state
- Triggered by `Gtk.Stack` navigation: `stack.connect('notify::visible-child-name', ...)`
- **Pattern**: Store callback reference (`this.cacheUpdateCallback`) to enable proper unsubscription
- Reference: `src/components/featured.ts` lines 88-108

### UI Loading Pattern
Components use GTK Builder to load `.ui` files from GResources:
```typescript
const builder = new Gtk.Builder();
builder.add_from_resource('/obision/app/store/ui/featured.ui');
const widget = builder.get_object('WidgetId') as Gtk.Widget;
```
**Critical**: UI files must be registered in `data/obision.app.store.gresource.xml` before being accessible.

## Critical Build Process

### Two-Stage Build System
1. **TypeScript → JavaScript**: `tsc` (target: ES2022, module: ESNext) compiles to `builddir/`
2. **JavaScript → GJS Bundle**: `scripts/build.js` creates a single GJS-compatible file
   - **Strips all ES module syntax**: Removes `import`/`export` statements completely
   - **Removes TypeScript artifacts**: Cleans up `Object.defineProperty(exports, "__esModule")`
   - **Injects GJS runtime headers**: Adds `imports.gi` declarations for Gtk, Adw, Gio, GLib, etc.
   - **Combines in dependency order**: constants → settings-service → utils-service → apps-service → categories-service → remaining services → components → main
   - **Normalizes service references**: Converts `apps_service_1.AppsService` to `AppsService`

**Key insight**: GJS doesn't support ES modules. The build script creates `builddir/main.js` as a single concatenated file with all code in dependency order. See `scripts/build.js` lines 60-325 for transformation logic.

### Development Workflow
```bash
npm run build     # Full: TypeScript → GJS bundle → GResource → GSettings
npm run dev       # Watch TypeScript only (MUST run build after to see changes)
npm start         # Build + run with local resources (GSETTINGS_SCHEMA_DIR=builddir/data)
npm run clean     # Remove builddir/ and mesonbuilddir/
```

### System Installation (Meson)
```bash
npm run meson-setup     # meson setup mesonbuilddir --prefix=/usr
npm run meson-compile   # Build system package
npm run meson-install   # FULL: build → setup → compile → install to /usr/bin/obision-app-store
npm run meson-uninstall # Remove system installation
```
**Critical**: `meson-install` runs full `npm run build` first - `builddir/main.js` must exist.

## GResource System

UI files, CSS, and icons are bundled into `obision.app.store.gresource`:
- **Definition**: `data/obision.app.store.gresource.xml` lists all resources
- **Access pattern**: `/obision/app/store/ui/main.ui` (prefix + relative path)
- **Compilation**: `glib-compile-resources` creates binary `builddir/obision.app.store.gresource`
- **Registration**: `Gio.resources_register(Gio.Resource.load('builddir/...'))`  in `main.ts`
- **Add new resource**: Edit XML → rebuild → resource becomes accessible

## Type System & GJS Bindings

**Dual environment**: TypeScript at build time, GJS at runtime
- **TypeScript imports**: `import Gtk from '@girs/gtk-4.0'` (from `@girs/*` npm packages)
- **Runtime bindings**: `const { Gtk } = imports.gi` (injected by `scripts/build.js` header)
- **Type casting**: Always required: `builder.get_object('id') as Gtk.Widget`
- **Version pinning**: `imports.gi.versions.Gtk = '4.0'` in GJS header ensures GTK4

Dependencies: `@girs/gtk-4.0`, `@girs/adw-1`, `@girs/gio-2.0`, `@girs/glib-2.0`, `@girs/gobject-2.0`

## Navigation & State Management

**Stack-based navigation** manages multiple views:
- `Gtk.Stack` holds all pages: `stack.add_named(component.getWidget(), 'featured')`
- Navigation: `stack.set_visible_child_name('page-name')`
- Lifecycle hook: `stack.connect('notify::visible-child-name', () => { ... })`
- Components activate/deactivate based on visibility: check `stack.get_visible_child_name()`
- Main navigation managed in `src/main.ts` lines 95-105

## Cache Strategy

`CacheService` provides **persistent disk cache** with infinite duration:
- **Never expires**: Cache only updates via manual subscription notifications
- **Storage**: `~/.cache/obision-app-store/packages-cache.json` (JSON format)
- **Subscription pattern**: `cacheService.subscribe(key, callback)` / `unsubscribe(key, callback)`
- **Key format**: `getCacheKey(source, packageName)` (e.g., `"debian:firefox"`)
- **Background save**: `GLib.idle_add()` writes async to avoid blocking UI
- Reference: `src/services/cache-service.ts`

## Adding New Components

1. Create TypeScript file in `src/components/`
2. Create UI file in `data/ui/` and register in `gresource.xml`
3. Implement `activate()`/`deactivate()` lifecycle methods
4. Export `getWidget()` returning root GTK widget
5. Add to main.ts: instantiate, add to stack, wire navigation
6. Update `scripts/build.js` to include in bundle (order matters!)

## Common Pitfalls

- **Import/export**: Don't rely on ES modules at runtime - build script removes them
- **File order**: Services must be bundled before components that use them
- **Resource paths**: Use `/obision/app/store/` prefix, not relative paths
- **GSettings**: Schemas must be compiled with `glib-compile-schemas data/`
- **Memory leaks**: Always unsubscribe in `deactivate()` to prevent callback accumulation
