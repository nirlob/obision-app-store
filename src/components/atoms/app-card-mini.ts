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
    private appIcon: Gtk.Image;
    private nameLabel: Gtk.Label;
    private summaryLabel: Gtk.Label;
    private installButton: Gtk.Button;
    private packagesService: PackagesService;

    constructor(options: AppCardMiniOptions) {
        this.packagesService = PackagesService.instance;
        
        // Load UI from file
        const builder = new Gtk.Builder();
        builder.add_from_resource('/com/obision/ObisionStore/ui/atoms/app-card-mini.ui');
        
        this.card = builder.get_object('AppCardMini') as Gtk.Box;
        this.appIcon = builder.get_object('app_icon') as Gtk.Image;
        this.nameLabel = builder.get_object('name_label') as Gtk.Label;
        this.summaryLabel = builder.get_object('summary_label') as Gtk.Label;
        this.installButton = builder.get_object('install_button') as Gtk.Button;
        
        // Setup with data
        this.setupCard(options);
    }

    private setupCard(options: AppCardMiniOptions): void {
        const { app } = options;

        // Set icon
        const iconName = app.icon || 'emblem-system-symbolic';
        if (iconName.startsWith('file://')) {
            const file = Gio.File.new_for_uri(iconName);
            const gicon = Gio.FileIcon.new(file);
            this.appIcon.set_from_gicon(gicon);
        } else {
            const gicon = Gio.ThemedIcon.new(iconName);
            this.appIcon.set_from_gicon(gicon);
        }

        // Capitalize first letter of name
        const capitalizedName = app.name.charAt(0).toUpperCase() + app.name.slice(1);
        this.nameLabel.set_label(capitalizedName);

        // Capitalize first letter of summary
        const capitalizedSummary = app.summary.charAt(0).toUpperCase() + app.summary.slice(1);
        this.summaryLabel.set_label(capitalizedSummary);

        // Setup install button
        this.installButton.set_sensitive(!app.installed);

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
    }

    public getWidget(): Gtk.Widget {
        return this.card;
    }

    public updateInstallState(installed: boolean): void {
        this.installButton.set_sensitive(!installed);
    }
}
