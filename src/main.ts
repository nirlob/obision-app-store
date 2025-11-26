import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import Gio from '@girs/gio-2.0';
import { FeaturedComponent } from './components/featured';
import { CategoriesComponent } from './components/categories';
import { AppDetailsComponent } from './components/app-details';
import { InstalledComponent } from './components/installed';
import { UpdatesComponent } from './components/updates';

class ObisionStoreApplication {
    private application: Adw.Application;
    private window!: Adw.ApplicationWindow;
    private navigationView!: Adw.NavigationView;
    private stack!: Gtk.Stack;
    
    private featuredComponent!: FeaturedComponent;
    private categoriesComponent!: CategoriesComponent;
    private appDetailsComponent!: AppDetailsComponent;
    private installedComponent!: InstalledComponent;
    private updatesComponent!: UpdatesComponent;

    constructor() {
        this.application = new Adw.Application({
            application_id: 'com.obision.ObisionStore',
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });

        this.application.connect('startup', this.onStartup.bind(this));
        this.application.connect('activate', this.onActivate.bind(this));
    }

    private onStartup(): void {
        console.log('Application starting up...');
    }

    private onActivate(): void {
        console.log('Application activated');
        
        if (!this.window) {
            this.createMainWindow();
        }
        
        this.window.present();
    }

    private createMainWindow(): void {
        this.window = new Adw.ApplicationWindow({
            application: this.application,
            default_width: 1200,
            default_height: 800,
            title: 'Obision Store',
        });

        // Load custom CSS if available
        const cssProvider = new Gtk.CssProvider();
        try {
            cssProvider.load_from_path('/usr/share/com.obision.ObisionStore/style.css');
        } catch (e) {
            try {
                cssProvider.load_from_path('data/style.css');
            } catch (e2) {
                console.warn('Could not load custom CSS');
            }
        }

        if (cssProvider) {
            Gtk.StyleContext.add_provider_for_display(
                this.window.get_display()!,
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
        }

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        // Header bar
        const headerBar = new Adw.HeaderBar();

        const searchButton = new Gtk.ToggleButton({
            icon_name: 'system-search-symbolic',
        });
        headerBar.pack_start(searchButton);

        const menuButton = new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic',
        });
        headerBar.pack_end(menuButton);

        mainBox.append(headerBar);

        // Main content with sidebar
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 0,
        });

        // Content area with stack (create first)
        this.stack = new Gtk.Stack({
            hexpand: true,
            vexpand: true,
        });

        // Create components
        this.featuredComponent = new FeaturedComponent();
        this.categoriesComponent = new CategoriesComponent();
        this.appDetailsComponent = new AppDetailsComponent();
        this.installedComponent = new InstalledComponent();
        this.updatesComponent = new UpdatesComponent();

        // Add pages to stack
        this.stack.add_named(this.featuredComponent.getWidget(), 'featured');
        this.stack.add_named(this.categoriesComponent.getWidget(), 'categories');
        this.stack.add_named(this.appDetailsComponent.getWidget(), 'details');
        this.stack.add_named(this.installedComponent.getWidget(), 'installed');
        this.stack.add_named(this.updatesComponent.getWidget(), 'updates');

        this.stack.set_visible_child_name('featured');

        // Now create sidebar (after stack exists)
        const sidebar = this.createSidebar();
        contentBox.append(sidebar);

        // Separator
        const separator = new Gtk.Separator({
            orientation: Gtk.Orientation.VERTICAL,
        });
        contentBox.append(separator);

        contentBox.append(this.stack);
        mainBox.append(contentBox);

        this.window.set_content(mainBox);
        console.log('Window created, presenting...');
    }

    private createSidebar(): Gtk.Box {
        const sidebar = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            width_request: 200,
        });

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
        });
        listBox.add_css_class('navigation-sidebar');

        const menuItems = [
            { name: 'Featured', icon: 'starred-symbolic', page: 'featured' },
            { name: 'Categories', icon: 'view-app-grid-symbolic', page: 'categories' },
            { name: 'Installed', icon: 'emblem-ok-symbolic', page: 'installed' },
            { name: 'Updates', icon: 'software-update-available-symbolic', page: 'updates' },
        ];

        const rowPageMap = new Map<Gtk.ListBoxRow, string>();

        for (const item of menuItems) {
            const row = new Gtk.ListBoxRow();
            
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
                margin_bottom: 6,
            });

            const icon = new Gtk.Image({
                icon_name: item.icon,
                pixel_size: 16,
            });
            box.append(icon);

            const label = new Gtk.Label({
                label: item.name,
                halign: Gtk.Align.START,
            });
            box.append(label);

            row.set_child(box);
            rowPageMap.set(row, item.page);
            listBox.append(row);
        }

        const stack = this.stack;
        listBox.connect('row-selected', (_listBox: Gtk.ListBox, row: Gtk.ListBoxRow | null) => {
            if (row) {
                const pageName = rowPageMap.get(row);
                if (pageName) {
                    stack.set_visible_child_name(pageName);
                }
            }
        });

        // Select first item by default
        listBox.select_row(listBox.get_row_at_index(0)!);

        sidebar.append(listBox);
        return sidebar;
    }

    public run(args: string[]): number {
        return this.application.run(args);
    }
}

function main(args: string[]): number {
    const app = new ObisionStoreApplication();
    return app.run(args);
}

main([]);
