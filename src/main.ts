import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import Gio from '@girs/gio-2.0';
import GLib from '@girs/glib-2.0';
import { FeaturedComponent } from './components/featured';
import { CategoriesComponent } from './components/categories';
import { AppDetailsComponent } from './components/app-details';
import { UpdatesComponent } from './components/updates';

class ObisionAppStoreApplication {
    private application: Adw.Application;
    private window!: Adw.ApplicationWindow;
    private stack!: Gtk.Stack;
    
    private featuredComponent!: FeaturedComponent;
    private categoriesComponent!: CategoriesComponent;
    private appDetailsComponent!: AppDetailsComponent;
    private updatesComponent!: UpdatesComponent;

    constructor() {
        this.application = new Adw.Application({
            application_id: 'obision.app.store',
            flags: Gio.ApplicationFlags.FLAGS_NONE,
        });

        this.application.connect('startup', this.onStartup.bind(this));
        this.application.connect('activate', this.onActivate.bind(this));
    }

    private onStartup(): void {
        console.log('Application starting up...');
        
        // Register resources
        try {
            const resource = Gio.Resource.load('builddir/obision.app.store.gresource');
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
        
        if (this.window) {
            this.window.present();
            console.log('Window presented');
        }
    }

    private createMainWindow(): void {
        // Load UI from file
        const builder = new Gtk.Builder();
        try {
            builder.add_from_resource('/obision/app/store/ui/main.ui');
        } catch (e) {
            console.error('Error loading UI:', e);
            return;
        }

        this.window = builder.get_object('ObisionAppStoreWindow') as Adw.ApplicationWindow;
        this.window.set_application(this.application);
        
        this.stack = builder.get_object('content_stack') as Gtk.Stack;
        const navigationSidebar = builder.get_object('navigation_sidebar') as Gtk.Box;
        
        // Setup components and navigation
        this.initializeComponents();
        this.setupNavigation(navigationSidebar, builder);
        
        this.loadCustomCSS();
        console.log('Window created');
    }

    private initializeComponents(): void {
        // Create components
        this.featuredComponent = new FeaturedComponent();
        this.categoriesComponent = new CategoriesComponent();
        this.appDetailsComponent = new AppDetailsComponent();
        this.updatesComponent = new UpdatesComponent();

        // Add pages to stack
        this.stack.add_named(this.featuredComponent.getWidget(), 'featured');
        this.stack.add_named(this.categoriesComponent.getWidget(), 'categories');
        this.stack.add_named(this.appDetailsComponent.getWidget(), 'details');
        this.stack.add_named(this.updatesComponent.getWidget(), 'updates');

        this.stack.set_visible_child_name('featured');
        
        // Setup stack change listener to manage component activation
        this.stack.connect('notify::visible-child-name', () => {
            this.onStackPageChanged();
        });
        
        // Load featured apps after window is shown using GLib idle
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.featuredComponent.load();
            this.featuredComponent.activate(); // Activate featured component by default
            return GLib.SOURCE_REMOVE;
        });
    }

    private onStackPageChanged(): void {
        const visiblePage = this.stack.get_visible_child_name();
        
        // Deactivate all components
        this.featuredComponent.deactivate();
        this.categoriesComponent.deactivate();
        this.updatesComponent.deactivate();
        
        // Activate the visible component
        switch (visiblePage) {
            case 'featured':
                this.featuredComponent.activate();
                break;
            case 'categories':
                this.categoriesComponent.activate();
                break;
            case 'updates':
                this.updatesComponent.activate();
                break;
        }
        
        console.log(`Stack page changed to: ${visiblePage}`);
    }

    private setupNavigation(navigationSidebar: Gtk.Box, builder: Gtk.Builder): void {
        const navFeatured = builder.get_object('nav_featured') as Gtk.ToggleButton;
        const navCategories = builder.get_object('nav_categories') as Gtk.ToggleButton;
        const navUpdates = builder.get_object('nav_updates') as Gtk.ToggleButton;

        const buttonPageMap = new Map<Gtk.ToggleButton, string>();
        buttonPageMap.set(navFeatured, 'featured');
        buttonPageMap.set(navCategories, 'categories');
        buttonPageMap.set(navUpdates, 'updates');

        const stack = this.stack;
        
        // Connect all toggle buttons
        buttonPageMap.forEach((pageName, button) => {
            button.connect('toggled', () => {
                if (button.get_active()) {
                    stack.set_visible_child_name(pageName);
                }
            });
        });

        // Activate first button by default
        navFeatured.set_active(true);
    }

    private loadCustomCSS(): void {
        const cssProvider = new Gtk.CssProvider();
        try {
            cssProvider.load_from_resource('/obision/app/store/style.css');
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
    const app = new ObisionAppStoreApplication();
    return app.run(args);
}

main([]);
