import GLib from "@girs/glib-2.0";
import Gio from "@girs/gio-2.0";
import { UtilsService } from "./utils-service";
import { CacheService } from "./cache-service";
import { PackageInfo, FlatpakApp, DebianPackage } from "../interfaces/package";

export class PackagesService {
    private static _instance: PackagesService;
    private utils: UtilsService;
    private cacheService: CacheService;
    private appstreamIconCache: Map<string, string> = new Map();
    private appstreamCacheLoaded: boolean = false;
    private appstreamCacheLoading: boolean = false;

    private constructor() {
        this.utils = UtilsService.instance;
        this.cacheService = CacheService.instance;
        
        // Iniciar carga de AppStream (foreground si no existe, background si existe)
        this.loadAppStreamCacheAsync().catch(err => {
            console.error('Error loading AppStream cache:', err);
        });
    }
    
    /**
     * Verifica si el caché AppStream está listo
     */
    public isAppStreamCacheReady(): boolean {
        return this.appstreamCacheLoaded;
    }
    
    /**
     * Espera a que el caché AppStream esté listo
     */
    public async waitForAppStreamCache(): Promise<void> {
        if (this.appstreamCacheLoaded) {
            return;
        }
        
        // Esperar hasta que se cargue
        return new Promise((resolve) => {
            const checkInterval = 100; // Check cada 100ms
            const check = () => {
                if (this.appstreamCacheLoaded) {
                    resolve();
                } else {
                    setTimeout(check, checkInterval);
                }
            };
            check();
        });
    }

    public static get instance(): PackagesService {
        if (!PackagesService._instance) {
            PackagesService._instance = new PackagesService();
        }
        return PackagesService._instance;
    }

    /**
     * Carga el caché AppStream compilado
     * - Si existe: carga inmediatamente y actualiza en background
     * - Si NO existe: construye en foreground (bloqueante, muestra loading)
     * Similar a gs_plugin_appstream_load_appstream de GNOME Software
     */
    private async loadAppStreamCacheAsync(): Promise<void> {
        if (this.appstreamCacheLoading) {
            return;
        }

        this.appstreamCacheLoading = true;
        const cacheDir = GLib.get_user_cache_dir();
        const cacheFile = GLib.build_filenamev([cacheDir, 'obision-store', 'appstream-icons.json']);

        let cacheExists = false;
        let cacheAge = 0;

        try {
            // Intentar cargar caché existente primero (inicio rápido)
            if (GLib.file_test(cacheFile, GLib.FileTest.EXISTS)) {
                cacheExists = true;
                
                const [success, contents] = GLib.file_get_contents(cacheFile);
                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const json = decoder.decode(contents);
                    const cached = JSON.parse(json);
                    
                    // Restaurar caché inmediatamente
                    this.appstreamIconCache = new Map(Object.entries(cached));
                    console.log(`✓ AppStream cache loaded from disk: ${this.appstreamIconCache.size} entries`);
                    this.appstreamCacheLoaded = true;
                    
                    // Calcular edad del caché
                    const file = Gio.File.new_for_path(cacheFile);
                    const info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
                    const mtime = info.get_modification_date_time();
                    if (mtime) {
                        const now = GLib.DateTime.new_now_local();
                        const diff = now.difference(mtime);
                        cacheAge = diff / 1000000; // microsegundos a segundos
                    }
                }
            }
        } catch (error) {
            console.debug('Error loading cached AppStream data:', error);
            cacheExists = false;
        }

        // El caché de iconos no expira - solo se construye una vez o se actualiza manualmente
        if (!cacheExists || this.appstreamIconCache.size === 0) {
            // NO EXISTE CACHÉ: construir en FOREGROUND (bloqueante, muestra loading)
            console.log('⏳ Icon cache missing, building in foreground...');
            
            try {
                await this.buildAppStreamCacheAsync();
                this.appstreamCacheLoaded = true;
                
                // Guardar caché compilado
                const cacheData = Object.fromEntries(this.appstreamIconCache);
                const json = JSON.stringify(cacheData, null, 2);
                
                // Crear directorio si no existe
                const dir = GLib.path_get_dirname(cacheFile);
                GLib.mkdir_with_parents(dir, 0o755);
                
                // Guardar archivo
                GLib.file_set_contents(cacheFile, json);
                console.log(`✓ Icon cache created: ${this.appstreamIconCache.size} entries`);
            } catch (error) {
                console.error('Error building icon cache:', error);
                this.appstreamCacheLoaded = true; // Marcar como listo aunque falle
            }
        }

