import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { AppsService } from '../services/apps-service';
import { UtilsService } from '../services/utils-service';
import { Application } from '../interfaces/application';

export class AppDetailsComponent {
    private container: Gtk.Box;
    private appsService: AppsService;
    private utils: UtilsService;
    private currentApp: Application | null = null;

    constructor() {
        this.appsService = AppsService.instance;
        this.utils = UtilsService.instance;
        
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });
    }

    public showApp(appId: string): void {
        const app = this.appsService.getAppById(appId);
        if (!app) return;

        this.currentApp = app;
        this.buildUI();
    }

    private buildUI(): void {
        if (!this.currentApp) return;

        // Clear previous content
        while (this.container.get_first_child()) {
            const child = this.container.get_first_child();
            if (child) {
                this.container.remove(child);
            }
        }

        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
        });

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 24,
            margin_start: 48,
            margin_end: 48,
            margin_top: 48,
            margin_bottom: 48,
        });

        // Header
        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 24,
        });

        const icon = new Gtk.Image({
            icon_name: this.currentApp.icon || 'application-x-executable',
            pixel_size: 128,
        });
        headerBox.append(icon);

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            valign: Gtk.Align.CENTER,
        });

        const nameLabel = new Gtk.Label({
            label: `<span size="xx-large" weight="bold">${this.currentApp.name}</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        infoBox.append(nameLabel);

        const summaryLabel = new Gtk.Label({
            label: this.currentApp.summary,
            halign: Gtk.Align.START,
            css_classes: ['dim-label'],
        });
        infoBox.append(summaryLabel);

        const developerLabel = new Gtk.Label({
            label: `by ${this.currentApp.developer}`,
            halign: Gtk.Align.START,
            css_classes: ['dim-label'],
        });
        infoBox.append(developerLabel);

        const buttonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 12,
        });

        const actionButton = new Gtk.Button({
            label: this.currentApp.installed ? 'Remove' : 'Install',
            css_classes: this.currentApp.installed ? ['destructive-action'] : ['suggested-action'],
        });

        actionButton.connect('clicked', () => {
            if (this.currentApp) {
                if (this.currentApp.installed) {
                    this.appsService.removeApp(this.currentApp.id);
                    actionButton.set_label('Install');
                    actionButton.remove_css_class('destructive-action');
                    actionButton.add_css_class('suggested-action');
                } else {
                    this.appsService.installApp(this.currentApp.id);
                    actionButton.set_label('Remove');
                    actionButton.remove_css_class('suggested-action');
                    actionButton.add_css_class('destructive-action');
                }
            }
        });

        buttonBox.append(actionButton);
        infoBox.append(buttonBox);

        headerBox.append(infoBox);
        contentBox.append(headerBox);

        // Description
        const descriptionGroup = new Adw.PreferencesGroup({
            title: 'About',
        });

        const descriptionLabel = new Gtk.Label({
            label: this.currentApp.description,
            wrap: true,
            halign: Gtk.Align.START,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });
        descriptionGroup.add(descriptionLabel);

        contentBox.append(descriptionGroup);

        // Details
        const detailsGroup = new Adw.PreferencesGroup({
            title: 'Details',
        });

        const details = [
            ['Version', this.currentApp.version],
            ['Size', this.utils.formatBytes(this.currentApp.size)],
            ['License', this.currentApp.license],
            ['Category', this.currentApp.category],
            ['Downloads', this.currentApp.downloads.toLocaleString()],
            ['Rating', `${this.currentApp.rating}/5.0`],
        ];

        for (const [key, value] of details) {
            const row = new Adw.ActionRow({
                title: key,
            });
            const valueLabel = new Gtk.Label({
                label: value,
                css_classes: ['dim-label'],
            });
            row.add_suffix(valueLabel);
            detailsGroup.add(row);
        }

        contentBox.append(detailsGroup);

        scrolled.set_child(contentBox);
        this.container.append(scrolled);
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }
}
