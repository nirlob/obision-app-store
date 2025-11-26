import Gtk from '@girs/gtk-4.0';
import Gio from '@girs/gio-2.0';
import { PackageInfo } from '../../interfaces/package';
import { PackagesService } from '../../services/packages-service';

export interface AppCardCarouselOptions {
    app: PackageInfo;
    onInstall?: (appId: string) => void | Promise<void>;
}

export class AppCardCarousel {
    private card: Gtk.Box;
    private installButton!: Gtk.Button;
    private packagesService: PackagesService;

    constructor(options: AppCardCarouselOptions) {
        this.packagesService = PackagesService.instance;
        this.card = this.createCard(options);
    }

    private createCard(options: AppCardCarouselOptions): Gtk.Box {
        const { app } = options;

        const card = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 24,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            height_request: 200,
        });

        // Icon section
        const iconBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            margin_start: 24,
        });

        const iconName = app.icon || 'application-x-executable';
        const icon = new Gtk.Image({
            pixel_size: 128,
        });
        
        if (iconName.startsWith('file://')) {
            const file = Gio.File.new_for_uri(iconName);
            const gicon = Gio.FileIcon.new(file);
            icon.set_from_gicon(gicon);
        } else {
            // Use GThemedIcon for themed icons (automatically finds color version)
            const gicon = Gio.ThemedIcon.new(iconName);
            icon.set_from_gicon(gicon);
        }
        
        iconBox.append(icon);
        card.append(iconBox);

        // Content section
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            margin_end: 24,
        });

        const nameLabel = new Gtk.Label({
            label: `<span size="xx-large" weight="bold">${app.name}</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        contentBox.append(nameLabel);

        const summaryLabel = new Gtk.Label({
            label: app.summary,
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 50,
        });
        contentBox.append(summaryLabel);

        // Category badge
        if (app.category) {
            const categoryLabel = new Gtk.Label({
                label: app.category,
                halign: Gtk.Align.START,
                margin_top: 6,
                css_classes: ['dim-label'],
            });
            contentBox.append(categoryLabel);
        }

        // Install button
        this.installButton = new Gtk.Button({
            label: app.installed ? 'Installed' : 'Install',
            sensitive: !app.installed,
            css_classes: ['suggested-action'],
            margin_top: 12,
            halign: Gtk.Align.START,
        });

        this.installButton.connect('clicked', async () => {
            if (!app.installed) {
                try {
                    if (options.onInstall) {
                        await options.onInstall(app.id);
                    } else {
                        await this.packagesService.installDebianPackage(app.id);
                    }
                    this.installButton.set_label('Installed');
                    this.installButton.set_sensitive(false);
                } catch (error) {
                    console.error(`Error installing ${app.id}:`, error);
                }
            }
        });

        contentBox.append(this.installButton);
        card.append(contentBox);

        return card;
    }

    public getWidget(): Gtk.Widget {
        return this.card;
    }

    public updateInstallState(installed: boolean): void {
        this.installButton.set_label(installed ? 'Installed' : 'Install');
        this.installButton.set_sensitive(!installed);
    }
}
