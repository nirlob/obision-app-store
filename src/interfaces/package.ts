export interface PackageSource {
    id: string;
    name: string;
    type: 'debian' | 'flatpak';
    enabled: boolean;
}

export interface DebianPackage {
    name: string;
    version: string;
    section: string;
    priority: string;
    architecture: string;
    maintainer: string;
    installedSize: number;
    depends: string[];
    description: string;
    homepage: string;
}

export interface FlatpakApp {
    id: string;
    name: string;
    summary: string;
    description: string;
    icon: string;
    screenshots: Array<{
        url: string;
        type: string;
    }>;
    version: string;
    license: string;
    developer: string;
    homepage: string;
    downloadSize: number;
    installedSize: number;
    categories: string[];
    rating: number;
}

export interface PackageInfo {
    id: string;
    name: string;
    summary: string;
    description: string;
    icon: string;
    version: string;
    size: number;
    category: string;
    developer: string;
    license: string;
    homepage: string;
    screenshots: string[];
    source: 'debian' | 'flatpak';
    installed: boolean;
    rating: number;
}
