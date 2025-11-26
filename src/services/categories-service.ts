import { Category, CategoriesData } from "../interfaces/category";

export class CategoriesService {
    private static _instance: CategoriesService;
    private categories: Category[] = [];

    private constructor() {
        this.loadCategories();
    }

    public static get instance(): CategoriesService {
        if (!CategoriesService._instance) {
            CategoriesService._instance = new CategoriesService();
        }
        return CategoriesService._instance;
    }

    public getCategories(): CategoriesData {
        return {
            categories: this.categories
        };
    }

    public getCategoryById(id: string): Category | undefined {
        return this.categories.find(c => c.id === id);
    }

    private loadCategories(): void {
        this.categories = [
            {
                id: 'development',
                name: 'Development',
                icon: 'applications-development',
                description: 'IDEs, editors, and development tools',
                appCount: 15
            },
            {
                id: 'graphics',
                name: 'Graphics',
                icon: 'applications-graphics',
                description: 'Image editors, 3D modeling, and design tools',
                appCount: 24
            },
            {
                id: 'games',
                name: 'Games',
                icon: 'applications-games',
                description: 'Gaming platforms and games',
                appCount: 45
            },
            {
                id: 'office',
                name: 'Office',
                icon: 'applications-office',
                description: 'Document editors, spreadsheets, and productivity tools',
                appCount: 12
            },
            {
                id: 'multimedia',
                name: 'Multimedia',
                icon: 'applications-multimedia',
                description: 'Audio and video players, editors',
                appCount: 32
            },
            {
                id: 'internet',
                name: 'Internet',
                icon: 'applications-internet',
                description: 'Web browsers, email clients, messaging',
                appCount: 28
            },
            {
                id: 'utilities',
                name: 'Utilities',
                icon: 'applications-utilities',
                description: 'System utilities and tools',
                appCount: 19
            },
            {
                id: 'education',
                name: 'Education',
                icon: 'applications-education',
                description: 'Educational software and learning tools',
                appCount: 18
            }
        ];
    }
}
