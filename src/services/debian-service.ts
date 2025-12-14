import GLib from "@girs/glib-2.0";
import Gio from "@girs/gio-2.0";
import { UtilsService } from "./utils-service";
import { CacheService } from "./cache-service";
import { PackageInfo } from "../interfaces/package";

export class DebianService {
    private static _instance: DebianService;
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

    public static get instance(): DebianService {
        if (!DebianService._instance) {
            DebianService._instance = new DebianService();
        }
        return DebianService._instance;
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
        try {
            // Leer archivos YAML de AppStream (comprimidos en gzip)
            const [yamlFiles] = await this.utils.executeCommandAsync('sh', ['-c',
                'ls /var/lib/app-info/yaml/*.yml.gz 2>/dev/null || true'
            ]);

            if (!yamlFiles || yamlFiles.trim().length === 0) {
                return;
            }

            const files = yamlFiles.trim().split('\n').filter(f => f);

            // Procesar cada archivo YAML de AppStream
            for (const yamlFile of files) {
                try {
                    // Leer y parsear YAML: extraer Package e Icon
                    const [output] = await this.utils.executeCommandAsync('sh', ['-c',
                        `zcat "${yamlFile}" 2>/dev/null | awk '
                            /^Package:/ { pkg = $2 }
                            /^  - name:/ && pkg != "" {
                                icon = $3
                                gsub(/^[ \t]+/, "", icon)
                                if (icon != "") {
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
            
        } catch (error) {
            console.error('Error building icon cache:', error);
        }
    }

    public async searchPackagesAsync(query: string): Promise<PackageInfo[]> {
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
                        exactMatch = await this.getPackageInfoAsync(name);
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
                    const packageInfo = await this.getPackageInfoAsync(name);
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

    public searchPackages(query: string): PackageInfo[] {
        try {
            const [stdout] = this.utils.executeCommand('apt-cache', [
                'search',
                '--names-only',
                query.toLowerCase()
            ]);

            const packages: PackageInfo[] = [];
            const lines = stdout.trim().split('\n');

            for (const line of lines.slice(0, 50)) {
                const match = line.match(/^(\S+)\s+-\s+(.+)$/);
                if (match) {
                    const [, name, summary] = match;
                    const packageInfo = this.getPackageInfo(name);
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

    private async getPackageInfoAsync(packageName: string): Promise<PackageInfo | null> {
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
                icon: this.getPackageIcon(packageName, info['Section'] || ''),
                version: info['Version'] || '',
                size: this.parseSize(info['Installed-Size'] || '0'),
                category: this.mapSection(info['Section'] || ''),
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

    private getPackageInfo(packageName: string): PackageInfo | null {
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
                icon: this.getPackageIcon(packageName, info['Section'] || ''),
                version: info['Version'] || '',
                size: this.parseSize(info['Installed-Size'] || '0'),
                category: this.mapSection(info['Section'] || ''),
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

    private getPackageIcon(packageName: string, section: string): string {
        // 1. Buscar coincidencia exacta en caché
        if (this.appstreamIconCache.has(packageName)) {
            const iconName = this.appstreamIconCache.get(packageName)!;
            if (iconName.startsWith('file://') || iconName.startsWith('/')) {
                return iconName;
            }
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

    private mapSection(section: string): string {
        // Solo mapear secciones que típicamente contienen aplicaciones de escritorio
        // Excluye: librerías, herramientas CLI, módulos de lenguajes, etc.
        const sectionMap: { [key: string]: string } = {
            // Aplicaciones de escritorio
            'games': 'Games',
            'gnome': 'GNOME',
            'kde': 'KDE',
            'xfce': 'XFCE',
            'graphics': 'Graphics',
            'sound': 'Multimedia',
            'video': 'Multimedia',
            'web': 'Internet',
            'mail': 'Internet',
            'news': 'Internet',
            'science': 'Science',
            'education': 'Education',
            'editors': 'Office',
            'office': 'Office',
            'otherosfs': 'System',
            'hamradio': 'Communication',
            'electronics': 'Engineering',
            
            // Excluir estas secciones (retornar null para filtrarlas):
            // 'admin' - herramientas de administración CLI
            // 'devel' - librerías de desarrollo
            // 'doc' - documentación
            // 'interpreters' - intérpretes CLI
            // 'libs', 'libdevel', 'oldlibs' - librerías
            // 'perl', 'python', 'ruby', etc - módulos de lenguajes
            // 'utils' - utilidades CLI
            // 'text' - editores CLI
            // 'net' - herramientas de red CLI
            // 'x11' - librerías X11
            // 'debug' - paquetes de depuración
            // 'localization', 'translations' - archivos de idioma
            // 'shells' - shells de comandos
            // 'fonts' - fuentes
        };

        const mainSection = section.split('/')[0];
        const category = sectionMap[mainSection];
        
        // Si no está en el mapa, no es una app de escritorio
        return category || null as any;
    }

    private parseSize(sizeStr: string): number {
        // Debian size is in KB
        const size = parseInt(sizeStr) || 0;
        return size * 1024; // Convert to bytes
    }

    public installPackage(packageName: string): boolean {
        try {
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

    public removePackage(packageName: string): boolean {
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

    /**
     * Obtiene la lista de secciones disponibles en los repositorios de Debian
     * @returns Array de nombres de secciones únicas
     */
    public async getAvailableSections(): Promise<string[]> {
        try {
            // Obtener todas las secciones desde apt-cache
            const [stdout] = await this.utils.executeCommandAsync('sh', ['-c',
                "apt-cache dumpavail | grep '^Section:' | cut -d' ' -f2 | sort -u"
            ]);

            if (!stdout || stdout.trim().length === 0) {
                console.log('No sections found, returning defaults');
                return this.getDefaultSections();
            }

            const sections = stdout.trim().split('\n').filter(s => s.length > 0);
            console.log(`Found ${sections.length} sections from apt`);
            return sections;
        } catch (error) {
            console.error('Error getting available sections:', error);
            return this.getDefaultSections();
        }
    }

    /**
     * Obtiene secciones predeterminadas como fallback
     */
    private getDefaultSections(): string[] {
        return [
            'admin',
            'devel',
            'editors',
            'games',
            'gnome',
            'graphics',
            'kde',
            'mail',
            'net',
            'science',
            'sound',
            'text',
            'utils',
            'video',
            'web',
            'x11'
        ];
    }

    /**
     * Obtiene las categorías únicas mapeadas desde las secciones de Debian
     * Solo incluye secciones que contienen aplicaciones de escritorio
     * @returns Array de nombres de categorías amigables y únicas
     */
    public async getAvailableCategories(): Promise<string[]> {
        try {
            const sections = await this.getAvailableSections();
            const categories = new Set<string>();

            // Mapear cada sección a su categoría (solo apps de escritorio)
            for (const section of sections) {
                const category = this.mapSection(section);
                if (category) {  // Solo añadir si retorna una categoría válida
                    categories.add(category);
                }
            }

            // Convertir a array y ordenar
            const categoriesArray = Array.from(categories).sort();
            console.log(`Mapped ${sections.length} sections to ${categoriesArray.length} unique desktop app categories`);
            
            return categoriesArray;
        } catch (error) {
            console.error('Error getting available categories:', error);
            return this.getDefaultCategories();
        }
    }

    /**
     * Obtiene categorías predeterminadas como fallback
     * Solo aplicaciones de escritorio
     */
    private getDefaultCategories(): string[] {
        return [
            'Communication',
            'Education',
            'Engineering',
            'Games',
            'GNOME',
            'Graphics',
            'Internet',
            'KDE',
            'Multimedia',
            'Office',
            'Science',
            'System',
            'XFCE'
        ];
    }

    /**
     * Obtiene paquetes por sección
     * @param section Nombre de la sección (ej: 'games', 'graphics')
     * @param limit Número máximo de paquetes a retornar
     */
    public async getPackagesBySection(section: string, limit: number = 20): Promise<PackageInfo[]> {
        try {
            // Buscar paquetes en una sección específica
            const [stdout] = await this.utils.executeCommandAsync('sh', ['-c',
                `apt-cache search --names-only . | head -n 1000 | awk '{print $1}' | xargs -I {} sh -c "apt-cache show {} 2>/dev/null | grep -q '^Section: ${section}' && echo {}" | head -n ${limit}`
            ]);

            if (!stdout || stdout.trim().length === 0) {
                return [];
            }

            const packageNames = stdout.trim().split('\n').filter(p => p.length > 0);
            const packages: PackageInfo[] = [];

            for (const packageName of packageNames) {
                const pkg = await this.getPackageInfoAsync(packageName);
                if (pkg) {
                    packages.push(pkg);
                }
            }

            return packages;
        } catch (error) {
            console.error(`Error getting packages for section ${section}:`, error);
            return [];
        }
    }
}
