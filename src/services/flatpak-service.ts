import { UtilsService } from "./utils-service";
import { CacheService } from "./cache-service";
import { PackageInfo } from "../interfaces/package";

export class FlatpakService {
    private static _instance: FlatpakService;
    private utils: UtilsService;
    private cacheService: CacheService;

    private constructor() {
        this.utils = UtilsService.instance;
        this.cacheService = CacheService.instance;
    }

    public static get instance(): FlatpakService {
        if (!FlatpakService._instance) {
            FlatpakService._instance = new FlatpakService();
        }
        return FlatpakService._instance;
    }

    public async searchPackages(query: string): Promise<PackageInfo[]> {
        // Check cache first
        const cacheKey = this.cacheService.getCacheKey('flatpak', query);
        const cached = this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const url = `https://flathub.org/api/v2/search/${encodeURIComponent(query)}`;
            const packages = await this.fetchFlatpakData(url);
            
            // Save to cache
            this.cacheService.set(cacheKey, packages, query);
            
            return packages;
        } catch (error) {
            console.error('Error searching Flatpak packages:', error);
            return [];
        }
    }

    private async fetchFlatpakData(url: string): Promise<PackageInfo[]> {
        return new Promise((resolve, reject) => {
            const [stdout, stderr] = this.utils.executeCommand('curl', [
                '-s',
                '-H', 'Accept: application/json',
                url
            ]);

            if (stderr && stderr.trim() !== '') {
                reject(new Error(stderr));
                return;
            }

            try {
                const data = JSON.parse(stdout);
                const packages: PackageInfo[] = [];

                if (data.hits) {
                    for (const hit of data.hits.slice(0, 50)) {
                        packages.push(this.parseApp(hit));
                    }
                }

                resolve(packages);
            } catch (error) {
                reject(error);
            }
        });
    }

    public async getAppDetails(appId: string): Promise<PackageInfo | null> {
        try {
            const url = `https://flathub.org/api/v2/appstream/${appId}`;
            const [stdout] = this.utils.executeCommand('curl', ['-s', url]);
            
            if (!stdout) return null;

            const data = JSON.parse(stdout);
            return this.parseAppDetail(data);
        } catch (error) {
            console.error('Error fetching Flatpak app details:', error);
            return null;
        }
    }

    private parseApp(data: any): PackageInfo {
        const appId = data.app_id || data.id || '';
        
        // Check if installed
        const [installedOutput] = this.utils.executeCommand('flatpak', [
            'list',
            '--app',
            '--columns=application'
        ]);
        const installed = installedOutput.includes(appId);

        return {
            id: `flatpak:${appId}`,
            name: data.name || appId,
            summary: data.summary || '',
            description: data.description || data.summary || '',
            icon: `https://dl.flathub.org/media/${appId}.png`,
            version: data.version || '',
            size: data.download_size || 0,
            category: this.mapCategory(data.categories?.[0] || ''),
            developer: data.developer_name || data.project_group || 'Unknown',
            license: data.project_license || 'Unknown',
            homepage: data.urls?.homepage || '',
            screenshots: (data.screenshots || []).map((s: any) => s.url || ''),
            source: 'flatpak',
            installed: installed,
            rating: 0
        };
    }

    private parseAppDetail(data: any): PackageInfo {
        const appId = data.id || '';
        
        const [installedOutput] = this.utils.executeCommand('flatpak', [
            'list',
            '--app',
            '--columns=application'
        ]);
        const installed = installedOutput.includes(appId);

        return {
            id: `flatpak:${appId}`,
            name: data.name || appId,
            summary: data.summary || '',
            description: data.description || data.summary || '',
            icon: `https://dl.flathub.org/media/${appId}.png`,
            version: data.versions?.[0]?.version || '',
            size: data.download_size || 0,
            category: this.mapCategory(data.categories?.[0] || ''),
            developer: data.developer_name || 'Unknown',
            license: data.project_license || 'Unknown',
            homepage: data.urls?.homepage || '',
            screenshots: (data.screenshots || []).map((s: any) => 
                typeof s === 'string' ? s : s.url || ''
            ).filter((url: string) => url !== ''),
            source: 'flatpak',
            installed: installed,
            rating: 0
        };
    }

    private mapCategory(category: string): string {
        const categoryMap: { [key: string]: string } = {
            'AudioVideo': 'Multimedia',
            'Development': 'Development',
            'Education': 'Education',
            'Game': 'Games',
            'Graphics': 'Graphics',
            'Network': 'Internet',
            'Office': 'Office',
            'Science': 'Education',
            'Settings': 'System',
            'System': 'System',
            'Utility': 'Utilities',
        };

        return categoryMap[category] || 'Other';
    }

    public installPackage(appId: string): boolean {
        try {
            const [stdout, stderr] = this.utils.executeCommand('flatpak', [
                'install',
                '-y',
                'flathub',
                appId
            ]);
            
            return !stderr || !stderr.includes('error');
        } catch (error) {
            console.error('Error installing Flatpak package:', error);
            return false;
        }
    }

    public removePackage(appId: string): boolean {
        try {
            const [stdout, stderr] = this.utils.executeCommand('flatpak', [
                'uninstall',
                '-y',
                appId
            ]);
            
            return !stderr || !stderr.includes('error');
        } catch (error) {
            console.error('Error removing Flatpak package:', error);
            return false;
        }
    }
}
