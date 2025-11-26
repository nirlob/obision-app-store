import GLib from "@girs/glib-2.0";
import { AppsService } from "./apps-service";
import { Update, UpdatesData } from "../interfaces/update";

export class UpdatesService {
    private static _instance: UpdatesService;
    private appsService: AppsService;
    private dataCallbacks: Array<(data: UpdatesData) => void> = [];
    private updateTimeoutId: number | null = null;

    private constructor() {
        this.appsService = AppsService.instance;
    }

    public static get instance(): UpdatesService {
        if (!UpdatesService._instance) {
            UpdatesService._instance = new UpdatesService();
        }
        return UpdatesService._instance;
    }

    public subscribeToUpdates(callback: (data: UpdatesData) => void): void {
        this.dataCallbacks.push(callback);
        
        if (this.dataCallbacks.length === 1) {
            this.startUpdateLoop();
        }
        
        this.checkForUpdates();
    }

    public unsubscribe(callback: (data: UpdatesData) => void): void {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
        
        if (this.dataCallbacks.length === 0) {
            this.stopUpdateLoop();
        }
    }

    public checkForUpdates(): void {
        const installedApps = this.appsService.getInstalledApps();
        const updates: Update[] = installedApps
            .filter(app => app.hasUpdate)
            .map(app => ({
                appId: app.id,
                appName: app.name,
                currentVersion: app.version,
                newVersion: this.getNewVersion(app.version),
                size: Math.floor(app.size * 0.3), // Update size is typically ~30% of app size
                changelog: `Bug fixes and performance improvements for ${app.name}`,
                icon: app.icon
            }));

        const data: UpdatesData = {
            updates,
            totalCount: updates.length
        };

        this.dataCallbacks.forEach(callback => callback(data));
    }

    public updateApp(appId: string): boolean {
        const app = this.appsService.getAppById(appId);
        if (app && app.hasUpdate) {
            app.hasUpdate = false;
            app.version = this.getNewVersion(app.version);
            this.checkForUpdates();
            return true;
        }
        return false;
    }

    public updateAll(): void {
        const installedApps = this.appsService.getInstalledApps();
        installedApps.forEach(app => {
            if (app.hasUpdate) {
                app.hasUpdate = false;
                app.version = this.getNewVersion(app.version);
            }
        });
        this.checkForUpdates();
    }

    private getNewVersion(currentVersion: string): string {
        const parts = currentVersion.split('.');
        if (parts.length > 0) {
            const last = parseInt(parts[parts.length - 1]) + 1;
            parts[parts.length - 1] = last.toString();
            return parts.join('.');
        }
        return currentVersion;
    }

    private startUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            return;
        }

        // Check for updates every 30 minutes
        this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1800000, () => {
            this.checkForUpdates();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private stopUpdateLoop(): void {
        if (this.updateTimeoutId !== null) {
            GLib.source_remove(this.updateTimeoutId);
            this.updateTimeoutId = null;
        }
    }
}
