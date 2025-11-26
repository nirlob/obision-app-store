# Obision Store

A modern GNOME application store manager built with GTK4, Libadwaita, and TypeScript.

## Features

- **Featured Apps**: Browse curated featured applications
- **Categories**: Explore apps by category (Development, Graphics, Games, etc.)
- **Search**: Find applications quickly
- **Install/Remove**: Manage applications easily
- **Updates**: Check for and install available updates
- **Modern UI**: Built with GTK4 and Libadwaita for a native GNOME experience

## Architecture

- **Service Layer**: Singleton services with subscription pattern
  - AppsService: Application data and operations
  - CategoriesService: Category management
  - UpdatesService: Update checking and installation
  - SettingsService: GSettings integration
  - UtilsService: Common utilities

- **Component Layer**: Reusable UI components
  - FeaturedComponent: Featured apps carousel
  - CategoriesComponent: Category grid
  - AppDetailsComponent: App details view
  - InstalledComponent: Installed apps list
  - UpdatesComponent: Updates list

- **Interfaces**: TypeScript interfaces in separate files

## Development

### Requirements

- Node.js >= 16.0.0
- TypeScript 5.9+
- GTK4 4.0+
- Libadwaita 1.x
- GJS (GNOME JavaScript)

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the application
npm start
```

### Build Scripts

- `npm run build` - Compile TypeScript and process resources
- `npm run dev` - Watch mode for development
- `npm start` - Build and run the application
- `npm run clean` - Clean build directories

### Installation

```bash
# Setup Meson build
npm run meson-setup

# Compile
npm run meson-compile

# Install system-wide
npm run meson-install

# Uninstall
npm run meson-uninstall
```

## Project Structure

```
obision-store/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── components/             # UI components
│   ├── services/               # Business logic
│   └── interfaces/             # TypeScript interfaces
├── data/
│   ├── ui/                     # GTK UI files
│   ├── icons/                  # Application icons
│   ├── style.css               # Custom styles
│   └── *.gschema.xml           # GSettings schema
├── scripts/
│   └── build.js                # Build script
├── package.json
├── tsconfig.json
└── meson.build
```

## License

GPL-3.0
