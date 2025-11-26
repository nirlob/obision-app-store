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
        
        // Register resources
        try {
            const resource = Gio.Resource.load('builddir/com.obision.ObisionStore.gresource');
            Gio.resources_register(resource);
        } catch (e) {
            console.warn('Could not load GResource:', e);
        }
    }

    private onActivate(): void {
        console.log('Application activated');
        
        if (!this.window) {
            this.createMainWindow();
        }
        
        this.window.present();
    }

    private createMainWindow(): void {
        // Load UI from file
        const builder = new Gtk.Builder();
        try {
            builder.add_from_resource('/com/obision/ObisionStore/ui/main.ui');
        } catch (e) {
            console.error('Error loading UI:', e);
            return;
        }

        this.window = builder.get_object('ObisionStoreWindow') as Adw.ApplicationWindow;
        this.window.set_application(this.application);
        
        this.stack = builder.get_object('content_stack') as Gtk.Stack;
        const navigationSidebar = builder.get_object('navigation_sidebar') as Gtk.ListBox;
        
        // Setup components
        this.initializeComponents();
        this.setupNavigation(navigationSidebar, builder);
        
        this.loadCustomCSS();
        console.log('Window created, presenting...');
    }

    private initializeComponents(): void {
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
    }

    private setupNavigation(navigationSidebar: Gtk.ListBox, builder: Gtk.Builder): void {
        const navFeatured = builder.get_object('nav_featured') as Gtk.ListBoxRow;
        const navCategories = builder.get_object('nav_categories') as Gtk.ListBoxRow;
        const navInstalled = builder.get_object('nav_installed') as Gtk.ListBoxRow;
        const navUpdates = builder.get_object('nav_updates') as Gtk.ListBoxRow;

        const rowPageMap = new Map<Gtk.ListBoxRow, string>();
        rowPageMap.set(navFeatured, 'featured');
        rowPageMap.set(navCategories, 'categories');
        rowPageMap.set(navInstalled, 'installed');
        rowPageMap.set(navUpdates, 'updates');

        const stack = this.stack;
        navigationSidebar.connect('row-selected', (_listBox: Gtk.ListBox, row: Gtk.ListBoxRow | null) => {
            if (row) {
                const pageName = rowPageMap.get(row);
                if (pageName) {
                    stack.set_visible_child_name(pageName);
                }
            }
        });

        // Select first item by default
        navigationSidebar.select_row(navFeatured);
    }

    private loadCustomCSS(): void {
        const cssProvider = new Gtk.CssProvider();
        try {
            cssProvider.load_from_resource('/com/obision/ObisionStore/style.css');
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
