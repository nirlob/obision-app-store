import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import Gio from '@girs/gio-2.0';
import { AppsService } from '../services/apps-service';
import { AppsData } from '../interfaces/application';
import { CacheService } from '../services/cache-service';
import { PackageInfo } from '../interfaces/package';

export class InstalledComponent {
    private container: Gtk.Box;
    private appsService: AppsService;
    private cacheService: CacheService;
    private listBox!: Gtk.ListBox;
    private dataCallback!: (data: AppsData) => void;
    private isActive: boolean = false;
    private cacheUpdateCallback: ((key: string, data: PackageInfo[]) => void) | null = null;
    private cacheKeys: string[] = [];

    constructor() {
        this.appsService = AppsService.instance;
        this.cacheService = CacheService.instance;
        
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 24,
            margin_end: 24,
            margin_top: 24,
            margin_bottom: 24,
        });

        const titleLabel = new Gtk.Label({
            label: '<span size="x-large" weight="bold">Installed Applications</span>',
            use_markup: true,
            halign: Gtk.Align.START,
            margin_bottom: 12,
        });
        this.container.append(titleLabel);

        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
        });

        this.listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
        });
        this.listBox.add_css_class('boxed-list');

        scrolled.set_child(this.listBox);
        this.container.append(scrolled);

        this.dataCallback = this.onDataUpdate.bind(this);
        this.appsService.subscribeToUpdates(this.dataCallback);
    }

    private onDataUpdate(data: AppsData): void {
        const installedApps = this.appsService.getInstalledApps();
        this.displayApps(installedApps);
    }

    private displayApps(apps: any[]): void {
        while (this.listBox.get_first_child()) {
            const child = this.listBox.get_first_child();
            if (child) {
                this.listBox.remove(child);
            }
        }

        if (apps.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: 'No installed applications',
                css_classes: ['dim-label'],
                margin_top: 48,
                margin_bottom: 48,
            });
            this.listBox.append(emptyLabel);
            return;
        }

        for (const app of apps) {
            const row = this.createAppRow(app);
            this.listBox.append(row);
        }
    }

    private createAppRow(app: any): Adw.ActionRow {
        const row = new Adw.ActionRow({
            title: app.name,
            subtitle: app.summary,
        });

        const iconStr = app.icon || 'icon:application-x-executable';
        const icon = new Gtk.Image({
            pixel_size: 48,
            icon_size: Gtk.IconSize.LARGE,
        });
        
        if (iconStr.startsWith('icon:')) {
            const iconName = iconStr.substring(5);
            icon.set_from_icon_name(iconName);
        } else if (iconStr.startsWith('file://')) {
            const file = Gio.File.new_for_uri(iconStr);
            const gicon = Gio.FileIcon.new(file);
            icon.set_from_gicon(gicon);
        } else {
            icon.set_from_icon_name('application-x-executable');
        }
        
        row.add_prefix(icon);

        const versionLabel = new Gtk.Label({
            label: app.version,
            css_classes: ['dim-label'],
            margin_end: 12,
        });
        row.add_suffix(versionLabel);

        const removeButton = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });

        removeButton.connect('clicked', () => {
            this.appsService.removeApp(app.id);
        });

        row.add_suffix(removeButton);

        return row;
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }

    public destroy(): void {
        this.appsService.unsubscribe(this.dataCallback);
    }

    public activate(): void {
        this.isActive = true;
        
        // Subscribe to cache updates when component becomes active
        if (this.cacheUpdateCallback === null && this.cacheKeys.length > 0) {
            this.cacheUpdateCallback = this.onCacheUpdate.bind(this);
            for (const key of this.cacheKeys) {
                this.cacheService.subscribe(key, this.cacheUpdateCallback);
            }
            console.log('Installed component activated - subscribed to cache updates');
        }
    }

    public deactivate(): void {
        this.isActive = false;
        
        // Unsubscribe from cache updates when component is not active
        if (this.cacheUpdateCallback !== null) {
            for (const key of this.cacheKeys) {
                this.cacheService.unsubscribe(key, this.cacheUpdateCallback);
            }
            console.log('Installed component deactivated - unsubscribed from cache updates');
        }
    }

    private onCacheUpdate(key: string, data: PackageInfo[]): void {
        // Only reload if component is currently active/visible
        if (!this.isActive) {
            console.log(`Installed component received cache update for ${key}, but component is not active - skipping reload`);
            return;
        }
        
        console.log(`Installed component received cache update for ${key}, reloading data...`);
        const installedApps = this.appsService.getInstalledApps();
        this.displayApps(installedApps);
    }
}
