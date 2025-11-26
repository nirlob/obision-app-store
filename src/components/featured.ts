import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import GLib from '@girs/glib-2.0';
import Gio from '@girs/gio-2.0';
import GdkPixbuf from '@girs/gdkpixbuf-2.0';
import Gdk from '@girs/gdk-4.0';
import { PackagesService } from '../services/packages-service';
import { CacheService } from '../services/cache-service';
import { PackageInfo } from '../interfaces/package';
import { AppCardCarousel } from './atoms/app-card-carousel';
import { AppCardMini } from './atoms/app-card-mini';
import { CATEGORY_COLORS } from '../constants/theme';

export class FeaturedComponent {
    private container: Gtk.Stack;
    private carousel!: Adw.Carousel;
    private appsGrid!: Gtk.Grid;
    private prevButton!: Gtk.Button;
    private nextButton!: Gtk.Button;
    private packagesService: PackagesService;
    private cacheService: CacheService;
    private packageKeys: string[] = [];
    private isActive: boolean = false;
    private cacheUpdateCallback: ((key: string, data: PackageInfo[]) => void) | null = null;

    constructor() {
        this.packagesService = PackagesService.instance;
        this.cacheService = CacheService.instance;
        
        // Load UI from file
        this.container = this.loadUI();
    }

    private loadUI(): Gtk.Stack {
        const builder = new Gtk.Builder();
        builder.add_from_resource('/com/obision/ObisionStore/ui/featured.ui');
        
        const stack = builder.get_object('FeaturedView') as Gtk.Stack;
        this.carousel = builder.get_object('featured_carousel') as Adw.Carousel;
        this.appsGrid = builder.get_object('apps_grid') as Gtk.Grid;
        this.prevButton = builder.get_object('prev_button') as Gtk.Button;
        this.nextButton = builder.get_object('next_button') as Gtk.Button;
        
        // Connect navigation buttons
        this.prevButton.connect('clicked', () => {
            const currentPage = this.carousel.get_position();
            const targetPage = Math.floor(currentPage) - 1;
            if (targetPage >= 0) {
                this.carousel.scroll_to(this.carousel.get_nth_page(targetPage), true);
            }
        });

        this.nextButton.connect('clicked', () => {
            const currentPage = this.carousel.get_position();
            const targetPage = Math.floor(currentPage) + 1;
            const nPages = this.carousel.get_n_pages();
            if (targetPage < nPages) {
                this.carousel.scroll_to(this.carousel.get_nth_page(targetPage), true);
            }
        });
        
        stack.set_visible_child_name('loading');
        
        return stack;
    }

    public async load(): Promise<void> {
        // Wait for AppStream cache to be ready
        await this.packagesService.waitForAppStreamCache();
        this.loadFeaturedApps();
    }

    public activate(): void {
        this.isActive = true;
        
        // Subscribe to cache updates when component becomes active
        if (this.cacheUpdateCallback === null) {
            this.cacheUpdateCallback = this.onCacheUpdate.bind(this);
            for (const key of this.packageKeys) {
                this.cacheService.subscribe(key, this.cacheUpdateCallback);
            }
            console.log('Featured component activated - subscribed to cache updates');
        }
    }

    public deactivate(): void {
        this.isActive = false;
        
        // Unsubscribe from cache updates when component is not active
        if (this.cacheUpdateCallback !== null) {
            for (const key of this.packageKeys) {
                this.cacheService.unsubscribe(key, this.cacheUpdateCallback);
            }
            console.log('Featured component deactivated - unsubscribed from cache updates');
        }
    }

