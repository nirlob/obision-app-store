import { DebianService } from "./debian-service";
import { FlatpakService } from "./flatpak-service";
import { CacheService } from "./cache-service";
import { PackageInfo } from "../interfaces/package";

/**
 * PackagesService - Coordinador de servicios de paquetes
 * Delega operaciones a DebianService y FlatpakService
 */
export class PackagesService {
    private static _instance: PackagesService;
    private debianService: DebianService;
    private flatpakService: FlatpakService;
    private cacheService: CacheService;

    private constructor() {
        this.debianService = DebianService.instance;
        this.flatpakService = FlatpakService.instance;
        this.cacheService = CacheService.instance;
    }

    public static get instance(): PackagesService {
        if (!PackagesService._instance) {
            PackagesService._instance = new PackagesService();
        }
        return PackagesService._instance;
    }
    
    /**
     * Verifica si el caché AppStream está listo
     */
    public isAppStreamCacheReady(): boolean {
        return this.debianService.isAppStreamCacheReady();
    }
    
    /**
     * Espera a que el caché AppStream esté listo
     */
    public async waitForAppStreamCache(): Promise<void> {
        return this.debianService.waitForAppStreamCache();
    }

    // Debian package methods (delegate to DebianService)
    public async searchDebianPackagesAsync(query: string): Promise<PackageInfo[]> {
        return this.debianService.searchPackagesAsync(query);
    }

    public searchDebianPackages(query: string): PackageInfo[] {
        return this.debianService.searchPackages(query);
    }

    public installDebianPackage(packageName: string): boolean {
        return this.debianService.installPackage(packageName);
    }

    public removeDebianPackage(packageName: string): boolean {
        return this.debianService.removePackage(packageName);
    }

    // Flatpak package methods (delegate to FlatpakService)
    public async searchFlatpakPackages(query: string): Promise<PackageInfo[]> {
        return this.flatpakService.searchPackages(query);
    }

    public async getFlatpakAppDetails(appId: string): Promise<PackageInfo | null> {
        return this.flatpakService.getAppDetails(appId);
    }

    public installFlatpakPackage(appId: string): boolean {
        return this.flatpakService.installPackage(appId);
    }

    public removeFlatpakPackage(appId: string): boolean {
        return this.flatpakService.removePackage(appId);
    }

    // Section and Category management (Debian)
    public async getAvailableSections(): Promise<string[]> {
        return this.debianService.getAvailableSections();
    }

    public async getAvailableCategories(): Promise<string[]> {
        return this.debianService.getAvailableCategories();
    }

    public async getPackagesBySection(section: string, limit?: number): Promise<PackageInfo[]> {
        return this.debianService.getPackagesBySection(section, limit);
    }

    // Cache management
    public clearCache(): void {
        this.cacheService.clear();
    }

    public getCacheStats() {
        return this.cacheService.getStats();
    }
}
