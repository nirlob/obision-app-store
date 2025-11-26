import GLib from "@girs/glib-2.0";
import Gio from "@girs/gio-2.0";
import { UtilsService } from "./utils-service";
import { PackageInfo, FlatpakApp, DebianPackage } from "../interfaces/package";

export class PackagesService {
    private static _instance: PackagesService;
    private utils: UtilsService;
    private cache: Map<string, PackageInfo[]> = new Map();
    private cacheTimestamp: number = 0;
    private readonly CACHE_DURATION = 300000; // 5 minutes

    private constructor() {
        this.utils = UtilsService.instance;
    }

    public static get instance(): PackagesService {
        if (!PackagesService._instance) {
            PackagesService._instance = new PackagesService();
        }
        return PackagesService._instance;
    }

    // Debian packages methods
    public searchDebianPackages(query: string): PackageInfo[] {
        try {
            const [stdout] = this.utils.executeCommand('apt-cache', [
                'search',
                '--names-only',
                query.toLowerCase()
            ]);

            const packages: PackageInfo[] = [];
            const lines = stdout.trim().split('\n');

            for (const line of lines.slice(0, 50)) { // Limit to 50 results
                const match = line.match(/^(\S+)\s+-\s+(.+)$/);
                if (match) {
                    const [, name, summary] = match;
                    const packageInfo = this.getDebianPackageInfo(name);
                    if (packageInfo) {
                        packages.push(packageInfo);
                    }
                }
            }

            return packages;
        } catch (error) {
            console.error('Error searching Debian packages:', error);
            return [];
        }
    }

    private getDebianPackageInfo(packageName: string): PackageInfo | null {
        try {
            const [stdout] = this.utils.executeCommand('apt-cache', ['show', packageName]);
            
            if (!stdout) return null;

            const lines = stdout.split('\n');
            const info: any = {};
            let currentField = '';
            
            for (const line of lines) {
                if (line.startsWith(' ')) {
                    if (currentField) {
                        info[currentField] += '\n' + line.trim();
                    }
                } else if (line.includes(':')) {
                    const colonIndex = line.indexOf(':');
                    const field = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    currentField = field;
                    info[field] = value;
                }
            }

            // Check if installed
            const [installedOutput] = this.utils.executeCommand('dpkg-query', [
                '-W',
                '-f=${Status}',
                packageName
            ]);
            const installed = installedOutput.includes('install ok installed');

            return {
                id: `deb:${packageName}`,
                name: info['Package'] || packageName,
                summary: info['Description']?.split('\n')[0] || '',
                description: info['Description'] || '',
                icon: this.getDebianPackageIcon(packageName, info['Section'] || ''),
                version: info['Version'] || '',
                size: this.parseDebianSize(info['Installed-Size'] || '0'),
                category: this.mapDebianSection(info['Section'] || ''),
                developer: info['Maintainer'] || 'Unknown',
                license: info['License'] || 'Unknown',
                homepage: info['Homepage'] || '',
                screenshots: [],
                source: 'debian',
                installed: installed,
                rating: 0
            };
        } catch (error) {
            return null;
        }
    }

    private getDebianPackageIcon(packageName: string, section: string): string {
        // Try to get icon from package name or section
        const sectionIcons: { [key: string]: string } = {
            'admin': 'system-run-symbolic',
            'devel': 'applications-development',
            'doc': 'text-x-generic-symbolic',
            'editors': 'text-editor-symbolic',
            'electronics': 'applications-engineering',
            'games': 'applications-games',
            'gnome': 'gnome-logo-icon',
            'graphics': 'applications-graphics',
            'interpreters': 'utilities-terminal-symbolic',
            'kde': 'kde-symbolic',
            'mail': 'mail-send-symbolic',
            'math': 'accessories-calculator-symbolic',
            'net': 'network-workgroup-symbolic',
            'news': 'news-feed-symbolic',
            'science': 'applications-science',
            'sound': 'applications-multimedia',
            'text': 'text-x-generic-symbolic',
            'utils': 'applications-utilities',
            'video': 'video-x-generic-symbolic',
            'web': 'web-browser-symbolic',
            'x11': 'video-display-symbolic',
        };

        const mainSection = section.split('/')[0];
        return sectionIcons[mainSection] || 'package-x-generic';
    }

