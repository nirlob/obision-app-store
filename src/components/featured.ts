import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { AppsService } from '../services/apps-service';
import { AppsData } from '../interfaces/application';

export class FeaturedComponent {
    private container: Gtk.Box;
    private carousel!: Adw.Carousel;
    private appsService: AppsService;

    constructor() {
        this.appsService = AppsService.instance;
        
        // Load UI from file
        const builder = new Gtk.Builder();
        try {
            builder.add_from_resource('/com/obision/ObisionStore/ui/featured.ui');
        } catch (e) {
            console.error('Error loading featured UI:', e);
            // Fallback to manual creation
            this.container = this.createManualUI();
            return;
        }

        this.container = builder.get_object('FeaturedView') as Gtk.Box;
        this.carousel = builder.get_object('featured_carousel') as Adw.Carousel;
        
        this.loadFeaturedApps();
    }

    private createManualUI(): Gtk.Box {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 24,
            margin_end: 24,
            margin_top: 24,
            margin_bottom: 24,
        });

        const titleLabel = new Gtk.Label({
            label: 'Aplicaciones destacadas',
            halign: Gtk.Align.START,
            xalign: 0,
        });
        titleLabel.add_css_class('title-1');
        box.append(titleLabel);

        this.carousel = new Adw.Carousel({
            spacing: 12,
            allow_long_swipes: true,
            allow_scroll_wheel: true,
        });
        box.append(this.carousel);

        const dots = new Adw.CarouselIndicatorDots({
            carousel: this.carousel,
        });
        box.append(dots);

        this.loadFeaturedApps();
        return box;
    }

    private loadFeaturedApps(): void {
        const featuredApps = this.appsService.getFeaturedApps();
        for (const app of featuredApps) {
            const appCard = this.createFeaturedCard(app);
            this.carousel.append(appCard);
        }
    }

    private createFeaturedCard(app: any): Gtk.Box {
        const card = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 24,
            css_classes: ['card'],
            width_request: 600,
            height_request: 200,
        });

        const iconBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            margin_start: 24,
        });

        const icon = new Gtk.Image({
            icon_name: app.icon || 'application-x-executable',
            pixel_size: 128,
        });
        iconBox.append(icon);
        card.append(iconBox);

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

        const ratingBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 12,
        });

        for (let i = 0; i < 5; i++) {
            const starIcon = new Gtk.Image({
                icon_name: i < Math.floor(app.rating) ? 'starred-symbolic' : 'non-starred-symbolic',
                pixel_size: 16,
            });
            ratingBox.append(starIcon);
        }

        const ratingLabel = new Gtk.Label({
            label: `${app.rating.toFixed(1)}`,
            margin_start: 6,
        });
        ratingBox.append(ratingLabel);

        contentBox.append(ratingBox);

        const installButton = new Gtk.Button({
            label: app.installed ? 'Installed' : 'Install',
            sensitive: !app.installed,
            css_classes: ['suggested-action'],
            margin_top: 12,
            halign: Gtk.Align.START,
        });

        installButton.connect('clicked', () => {
            if (!app.installed) {
                this.appsService.installApp(app.id);
                installButton.set_label('Installed');
                installButton.set_sensitive(false);
            }
        });

        contentBox.append(installButton);
        card.append(contentBox);

        return card;
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }
}
