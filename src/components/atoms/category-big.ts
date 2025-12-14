import Gtk from '@girs/gtk-4.0';
import Gio from '@girs/gio-2.0';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';

export interface CategoryBigOptions {
    name: string;
    icon?: string;
    appCount?: number;
    onClick?: (categoryName: string) => void;
}

export class CategoryBig {
    private button: Gtk.Button;
    private categoryIcon: Gtk.Image;
    private categoryName: Gtk.Label;
    private appCount: Gtk.Label;
    private categoryData: CategoryBigOptions;

    constructor(options: CategoryBigOptions) {
        this.categoryData = options;
        
        // Load UI from file
        const builder = new Gtk.Builder();
        builder.add_from_resource('/com/obision/ObisionStore/ui/atoms/category-big.ui');
        
        this.button = builder.get_object('CategoryBigButton') as Gtk.Button;
        this.categoryIcon = builder.get_object('category_icon') as Gtk.Image;
        this.categoryName = builder.get_object('category_name') as Gtk.Label;
        this.appCount = builder.get_object('app_count') as Gtk.Label;
        
        // Setup with data
        this.setupCard();
    }

    private setupCard(): void {
        const { name, icon, appCount, onClick } = this.categoryData;

        // Set category name
        this.categoryName.set_label(name);

        // Get icon and color for category
        const categoryIcon = icon || CATEGORY_ICONS[name] || CATEGORY_ICONS['default'];
        const categoryColor = CATEGORY_COLORS[name] || CATEGORY_COLORS['default'];

        // Set icon
        if (categoryIcon.startsWith('file://') || categoryIcon.startsWith('/')) {
            const file = Gio.File.new_for_uri(categoryIcon.startsWith('file://') ? categoryIcon : `file://${categoryIcon}`);
            const gicon = Gio.FileIcon.new(file);
            this.categoryIcon.set_from_gicon(gicon);
        } else {
            // Use themed icon with color
            const gicon = Gio.ThemedIcon.new(categoryIcon);
            this.categoryIcon.set_from_gicon(gicon);
            this.categoryIcon.set_pixel_size(64);
        }

        // Apply background color to button
        const cssProvider = new Gtk.CssProvider();
        const css = `
            .category-card {
                background: ${categoryColor};
            }
        `;
        cssProvider.load_from_data(css, -1);
        this.button.get_style_context().add_provider(
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        // Set app count
        if (appCount !== undefined) {
            const countText = appCount === 1 ? '1 app' : `${appCount} apps`;
            this.appCount.set_label(countText);
        } else {
            this.appCount.set_label('');
        }

        // Setup click handler
        if (onClick) {
            this.button.connect('clicked', () => {
                onClick(name);
            });
        }
    }

    public getWidget(): Gtk.Widget {
        return this.button;
    }

    public updateAppCount(count: number): void {
        const countText = count === 1 ? '1 app' : `${count} apps`;
        this.appCount.set_label(countText);
    }
}
