export interface Update {
    appId: string;
    appName: string;
    currentVersion: string;
    newVersion: string;
    size: number;
    changelog: string;
    icon: string;
}

export interface UpdatesData {
    updates: Update[];
    totalCount: number;
}
