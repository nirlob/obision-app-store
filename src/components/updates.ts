import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import Gio from '@girs/gio-2.0';
import { UpdatesService } from '../services/updates-service';
import { UtilsService } from '../services/utils-service';
import { UpdatesData } from '../interfaces/update';
import { CacheService } from '../services/cache-service';
import { PackageInfo } from '../interfaces/package';

export class UpdatesComponent {
    private container: Gtk.Box;
    private updatesService: UpdatesService;
    private utils: UtilsService;
    private cacheService: CacheService;
    private listBox!: Gtk.ListBox;
    private dataCallback!: (data: UpdatesData) => void;
    private updateAllButton!: Gtk.Button;
    private isActive: boolean = false;
    private cacheUpdateCallback: ((key: string, data: PackageInfo[]) => void) | null = null;
    private cacheKeys: string[] = [];

    constructor() {
        this.updatesService = UpdatesService.instance;
        this.utils = UtilsService.instance;
        this.cacheService = CacheService.instance;
        
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 24,
            margin_end: 24,
            margin_top: 24,
            margin_bottom: 24,
        });

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_bottom: 12,
        });

        const titleLabel = new Gtk.Label({
            label: '<span size="x-large" weight="bold">Available Updates</span>',
            use_markup: true,
            halign: Gtk.Align.START,
            hexpand: true,
        });
        headerBox.append(titleLabel);

        this.updateAllButton = new Gtk.Button({
            label: 'Update All',
            css_classes: ['suggested-action'],
        });

        this.updateAllButton.connect('clicked', () => {
            this.updatesService.updateAll();
        });

        headerBox.append(this.updateAllButton);
        this.container.append(headerBox);

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
        this.updatesService.subscribeToUpdates(this.dataCallback);
    }

    private onDataUpdate(data: UpdatesData): void {
        this.displayUpdates(data.updates);
        this.updateAllButton.set_sensitive(data.totalCount > 0);
    }

    private displayUpdates(updates: any[]): void {
        while (this.listBox.get_first_child()) {
            const child = this.listBox.get_first_child();
            if (child) {
                this.listBox.remove(child);
            }
        }

        if (updates.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: 'All applications are up to date',
                css_classes: ['dim-label'],
                margin_top: 48,
                margin_bottom: 48,
            });
            this.listBox.append(emptyLabel);
            return;
        }

        for (const update of updates) {
            const row = this.createUpdateRow(update);
            this.listBox.append(row);
        }
    }

    private createUpdateRow(update: any): Adw.ActionRow {
        const row = new Adw.ActionRow({
            title: update.appName,
            subtitle: `${update.currentVersion} → ${update.newVersion} • ${this.utils.formatBytes(update.size)}`,
        });

        const iconStr = update.icon || 'icon:emblem-system-symbolic';
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
            icon.set_from_icon_name('emblem-system-symbolic');
        }
        
        row.add_prefix(icon);

        const updateButton = new Gtk.Button({
            label: 'Update',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });

        updateButton.connect('clicked', () => {
            this.updatesService.updateApp(update.appId);
        });

        row.add_suffix(updateButton);

        return row;
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }

    public destroy(): void {
        this.updatesService.unsubscribe(this.dataCallback);
    }

    public activate(): void {
        this.isActive = true;
        
        // Subscribe to cache updates when component becomes active
        if (this.cacheUpdateCallback === null && this.cacheKeys.length > 0) {
            this.cacheUpdateCallback = this.onCacheUpdate.bind(this);
            for (const key of this.cacheKeys) {
                this.cacheService.subscribe(key, this.cacheUpdateCallback);
            }
            console.log('Updates component activated - subscribed to cache updates');
        }
    }

    public deactivate(): void {
        this.isActive = false;
        
        // Unsubscribe from cache updates when component is not active
        if (this.cacheUpdateCallback !== null) {
            for (const key of this.cacheKeys) {
                this.cacheService.unsubscribe(key, this.cacheUpdateCallback);
            }
            console.log('Updates component deactivated - unsubscribed from cache updates');
        }
    }

    private onCacheUpdate(key: string, data: PackageInfo[]): void {
        // Only reload if component is currently active/visible
        if (!this.isActive) {
            return;
        }
        
        this.updatesService.checkForUpdates();
    }
}