    private loadFeaturedApps(): void {
        // Featured packages to display in carousel
        const featuredPackageNames = [
            'firefox-esr',
            'gimp',
            'vlc',
            'libreoffice',
            'inkscape',
            'blender'
        ];

        // Popular apps to display in list
        const popularPackageNames = [
            'thunderbird',
            'chromium',
            'code',
            'telegram-desktop',
            'spotify-client',
            'discord',
            'audacity',
            'obs-studio',
            'krita',
            'kdenlive',
            'handbrake',
            'transmission',
            'filezilla',
            'vim',
            'git',
            'docker.io',
            'virtualbox',
            'qbittorrent',
            'steam',
            'wine'
        ];

        // Store cache keys for subscription
        for (const packageName of featuredPackageNames) {
            const cacheKey = this.cacheService.getCacheKey('debian', packageName);
            this.packageKeys.push(cacheKey);
        }

        const loadedPackages: PackageInfo[] = [];
        const popularPackages: PackageInfo[] = [];
        let index = 0;
        
        // Load packages one by one asynchronously
        const loadNext = () => {
            if (index >= featuredPackageNames.length) {
                // All loaded, group in pairs and add to carousel
                for (let i = 0; i < loadedPackages.length; i += 2) {
                    const page = new Gtk.Box({
                        orientation: Gtk.Orientation.HORIZONTAL,
                        spacing: 12,
                        homogeneous: false,
                        hexpand: true,
                        vexpand: false,
                        valign: Gtk.Align.START,
                        margin_start: 0,
                        margin_end: 0,
                    });
                    
                    // Add first card with margin
                    const card1Box = new Gtk.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        hexpand: true,
                        margin_end: 6,
                    });
                    const card1 = this.createFeaturedCard(loadedPackages[i]);
                    card1Box.append(card1);
                    page.append(card1Box);
                    
                    // Add second card if exists
                    if (i + 1 < loadedPackages.length) {
                        const card2Box = new Gtk.Box({
                            orientation: Gtk.Orientation.VERTICAL,
                            hexpand: true,
                            margin_start: 6,
                        });
                        const card2 = this.createFeaturedCard(loadedPackages[i + 1]);
                        card2Box.append(card2);
                        page.append(card2Box);
                    }
                    
                    this.carousel.append(page);
                }
                
                // Now load popular apps
                this.loadPopularApps(popularPackageNames);
                this.container.set_visible_child_name('content');
                return GLib.SOURCE_REMOVE;
            }
            
            const packageName = featuredPackageNames[index];
            index++;
            