    private mapDebianSection(section: string): string {
        const sectionMap: { [key: string]: string } = {
            'admin': 'System',
            'devel': 'Development',
            'doc': 'Documentation',
            'editors': 'Office',
            'games': 'Games',
            'gnome': 'GNOME',
            'graphics': 'Graphics',
            'kde': 'KDE',
            'mail': 'Internet',
            'net': 'Internet',
            'science': 'Education',
            'sound': 'Multimedia',
            'utils': 'Utilities',
            'video': 'Multimedia',
            'web': 'Internet',
        };

        const mainSection = section.split('/')[0];
        return sectionMap[mainSection] || 'Other';
    }

    private parseDebianSize(sizeStr: string): number {
        // Debian size is in KB
        const size = parseInt(sizeStr) || 0;
        return size * 1024; // Convert to bytes
    }

    // Flatpak methods
    public async searchFlatpakPackages(query: string): Promise<PackageInfo[]> {
        const cacheKey = `flatpak:${query}`;
        const now = Date.now();

        // Check cache
        if (this.cache.has(cacheKey) && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
            return this.cache.get(cacheKey) || [];
        }

        try {
            const url = `https://flathub.org/api/v2/search/${encodeURIComponent(query)}`;
            const packages = await this.fetchFlatpakData(url);
            
            this.cache.set(cacheKey, packages);
            this.cacheTimestamp = now;
            
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
                        packages.push(this.parseFlatpakApp(hit));
                    }
                }

                resolve(packages);
            } catch (error) {
                reject(error);
            }
        });
    }

    public async getFlatpakAppDetails(appId: string): Promise<PackageInfo | null> {
        try {
            const url = `https://flathub.org/api/v2/appstream/${appId}`;
            const [stdout] = this.utils.executeCommand('curl', ['-s', url]);
            
            if (!stdout) return null;

            const data = JSON.parse(stdout);
            return this.parseFlatpakAppDetail(data);
        } catch (error) {
            console.error('Error fetching Flatpak app details:', error);
            return null;
        }
    }

    private parseFlatpakApp(data: any): PackageInfo {
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
            category: this.mapFlatpakCategory(data.categories?.[0] || ''),
            developer: data.developer_name || data.project_group || 'Unknown',
            license: data.project_license || 'Unknown',
            homepage: data.urls?.homepage || '',
            screenshots: (data.screenshots || []).map((s: any) => s.url || ''),
            source: 'flatpak',
            installed: installed,
            rating: 0
        };
    }

    private parseFlatpakAppDetail(data: any): PackageInfo {
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
            category: this.mapFlatpakCategory(data.categories?.[0] || ''),
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

    private mapFlatpakCategory(category: string): string {
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

    // Installation methods
    public installDebianPackage(packageName: string): boolean {
        try {
            // This would require pkexec for elevated privileges
            const [stdout, stderr] = this.utils.executeCommand('pkexec', [
                'apt-get',
                'install',
                '-y',
                packageName
            ]);
            
            return !stderr || !stderr.includes('error');
        } catch (error) {
            console.error('Error installing Debian package:', error);
            return false;
        }
    }

    public removeDebianPackage(packageName: string): boolean {
        try {
            const [stdout, stderr] = this.utils.executeCommand('pkexec', [
                'apt-get',
                'remove',
                '-y',
                packageName
            ]);
            
            return !stderr || !stderr.includes('error');
        } catch (error) {
            console.error('Error removing Debian package:', error);
            return false;
        }
    }

    public installFlatpakPackage(appId: string): boolean {
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

    public removeFlatpakPackage(appId: string): boolean {
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

    public clearCache(): void {
        this.cache.clear();
        this.cacheTimestamp = 0;
    }
}
