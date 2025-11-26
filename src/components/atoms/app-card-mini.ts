import Gtk from '@girs/gtk-4.0';
import Gio from '@girs/gio-2.0';
import { PackageInfo } from '../../interfaces/package';
import { PackagesService } from '../../services/packages-service';

export interface AppCardMiniOptions {
    app: PackageInfo;
    onInstall?: (appId: string) => void | Promise<void>;
}

export class AppCardMini {
    private card: Gtk.Box;
    private installButton!: Gtk.Button;
    private packagesService: PackagesService;

    constructor(options: AppCardMiniOptions) {
        this.packagesService = PackagesService.instance;
        this.card = this.createCard(options);
    }

    private createCard(options: AppCardMiniOptions): Gtk.Box {
        const { app } = options;

        const card = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            hexpand: true,
            vexpand: false,
            margin_top: 5,
            margin_bottom: 5,
            margin_start: 5,
            margin_end: 5,
            css_classes: ['card'],
        });

        // Icon
        const iconName = app.icon || 'emblem-system-symbolic';
        const icon = new Gtk.Image({
            pixel_size: 48,
        });
        
        if (iconName.startsWith('file://')) {
            const file = Gio.File.new_for_uri(iconName);
            const gicon = Gio.FileIcon.new(file);
            icon.set_from_gicon(gicon);
        } else {
            const gicon = Gio.ThemedIcon.new(iconName);
            icon.set_from_gicon(gicon);
        }
        
        card.append(icon);

        // Content
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        // Capitalize first letter of name
        const capitalizedName = app.name.charAt(0).toUpperCase() + app.name.slice(1);
        const nameLabel = new Gtk.Label({
            label: capitalizedName,
            halign: Gtk.Align.START,
            ellipsize: 3, // Pango.EllipsizeMode.END
        });
        nameLabel.add_css_class('heading');
        contentBox.append(nameLabel);

        // Capitalize first letter of summary
        const capitalizedSummary = app.summary.charAt(0).toUpperCase() + app.summary.slice(1);
        const summaryLabel = new Gtk.Label({
            label: capitalizedSummary,
            halign: Gtk.Align.START,
            ellipsize: 3, // Pango.EllipsizeMode.END
        });
        summaryLabel.add_css_class('caption');
        summaryLabel.add_css_class('dim-label');
        contentBox.append(summaryLabel);

        card.append(contentBox);

        // Install button with play icon
        this.installButton = new Gtk.Button({
            icon_name: 'media-playback-start-symbolic',
            sensitive: !app.installed,
            css_classes: ['circular', 'suggested-action'],
            valign: Gtk.Align.CENTER,
        });

        this.installButton.connect('clicked', async () => {
            if (!app.installed) {
                try {
                    if (options.onInstall) {
                        await options.onInstall(app.id);
                    } else {
                        await this.packagesService.installDebianPackage(app.id);
                    }
                    this.installButton.set_sensitive(false);
                } catch (error) {
                    console.error(`Error installing ${app.id}:`, error);
                }
            }
        });

        card.append(this.installButton);

        return card;
    }

    public getWidget(): Gtk.Widget {
        return this.card;
    }

    public updateInstallState(installed: boolean): void {
        this.installButton.set_sensitive(!installed);
    }
}
