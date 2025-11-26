import Gtk from '@girs/gtk-4.0';
import { CategoriesService } from '../services/categories-service';
import { AppsService } from '../services/apps-service';

export class CategoriesComponent {
    private container: Gtk.Box;
    private categoriesService: CategoriesService;
    private appsService: AppsService;
    private gridView!: Gtk.FlowBox;

    constructor() {
        this.categoriesService = CategoriesService.instance;
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
            label: '<span size="x-large" weight="bold">Categories</span>',
            use_markup: true,
            halign: Gtk.Align.START,
            margin_bottom: 12,
        });
        this.container.append(titleLabel);

        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
        });

        this.gridView = new Gtk.FlowBox({
            column_spacing: 12,
            row_spacing: 12,
            homogeneous: true,
            max_children_per_line: 4,
            selection_mode: Gtk.SelectionMode.NONE,
        });

        const categoriesData = this.categoriesService.getCategories();
        for (const category of categoriesData.categories) {
            const categoryCard = this.createCategoryCard(category);
            this.gridView.append(categoryCard);
        }

        scrolled.set_child(this.gridView);
        this.container.append(scrolled);
    }

    private createCategoryCard(category: any): Gtk.Button {
        const button = new Gtk.Button({
            css_classes: ['card'],
            width_request: 200,
            height_request: 150,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });

        const icon = new Gtk.Image({
            icon_name: category.icon,
            pixel_size: 64,
        });
        box.append(icon);

        const nameLabel = new Gtk.Label({
            label: `<span size="large" weight="bold">${category.name}</span>`,
            use_markup: true,
        });
        box.append(nameLabel);

        const countLabel = new Gtk.Label({
            label: `${category.appCount} apps`,
            css_classes: ['dim-label'],
        });
        box.append(countLabel);

        button.set_child(box);

        button.connect('clicked', () => {
            this.appsService.filterByCategory(category.name);
        });

        return button;
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }
}
