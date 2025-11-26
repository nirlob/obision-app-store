import GLib from "@girs/glib-2.0";
import { UtilsService } from "./utils-service";
import { Application, AppsData } from "../interfaces/application";

export class AppsService {
    private static _instance: AppsService;
    private utils: UtilsService;
    private dataCallbacks: Array<(data: AppsData) => void> = [];
    private apps: Application[] = [];
    private currentFilter: string = '';
    private currentCategory: string = '';

    private constructor() {
        this.utils = UtilsService.instance;
        this.loadMockData();
    }

    public static get instance(): AppsService {
        if (!AppsService._instance) {
            AppsService._instance = new AppsService();
        }
        return AppsService._instance;
    }

    public subscribeToUpdates(callback: (data: AppsData) => void): void {
        this.dataCallbacks.push(callback);
        this.notifyCallbacks();
    }

    public unsubscribe(callback: (data: AppsData) => void): void {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
    }

    public searchApps(query: string): void {
        this.currentFilter = query.toLowerCase();
        this.notifyCallbacks();
    }

    public filterByCategory(category: string): void {
        this.currentCategory = category;
        this.notifyCallbacks();
    }

    public getFeaturedApps(): Application[] {
        return this.apps.filter(app => app.rating >= 4.5).slice(0, 6);
    }

    public getInstalledApps(): Application[] {
        return this.apps.filter(app => app.installed);
    }

    public installApp(appId: string): boolean {
        const app = this.apps.find(a => a.id === appId);
        if (app) {
            app.installed = true;
            this.notifyCallbacks();
            return true;
        }
        return false;
    }

    public removeApp(appId: string): boolean {
        const app = this.apps.find(a => a.id === appId);
        if (app) {
            app.installed = false;
            this.notifyCallbacks();
            return true;
        }
        return false;
    }

    public getAppById(appId: string): Application | undefined {
        return this.apps.find(a => a.id === appId);
    }

    private notifyCallbacks(): void {
        let filteredApps = this.apps;

        if (this.currentFilter) {
            filteredApps = filteredApps.filter(app =>
                app.name.toLowerCase().includes(this.currentFilter) ||
                app.summary.toLowerCase().includes(this.currentFilter) ||
                app.category.toLowerCase().includes(this.currentFilter)
            );
        }

        if (this.currentCategory) {
            filteredApps = filteredApps.filter(app =>
                app.category === this.currentCategory
            );
        }

        const data: AppsData = {
            apps: filteredApps,
            totalCount: filteredApps.length
        };

        this.dataCallbacks.forEach(callback => callback(data));
    }

    private loadMockData(): void {
        // Mock data for demonstration
        this.apps = [
            {
                id: 'org.gnome.Builder',
                name: 'GNOME Builder',
                summary: 'IDE for GNOME',
                description: 'Builder is a powerful IDE for creating GNOME applications.',
                icon: 'org.gnome.Builder',
                version: '44.0',
                size: 45000000,
                category: 'Development',
                developer: 'GNOME Foundation',
                license: 'GPL-3.0',
                homepage: 'https://wiki.gnome.org/Apps/Builder',
                screenshots: [],
                installed: false,
                hasUpdate: false,
                rating: 4.8,
                downloads: 50000
            },
            {
                id: 'org.inkscape.Inkscape',
                name: 'Inkscape',
                summary: 'Vector graphics editor',
                description: 'Professional vector graphics editor for Linux, Windows and macOS.',
                icon: 'org.inkscape.Inkscape',
                version: '1.3',
                size: 120000000,
                category: 'Graphics',
                developer: 'Inkscape Team',
                license: 'GPL-3.0',
                homepage: 'https://inkscape.org',
                screenshots: [],
                installed: true,
                hasUpdate: false,
                rating: 4.9,
                downloads: 1000000
            },
            {
                id: 'org.gimp.GIMP',
                name: 'GIMP',
                summary: 'Image editor',
                description: 'GNU Image Manipulation Program',
                icon: 'org.gimp.GIMP',
                version: '2.10',
                size: 95000000,
                category: 'Graphics',
                developer: 'GIMP Team',
                license: 'GPL-3.0',
                homepage: 'https://www.gimp.org',
                screenshots: [],
                installed: true,
                hasUpdate: true,
                rating: 4.7,
                downloads: 5000000
            },
            {
                id: 'com.valvesoftware.Steam',
                name: 'Steam',
                summary: 'Gaming platform',
                description: 'Digital distribution platform for games',
                icon: 'com.valvesoftware.Steam',
                version: '1.0.0.78',
                size: 250000000,
                category: 'Games',
                developer: 'Valve',
                license: 'Proprietary',
                homepage: 'https://store.steampowered.com',
                screenshots: [],
                installed: false,
                hasUpdate: false,
                rating: 4.6,
                downloads: 10000000
            }
        ];
    }
}
