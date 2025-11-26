export interface Category {
    id: string;
    name: string;
    icon: string;
    description: string;
    appCount: number;
}

export interface CategoriesData {
    categories: Category[];
}
