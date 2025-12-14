# Obision Store - AI Agent Guide

GNOME GTK4/Libadwaita application store manager using TypeScript with GJS runtime.

## Architecture Patterns

### Service Layer (Singleton + Pub/Sub)
All services follow a singleton pattern with subscription-based updates:
```typescript
class AppsService {
    private static _instance: AppsService;
    private dataCallbacks: Array<(data: AppsData) => void> = [];
    
    public static get instance(): AppsService { /* singleton */ }
    public subscribeToUpdates(callback: (data: AppsData) => void): void { /* pub/sub */ }
}
```
Services: `apps-service`, `categories-service`, `updates-service`, `cache-service`, `packages-service`, `settings-service`, `utils-service`.

### Component Lifecycle (Activate/Deactivate)
Components implement `activate()`/`deactivate()` to manage subscriptions efficiently:
- `activate()`: Subscribe to cache/service updates when component becomes visible
- `deactivate()`: Unsubscribe to prevent memory leaks and unnecessary updates
- See `src/components/featured.ts` for reference implementation

### UI Loading Pattern
Components use GTK Builder to load `.ui` files from GResources:
```typescript
const builder = new Gtk.Builder();
builder.add_from_resource('/com/obision/ObisionStore/ui/featured.ui');
const widget = builder.get_object('WidgetId') as Gtk.Widget;
```

## Critical Build Process

### Two-Stage Build System
1. **TypeScript → JavaScript**: `tsc` compiles TypeScript to ESNext modules
2. **JavaScript → GJS Bundle**: `scripts/build.js` creates a single GJS-compatible file
   - Strips all import/export statements
   - Removes TypeScript artifacts
   - Injects GJS runtime headers
   - Combines files in dependency order: constants → services → components → main

**Key insight**: GJS doesn't support ES modules. The build script creates a single file with all code concatenated in the correct order.

### Development Commands
- `npm run build`: Full build (TypeScript + GJS conversion + GResource compilation)
- `npm run dev`: Watch mode for TypeScript only (requires separate `npm run build` after)
- `npm start`: Build and run with local resources from `builddir/`

### Installation Commands  
- `npm run meson-install`: System-wide installation to `/usr/bin/obision-store`
- Requires prior `npm run build` to generate `builddir/main.js`

## GResource System

UI files, CSS, and icons are bundled into `com.obision.ObisionStore.gresource`:
- Defined in `data/com.obision.ObisionStore.gresource.xml`
- Accessed via resource paths: `/com/obision/ObisionStore/ui/main.ui`
- Compiled by `glib-compile-resources` during build
- Must register in app: `Gio.resources_register(resource)`

## Type System & GJS Bindings

Uses `@girs/*` packages for GTK/Adwaita TypeScript types:
- Import style: `import Gtk from '@girs/gtk-4.0'`
- Type casting required: `builder.get_object('id') as Gtk.Widget`
- GJS bindings available at runtime via `imports.gi` (injected by build script)

## Navigation & State Management

Navigation uses `Gtk.Stack` for page switching:
- Pages added with `stack.add_named(component.getWidget(), 'page-name')`
- Stack change triggers component lifecycle: `stack.connect('notify::visible-child-name', ...)`
- Components must track `isActive` state to manage subscriptions

## Cache Strategy

`CacheService` provides persistent disk cache with infinite duration:
- Cache never expires, only updates manually via subscriptions
- Stored in `~/.cache/obision-store/packages-cache.json`
- Components subscribe to specific cache keys: `cacheService.subscribe(key, callback)`

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
- **Resource paths**: Use `/com/obision/ObisionStore/` prefix, not relative paths
- **GSettings**: Schemas must be compiled with `glib-compile-schemas data/`
- **Memory leaks**: Always unsubscribe in `deactivate()` to prevent callback accumulation
