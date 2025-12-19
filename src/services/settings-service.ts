import Gio from "@girs/gio-2.0";

export class SettingsService {
    private static _instance: SettingsService;
    private settings: Gio.Settings;

    private constructor() {
        this.settings = new Gio.Settings({ schema_id: 'com.obision.ObisionAppStore' });
    }

    public static get instance(): SettingsService {
        if (!SettingsService._instance) {
            SettingsService._instance = new SettingsService();
        }
        return SettingsService._instance;
    }

    public getBoolean(key: string): boolean {
        return this.settings.get_boolean(key);
    }

    public setBoolean(key: string, value: boolean): void {
        this.settings.set_boolean(key, value);
    }

    public getString(key: string): string {
        return this.settings.get_string(key);
    }

    public setString(key: string, value: string): void {
        this.settings.set_string(key, value);
    }

    public getInt(key: string): number {
        return this.settings.get_int(key);
    }

    public setInt(key: string, value: number): void {
        this.settings.set_int(key, value);
    }
}