            // Load package asynchronously
            this.packagesService.searchDebianPackagesAsync(packageName).then(packages => {
                if (packages.length > 0) {
                    loadedPackages.push(packages[0]);
                }
                // Schedule next package
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, loadNext);
            }).catch(error => {
                console.error(`Error loading package ${packageName}:`, error);
                // Continue with next package even on error
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, loadNext);
            });
            
            return GLib.SOURCE_REMOVE;
        };
        
        // Start loading
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, loadNext);
    }

    private loadPopularApps(packageNames: string[]): void {
        const loadedApps: PackageInfo[] = [];
        let index = 0;
        
        const loadNext = () => {
            if (index >= packageNames.length) {
                // All loaded, arrange in grid with 5 apps per row
                this.arrangeAppsInGrid(loadedApps);
                return GLib.SOURCE_REMOVE;
            }
            
            const packageName = packageNames[index];
            index++;
            
            this.packagesService.searchDebianPackagesAsync(packageName).then(packages => {
                if (packages.length > 0) {
                    loadedApps.push(packages[0]);
                }
                // Schedule next package
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, loadNext);
            }).catch(error => {
                console.error(`Error loading package ${packageName}:`, error);
                // Continue with next package even on error
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, loadNext);
            });
            
            return GLib.SOURCE_REMOVE;
        };
        
        // Start loading
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, loadNext);
    }

    private arrangeAppsInGrid(apps: PackageInfo[]): void {
        const columns = 4;
        
        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            const row = Math.floor(i / columns);
            const col = i % columns;
            
            const cardComponent = new AppCardMini({
                app,
                onInstall: async (appId: string) => {
                    await this.packagesService.installDebianPackage(appId);
                }
            });
            
            this.appsGrid.attach(cardComponent.getWidget(), col, row, 1, 1);
        }
    }

    private onCacheUpdate(key: string, data: PackageInfo[]): void {
        // Only reload if component is currently active/visible
        if (!this.isActive) {
            console.log(`Featured component received cache update for ${key}, but component is not active - skipping reload`);
            return;
        }
        
        console.log(`Featured component received cache update for ${key}, reloading carousel...`);
        
        // Clear current carousel
        let child = this.carousel.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this.carousel.remove(child);
            child = next;
        }
        
        // Reload with updated data in pairs
        for (let i = 0; i < data.length; i += 2) {
            const page = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                homogeneous: false,
                hexpand: true,
                vexpand: false,
                valign: Gtk.Align.START,
                margin_start: 0,
                margin_end: 0,
            });
            
            const card1Box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                hexpand: true,
                margin_end: 6,
            });
            const card1 = this.createFeaturedCard(data[i]);
            card1Box.append(card1);
            page.append(card1Box);
            
            if (i + 1 < data.length) {
                const card2Box = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    hexpand: true,
                    margin_start: 6,
                });
                const card2 = this.createFeaturedCard(data[i + 1]);
                card2Box.append(card2);
                page.append(card2Box);
            }
            
            this.carousel.append(page);
        }
    }

    private createFeaturedCard(app: PackageInfo): Gtk.Widget {
        const cardComponent = new AppCardCarousel({
            app,
            onInstall: async (appId: string) => {
                await this.packagesService.installDebianPackage(appId);
            }
        });

        // Wrap card with background and watermark
        const category = app.category || 'default';
        return this.addBackgroundWithWatermark(cardComponent.getWidget(), category);
    }

    private addBackgroundWithWatermark(card: Gtk.Widget, category: string): Gtk.Widget {
        const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
        
        // Create container with colored background
        const container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: false,
            valign: Gtk.Align.START,
            overflow: Gtk.Overflow.HIDDEN,
        });
        
        // Apply CSS for background color with rounded corners
        const cssProvider = new Gtk.CssProvider();
        const css = `box { background-color: ${color}; padding: 8px; margin: 0; border-radius: 10px; border: none; }`;
        cssProvider.load_from_data(css, css.length);
        
        const styleContext = container.get_style_context();
        styleContext.add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        
        // Create DrawingArea for watermark pattern with fixed height
        const watermark = new Gtk.DrawingArea({
            hexpand: true,
            vexpand: false,
            height_request: 184,
        });
        
        watermark.set_draw_func((area: Gtk.DrawingArea, cr: any, width: number, height: number) => {
            // Draw ~50 randomly positioned outline icons
            cr.setSourceRGBA(1, 1, 1, 0.10); // More subtle for many icons
            cr.setLineWidth(2);
            
            const iconSize = 48;
            const iconCount = 50;
            
            // Generate many random positions
            const positions = this.getIconPositions(category, width, height, iconSize, iconCount);
            
            positions.forEach((pos, index) => {
                // Vary icon type within category
                this.drawCategoryIcon(cr, pos.x, pos.y, iconSize, category, index);
            });
        });
        
        // Use overlay to layer: watermark in back, card content on top
        const overlay = new Gtk.Overlay();
        overlay.set_child(watermark);
        overlay.add_overlay(card);
        
        container.append(overlay);
        
        return container;
    }

    private getIconPositions(category: string, width: number, height: number, iconSize: number, count: number): Array<{x: number, y: number}> {
        // Generate many random but deterministic positions
        const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const positions = [];
        
        for (let i = 0; i < count; i++) {
            // Create diverse pseudo-random positions using linear congruential generator
            const seed = (hash + i) * 1103515245 + 12345;
            const x = (seed % (width - iconSize)) + iconSize / 2;
            const y = ((seed >> 8) % (height - iconSize)) + iconSize / 2;
            
            positions.push({ x, y });
        }
        
        return positions;
    }

    private drawCategoryIcon(cr: any, x: number, y: number, size: number, category: string, variant: number): void {
        cr.save();
        cr.translate(x, y);
        
        const half = size / 2;
        const quarter = size / 4;
        const iconType = variant % 8; // 8 different icon types per category
        
        switch (category) {
            case 'Internet':
                this.drawInternetIcon(cr, iconType, half, quarter);
                break;
            case 'Graphics':
                this.drawGraphicsIcon(cr, iconType, half, quarter);
                break;
            case 'AudioVideo':
                this.drawAudioVideoIcon(cr, iconType, half, quarter);
                break;
            case 'Office':
                this.drawOfficeIcon(cr, iconType, half, quarter);
                break;
            case 'Development':
                this.drawDevelopmentIcon(cr, iconType, half, quarter);
                break;
            case 'Game':
                this.drawGameIcon(cr, iconType, half, quarter);
                break;
            default:
                this.drawDefaultIcon(cr, iconType, half, quarter);
                break;
        }
        
        cr.restore();
    }

    private drawInternetIcon(cr: any, type: number, half: number, quarter: number): void {
        switch (type) {
            case 0: // Globe
                cr.arc(half, half, quarter + 2, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 1: // WiFi signal
                cr.arc(half, half + quarter, quarter, -Math.PI, 0);
                cr.stroke();
                cr.arc(half, half + quarter, quarter - 4, -Math.PI, 0);
                cr.stroke();
                break;
            case 2: // Cloud
                cr.arc(quarter + 4, half, 5, 0, 2 * Math.PI);
                cr.stroke();
                cr.arc(half, half - 2, 6, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 3: // Network nodes
                cr.arc(quarter, quarter, 3, 0, 2 * Math.PI);
                cr.stroke();
                cr.arc(half + quarter, quarter, 3, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(quarter, quarter);
                cr.lineTo(half + quarter, quarter);
                cr.stroke();
                break;
            case 4: // Mail envelope
                cr.rectangle(quarter - 4, half - 6, half + 8, quarter + 2);
                cr.stroke();
                cr.moveTo(quarter - 4, half - 6);
                cr.lineTo(half, half + 4);
                cr.lineTo(half + quarter + 4, half - 6);
                cr.stroke();
                break;
            case 5: // Link chain
                cr.arc(quarter + 4, half, 4, 0, 2 * Math.PI);
                cr.stroke();
                cr.arc(half + quarter - 4, half, 4, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(quarter + 6, half);
                cr.lineTo(half + quarter - 6, half);
                cr.stroke();
                break;
            case 6: // Download arrow
                cr.moveTo(half, quarter);
                cr.lineTo(half, half + quarter);
                cr.stroke();
                cr.moveTo(quarter + 4, half + 4);
                cr.lineTo(half, half + quarter);
                cr.lineTo(half + quarter - 4, half + 4);
                cr.stroke();
                break;
            default: // Antenna
                cr.moveTo(half, half + quarter);
                cr.lineTo(half, quarter);
                cr.stroke();
                cr.arc(half, quarter, 8, 0.8, Math.PI - 0.8);
                cr.stroke();
                break;
        }
    }

    private drawGraphicsIcon(cr: any, type: number, half: number, quarter: number): void {
        switch (type) {
            case 0: // Brush
                cr.moveTo(quarter, half + quarter);
                cr.lineTo(half + quarter, quarter);
                cr.stroke();
                break;
            case 1: // Palette
                cr.arc(half, half, quarter + 2, 0, 2 * Math.PI);
                cr.stroke();
                cr.arc(half - 4, half - 4, 2, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 2: // Pencil
                cr.moveTo(quarter, half + quarter);
                cr.lineTo(half + quarter, quarter);
                cr.moveTo(half + quarter - 6, quarter + 6);
                cr.lineTo(half + quarter, quarter);
                cr.stroke();
                break;
            case 3: // Color picker
                cr.arc(half, half, quarter, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(half, quarter);
                cr.lineTo(half, half + quarter);
                cr.stroke();
                break;
            case 4: // Crop tool
                cr.rectangle(quarter, quarter, half, half);
                cr.stroke();
                break;
            case 5: // Layers
                cr.rectangle(quarter, quarter + 4, half, quarter);
                cr.stroke();
                cr.rectangle(quarter + 4, quarter, half, quarter);
                cr.stroke();
                break;
            case 6: // Star (vector shape)
                cr.moveTo(half, quarter);
                cr.lineTo(half + 3, half - 2);
                cr.lineTo(half + quarter, half);
                cr.lineTo(half + 4, half + 2);
                cr.lineTo(half + 6, half + quarter);
                cr.lineTo(half, half + 4);
                cr.lineTo(quarter, half + quarter);
                cr.lineTo(half - 4, half + 2);
                cr.lineTo(quarter - 2, half);
                cr.lineTo(half - 3, half - 2);
                cr.closePath();
                cr.stroke();
                break;
            default: // Image frame
                cr.rectangle(quarter - 2, quarter - 2, half + 4, half + 4);
                cr.stroke();
                cr.moveTo(quarter - 2, half + quarter + 2);
                cr.lineTo(half, half);
                cr.lineTo(half + quarter + 2, half + quarter + 2);
                cr.stroke();
                break;
        }
    }

    private drawAudioVideoIcon(cr: any, type: number, half: number, quarter: number): void {
        switch (type) {
            case 0: // Music note
                cr.arc(quarter + 4, half + 6, 4, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(quarter + 8, half + 6);
                cr.lineTo(quarter + 8, quarter);
                cr.stroke();
                break;
            case 1: // Play button
                cr.moveTo(quarter, quarter);
                cr.lineTo(quarter, half + quarter);
                cr.lineTo(half + quarter, half);
                cr.closePath();
                cr.stroke();
                break;
            case 2: // Headphones
                cr.arc(half, quarter + 6, quarter, Math.PI, 0);
                cr.stroke();
                cr.moveTo(quarter, quarter + 6);
                cr.lineTo(quarter, half);
                cr.moveTo(half + quarter, quarter + 6);
                cr.lineTo(half + quarter, half);
                cr.stroke();
                break;
            case 3: // Microphone
                cr.arc(half, half - 4, 6, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(half, half + 2);
                cr.lineTo(half, half + quarter);
                cr.stroke();
                break;
            case 4: // Speaker
                cr.rectangle(quarter, half - 6, 6, 12);
                cr.stroke();
                cr.arc(half, half, 8, -0.5, 0.5);
                cr.stroke();
                break;
            case 5: // Film strip
                cr.rectangle(quarter, quarter, half, half);
                cr.stroke();
                cr.moveTo(quarter, half - 4);
                cr.lineTo(half + quarter, half - 4);
                cr.stroke();
                break;
            case 6: // Volume waves
                cr.arc(half - 4, half, 8, -0.5, 0.5);
                cr.stroke();
                cr.arc(half - 4, half, 12, -0.5, 0.5);
                cr.stroke();
                break;
            default: // Record button
                cr.arc(half, half, quarter, 0, 2 * Math.PI);
                cr.stroke();
                break;
        }
    }

    private drawOfficeIcon(cr: any, type: number, half: number, quarter: number): void {
        switch (type) {
            case 0: // Document
                cr.rectangle(quarter, quarter, half, half + 4);
                cr.stroke();
                break;
            case 1: // Spreadsheet
                cr.rectangle(quarter, quarter, half, half);
                cr.moveTo(half, quarter);
                cr.lineTo(half, half + quarter);
                cr.moveTo(quarter, half);
                cr.lineTo(half + quarter, half);
                cr.stroke();
                break;
            case 2: // Presentation
                cr.rectangle(quarter, quarter + 4, half, half - 4);
                cr.stroke();
                cr.moveTo(half, half + quarter);
                cr.lineTo(half - 4, half + quarter + 6);
                cr.moveTo(half, half + quarter);
                cr.lineTo(half + 4, half + quarter + 6);
                cr.stroke();
                break;
            case 3: // Calendar
                cr.rectangle(quarter, quarter + 4, half, half);
                cr.stroke();
                cr.moveTo(quarter, quarter + 12);
                cr.lineTo(half + quarter, quarter + 12);
                cr.stroke();
                break;
            case 4: // Folder
                cr.moveTo(quarter, quarter + 6);
                cr.lineTo(quarter, half + quarter);
                cr.lineTo(half + quarter, half + quarter);
                cr.lineTo(half + quarter, quarter + 6);
                cr.lineTo(half - 2, quarter + 6);
                cr.lineTo(half - 6, quarter);
                cr.lineTo(quarter, quarter);
                cr.closePath();
                cr.stroke();
                break;
            case 5: // Paperclip
                cr.arc(half, half + 6, 8, 0, Math.PI);
                cr.stroke();
                cr.moveTo(quarter + 8, half + 6);
                cr.lineTo(quarter + 8, half - 4);
                cr.stroke();
                break;
            case 6: // Checkmark
                cr.moveTo(quarter, half);
                cr.lineTo(half - 2, half + quarter - 2);
                cr.lineTo(half + quarter, quarter + 4);
                cr.stroke();
                break;
            default: // Pen
                cr.moveTo(quarter + 2, half + quarter - 2);
                cr.lineTo(half + quarter - 2, quarter + 2);
                cr.stroke();
                break;
        }
    }

    private drawDevelopmentIcon(cr: any, type: number, half: number, quarter: number): void {
        switch (type) {
            case 0: // Code brackets
                cr.moveTo(quarter + 8, quarter);
                cr.lineTo(quarter, half);
                cr.lineTo(quarter + 8, half + quarter);
                cr.stroke();
                break;
            case 1: // Terminal prompt
                cr.moveTo(quarter, quarter + 4);
                cr.lineTo(quarter + 8, half);
                cr.lineTo(quarter, half + quarter - 4);
                cr.stroke();
                break;
            case 2: // Git branch
                cr.arc(half, quarter + 4, 3, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(half, quarter + 7);
                cr.lineTo(half, half + quarter - 7);
                cr.stroke();
                cr.arc(half, half + quarter - 4, 3, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 3: // Bug
                cr.arc(half, half, quarter - 2, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(quarter + 2, half - 4);
                cr.lineTo(quarter - 4, half - 6);
                cr.stroke();
                break;
            case 4: // Database
                cr.arc(half, quarter + 4, quarter, 0, Math.PI);
                cr.stroke();
                cr.moveTo(quarter, quarter + 4);
                cr.lineTo(quarter, half + 4);
                cr.moveTo(half + quarter, quarter + 4);
                cr.lineTo(half + quarter, half + 4);
                cr.stroke();
                break;
            case 5: // API/Plugin
                cr.rectangle(quarter + 4, quarter + 4, half - 8, half - 8);
                cr.stroke();
                cr.arc(quarter + 4, quarter + 4, 3, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 6: // Function f(x)
                cr.moveTo(quarter + 4, quarter);
                cr.lineTo(quarter, quarter + 6);
                cr.lineTo(quarter + 8, quarter + 6);
                cr.stroke();
                break;
            default: // Curly braces
                cr.moveTo(half - 2, quarter);
                cr.lineTo(quarter + 4, quarter);
                cr.lineTo(quarter + 2, half);
                cr.lineTo(quarter + 4, half + quarter);
                cr.lineTo(half - 2, half + quarter);
                cr.stroke();
                break;
        }
    }

    private drawGameIcon(cr: any, type: number, half: number, quarter: number): void {
        switch (type) {
            case 0: // Gamepad
                cr.arc(quarter + 6, half, 6, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 1: // Dice
                cr.rectangle(quarter + 2, quarter + 2, half - 4, half - 4);
                cr.stroke();
                cr.arc(half, half, 2, 0, 2 * Math.PI);
                cr.stroke();
                break;
            case 2: // Trophy
                cr.moveTo(quarter + 4, quarter + 2);
                cr.lineTo(quarter + 2, half - 2);
                cr.lineTo(half - 6, half - 2);
                cr.lineTo(half - 8, quarter + 2);
                cr.stroke();
                break;
            case 3: // Target/crosshair
                cr.arc(half, half, quarter, 0, 2 * Math.PI);
                cr.stroke();
                cr.moveTo(half, quarter);
                cr.lineTo(half, half + quarter);
                cr.stroke();
                break;
            case 4: // Sword
                cr.moveTo(half, quarter);
                cr.lineTo(half, half + quarter - 4);
                cr.stroke();
                cr.rectangle(half - 6, half + quarter - 8, 12, 4);
                cr.stroke();
                break;
            case 5: // Joystick
                cr.arc(half, half + 6, 8, 0, Math.PI);
                cr.stroke();
                cr.moveTo(half, half - 2);
                cr.lineTo(half, quarter + 2);
                cr.stroke();
                break;
            case 6: // Playing card
                cr.rectangle(quarter + 2, quarter, half - 4, half + 2);
                cr.stroke();
                break;
            default: // D-pad
                cr.moveTo(half, quarter + 2);
                cr.lineTo(half, half + quarter - 2);
                cr.stroke();
                cr.moveTo(quarter + 2, half);
                cr.lineTo(half + quarter - 2, half);
                cr.stroke();
                break;
        }
    }

    private drawDefaultIcon(cr: any, type: number, half: number, quarter: number): void {
        const radius = 4;
        cr.arc(half, half, quarter, 0, 2 * Math.PI);
        cr.stroke();
    }



    public getWidget(): Gtk.Widget {
        return this.container;
    }
}