        this.appstreamCacheLoading = false;
    }

    /**
     * Construye el caché de iconos desde los archivos YAML de AppStream
     * Estos archivos contienen metadatos de TODOS los paquetes en los repos de Debian
     */
    private async buildAppStreamCacheAsync(): Promise<void> {
        console.log('Building icon cache from AppStream YAML files...');
        
        try {
            // Leer archivos YAML de AppStream (comprimidos en gzip)
            const [yamlFiles] = await this.utils.executeCommandAsync('sh', ['-c',
                'ls /var/lib/app-info/yaml/*.yml.gz 2>/dev/null || true'
            ]);

            if (!yamlFiles || yamlFiles.trim().length === 0) {
                console.log('No AppStream YAML files found');
                return;
            }

            const files = yamlFiles.trim().split('\n').filter(f => f);
            console.log(`Processing ${files.length} AppStream YAML files...`);

            // Procesar cada archivo YAML de AppStream
            for (const yamlFile of files) {
                try {
                    // Leer y parsear YAML: extraer Package e Icon
                    // Formato: zcat file | awk pattern para encontrar Package + Icon
                    const [output] = await this.utils.executeCommandAsync('sh', ['-c',
                        `zcat "${yamlFile}" 2>/dev/null | awk '
                            /^Package:/ { pkg = $2 }
                            /^  - name:/ && pkg != "" {
                                icon = $3
                                gsub(/^[ \t]+/, "", icon)
                                if (icon != "") {
                                    # Extraer nombre del icono: packagename_iconname.png -> iconname
                                    split(icon, parts, "_")
                                    if (length(parts) > 1) {
                                        iconname = parts[2]
                                        gsub(/\\.png$/, "", iconname)
                                    } else {
                                        iconname = icon
                                        gsub(/\\.png$/, "", iconname)
                                    }
                                    print pkg ":" iconname
                                    pkg = ""
                                }
                            }
                        ' || true`
                    ]);

                    if (!output) continue;

                    const lines = output.trim().split('\n');
                    for (const line of lines) {
                        const parts = line.split(':');
                        if (parts.length !== 2) continue;
                        
                        const packageName = parts[0].trim();
                        let iconName = parts[1].trim();
                        
                        if (!packageName || !iconName) continue;
                        
                        // Remover sufijo -symbolic para iconos a color
                        iconName = iconName.replace(/-symbolic$/, '');
                        
                        // Los iconos de AppStream están en /var/lib/app-info/icons/
                        // Intentar encontrar el icono en los directorios estándar
                        // GTK puede encontrarlos automáticamente si están en los paths de iconos del sistema
                        
                        // Guardar con múltiples variantes
                        const variants = [
                            packageName,
                            packageName.replace(/[-_].*/g, ''), // firefox-esr -> firefox
                            packageName.split('.').pop() || packageName, // org.gnome.gedit -> gedit
                        ];
                        
                        for (const variant of variants) {
                            if (variant && !this.appstreamIconCache.has(variant)) {
                                this.appstreamIconCache.set(variant, iconName);
                            }
                        }
                    }
                } catch (fileError) {
                    console.debug(`Error processing ${yamlFile}:`, fileError);
                }
            }

            console.log(`✓ Icon cache built: ${this.appstreamIconCache.size} entries`);
            
        } catch (error) {
            console.error('Error building icon cache:', error);
        }
    }

    // Debian packages methods
    public async searchDebianPackagesAsync(query: string): Promise<PackageInfo[]> {
        // Check cache first
        const cacheKey = this.cacheService.getCacheKey('debian', query);
        const cached = this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const [stdout] = await this.utils.executeCommandAsync('apt-cache', [
                'search',
                '--names-only',
                query.toLowerCase()
            ]);

            const packages: PackageInfo[] = [];
            const lines = stdout.trim().split('\n');

            // Primero buscar coincidencia exacta
            let exactMatch: PackageInfo | null = null;
            for (const line of lines) {
                const match = line.match(/^(\S+)\s+-\s+(.+)$/);
                if (match) {
                    const [, name, summary] = match;
                    if (name.toLowerCase() === query.toLowerCase()) {
                        exactMatch = await this.getDebianPackageInfoAsync(name);
                        break;
                    }
                }
            }

            // Si hay coincidencia exacta, ponerla primero
            if (exactMatch) {
                packages.push(exactMatch);
            }

            // Luego agregar otros paquetes (máximo 50)
            for (const line of lines.slice(0, 50)) {
                const match = line.match(/^(\S+)\s+-\s+(.+)$/);
                if (match) {
                    const [, name, summary] = match;
                    // Skip if already added as exact match
                    if (exactMatch && name.toLowerCase() === query.toLowerCase()) {
                        continue;
                    }
                    const packageInfo = await this.getDebianPackageInfoAsync(name);
                    if (packageInfo) {
                        packages.push(packageInfo);
                    }
                }
            }

            // Save to cache
            this.cacheService.set(cacheKey, packages, query);

            return packages;
        } catch (error) {
            console.error('Error searching Debian packages:', error);
            return [];
        }
    }

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

    private async getDebianPackageInfoAsync(packageName: string): Promise<PackageInfo | null> {
        try {
            const [stdout] = await this.utils.executeCommandAsync('apt-cache', ['show', packageName]);
            
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

            // Check if installed (async)
            const [installedOutput] = await this.utils.executeCommandAsync('dpkg-query', [
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
            console.error(`Error getting info for ${packageName}:`, error);
            return null;
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
        // 1. Buscar coincidencia exacta en caché
        if (this.appstreamIconCache.has(packageName)) {
            const iconName = this.appstreamIconCache.get(packageName)!;
            // Si es una ruta completa, retornarla
            if (iconName.startsWith('file://') || iconName.startsWith('/')) {
                return iconName;
            }
            // Buscar el icono en AppStream cache
            const iconPath = this.findAppStreamIcon(packageName, iconName);
            if (iconPath) {
                return `file://${iconPath}`;
            }
            return iconName;
        }
        
        // 2. Buscar variantes del nombre (firefox-esr -> firefox)
        const baseName = packageName.replace(/[-_].*/g, '');
        if (baseName !== packageName && this.appstreamIconCache.has(baseName)) {
            const iconName = this.appstreamIconCache.get(baseName)!;
            if (iconName.startsWith('file://') || iconName.startsWith('/')) {
                return iconName;
            }
            const iconPath = this.findAppStreamIcon(baseName, iconName);
            if (iconPath) {
                return `file://${iconPath}`;
            }
            return iconName;
        }

        // 3. Fallback to section-based icons
        const sectionIcons: { [key: string]: string } = {
            'admin': 'system-run',
            'devel': 'applications-development',
            'doc': 'text-x-generic',
            'editors': 'text-editor',
            'electronics': 'applications-engineering',
            'games': 'applications-games',
            'gnome': 'gnome-logo-icon',
            'graphics': 'applications-graphics',
            'interpreters': 'utilities-terminal',
            'kde': 'kde',
            'mail': 'mail-send',
            'math': 'accessories-calculator',
            'net': 'network-workgroup',
            'news': 'news-feed',
            'science': 'applications-science',
            'sound': 'applications-multimedia',
            'text': 'text-x-generic',
            'utils': 'applications-utilities',
            'video': 'video-x-generic',
            'web': 'web-browser',
            'x11': 'video-display',
        };

        const mainSection = section.split('/')[0];
        return sectionIcons[mainSection] || 'package-x-generic';
    }

    private findAppStreamIcon(packageName: string, iconName: string): string | null {
        // Buscar el icono en los directorios de AppStream
        // Los iconos están nombrados como: packagename_iconname.png
        const possiblePaths = [
            `/var/lib/app-info/icons/debian-trixie-main/64x64/${packageName}_${iconName}.png`,
            `/var/lib/app-info/icons/debian-trixie-contrib/64x64/${packageName}_${iconName}.png`,
            `/var/lib/app-info/icons/debian-trixie-non-free/64x64/${packageName}_${iconName}.png`,
            `/var/lib/app-info/icons/debian-trixie-main/128x128/${packageName}_${iconName}.png`,
        ];

        for (const path of possiblePaths) {
            try {
                if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                    return path;
                }
            } catch (e) {
                // Continuar con la siguiente ruta
            }
        }

        return null;
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
        this.cacheService.clear();
    }

    public getCacheStats() {
        return this.cacheService.getStats();
    }
}
