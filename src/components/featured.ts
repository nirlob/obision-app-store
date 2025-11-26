import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { AppsService } from '../services/apps-service';
import { AppsData } from '../interfaces/application';

export class FeaturedComponent {
    private container: Gtk.Box;
    private appsService: AppsService;
    private carouselIndicatorDots!: Adw.CarouselIndicatorDots;
    private carousel!: Adw.Carousel;

    constructor() {
        this.appsService = AppsService.instance;
        
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 24,
            margin_end: 24,
            margin_top: 24,
            margin_bottom: 24,
        });

        const titleLabel = new Gtk.Label({
            label: '<span size="x-large" weight="bold">Featured Apps</span>',
            use_markup: true,
            halign: Gtk.Align.START,
            margin_bottom: 12,
        });
        this.container.append(titleLabel);

        this.carousel = new Adw.Carousel({
            spacing: 12,
            allow_scroll_wheel: true,
        });

        const featuredApps = this.appsService.getFeaturedApps();
        for (const app of featuredApps) {
            const appCard = this.createFeaturedCard(app);
            this.carousel.append(appCard);
        }

        this.container.append(this.carousel);

        this.carouselIndicatorDots = new Adw.CarouselIndicatorDots({
            carousel: this.carousel,
        });
        this.container.append(this.carouselIndicatorDots);
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
