export interface Application {
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
    installed: boolean;
    hasUpdate: boolean;
    rating: number;
    downloads: number;
}

export interface AppsData {
    apps: Application[];
    totalCount: number;
}
