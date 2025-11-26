import GLib from "@girs/glib-2.0";
import Gio from "@girs/gio-2.0";
import { PackageInfo } from "../interfaces/package";

interface CacheEntry {
    data: PackageInfo[];
    timestamp: number;
    query: string;
}

interface CacheData {
    [key: string]: CacheEntry;
}

type CacheUpdateCallback = (key: string, data: PackageInfo[]) => void;

export class CacheService {
    private static _instance: CacheService;
    private cache: CacheData = {};
    private cacheFile: string;
    private readonly CACHE_DURATION = Infinity; // Cache nunca expira - solo se actualiza manualmente
    private updateCallbacks: Map<string, CacheUpdateCallback[]> = new Map();

    private constructor() {
        // Get cache directory
        const cacheDir = GLib.get_user_cache_dir();
        const appCacheDir = GLib.build_filenamev([cacheDir, 'obision-store']);
        
        // Create cache directory if it doesn't exist
        const dir = Gio.File.new_for_path(appCacheDir);
        if (!dir.query_exists(null)) {
            dir.make_directory_with_parents(null);
        }
        
        this.cacheFile = GLib.build_filenamev([appCacheDir, 'packages-cache.json']);
        this.loadCache();
    }

    public static get instance(): CacheService {
        if (!CacheService._instance) {
            CacheService._instance = new CacheService();
        }
        return CacheService._instance;
    }

    private loadCache(): void {
        try {
            const file = Gio.File.new_for_path(this.cacheFile);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const json = decoder.decode(contents);
                    this.cache = JSON.parse(json);
                    console.log(`Cache loaded from ${this.cacheFile}`);
                }
            }
        } catch (error) {
            console.error('Error loading cache:', error);
            this.cache = {};
        }
    }

    private saveCacheAsync(): void {
        // Save cache in background using GLib.idle_add
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                const json = JSON.stringify(this.cache, null, 2);
                const file = Gio.File.new_for_path(this.cacheFile);
                const encoder = new TextEncoder();
                const bytes = encoder.encode(json);
                file.replace_contents(
                    bytes,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null
                );
                console.log(`Cache saved to ${this.cacheFile}`);
            } catch (error) {
                console.error('Error saving cache:', error);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    public get(key: string): PackageInfo[] | null {
        const entry = this.cache[key];
        
        if (!entry) {
            return null;
        }

        // Check if cache entry is still valid
        const now = Date.now();
        if (now - entry.timestamp > this.CACHE_DURATION) {
            // Cache expired
            delete this.cache[key];
            this.saveCacheAsync();
            return null;
        }

        console.log(`Cache hit for key: ${key}`);
        return entry.data;
    }

    public set(key: string, data: PackageInfo[], query: string = ''): void {
        const isUpdate = this.cache[key] !== undefined;
        
        this.cache[key] = {
            data: data,
            timestamp: Date.now(),
            query: query
        };
        
        this.saveCacheAsync();
        console.log(`Cache set for key: ${key} (${data.length} packages)`);
        
        // Notify subscribers if this is an update
        if (isUpdate) {
            this.notifyUpdate(key, data);
        }
    }

    public subscribe(key: string, callback: CacheUpdateCallback): void {
        if (!this.updateCallbacks.has(key)) {
            this.updateCallbacks.set(key, []);
        }
        this.updateCallbacks.get(key)!.push(callback);
        console.log(`Subscribed to cache updates for key: ${key}`);
    }

    public unsubscribe(key: string, callback: CacheUpdateCallback): void {
        const callbacks = this.updateCallbacks.get(key);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
            if (callbacks.length === 0) {
                this.updateCallbacks.delete(key);
            }
        }
    }

    private notifyUpdate(key: string, data: PackageInfo[]): void {
        const callbacks = this.updateCallbacks.get(key);
        if (callbacks) {
            console.log(`Notifying ${callbacks.length} subscribers for key: ${key}`);
            for (const callback of callbacks) {
                // Execute callback in idle to not block
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    callback(key, data);
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }

    public has(key: string): boolean {
        const entry = this.cache[key];
        if (!entry) {
            return false;
        }

        const now = Date.now();
        if (now - entry.timestamp > this.CACHE_DURATION) {
            delete this.cache[key];
            this.saveCacheAsync();
            return false;
        }

        return true;
    }

    public clear(): void {
        this.cache = {};
        this.saveCacheAsync();
        console.log('Cache cleared');
    }

    public clearExpired(): void {
        const now = Date.now();
        let cleared = 0;

        for (const key in this.cache) {
            if (now - this.cache[key].timestamp > this.CACHE_DURATION) {
                delete this.cache[key];
                cleared++;
            }
        }

        if (cleared > 0) {
            this.saveCacheAsync();
            console.log(`Cleared ${cleared} expired cache entries`);
        }
    }

    public getStats(): { total: number; size: number } {
        let totalPackages = 0;
        const totalEntries = Object.keys(this.cache).length;

        for (const key in this.cache) {
            totalPackages += this.cache[key].data.length;
        }

        return {
            total: totalEntries,
            size: totalPackages
        };
    }

    public getCacheKey(source: string, query: string): string {
        return `${source}:${query.toLowerCase()}`;
    }
}
