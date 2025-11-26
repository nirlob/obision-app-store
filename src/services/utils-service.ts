import GLib from "@girs/glib-2.0";
import Gio from "@girs/gio-2.0";

export class UtilsService {
    private static _instance: UtilsService;

    private constructor() {}

    public static get instance(): UtilsService {
        if (!UtilsService._instance) {
            UtilsService._instance = new UtilsService();
        }
        return UtilsService._instance;
    }

    public executeCommand(command: string, args: string[] = []): [string, string] {
        try {
            const [success, stdout, stderr] = GLib.spawn_sync(
                null,
                [command, ...args],
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );

            if (!success) {
                return ['', 'Command execution failed'];
            }

            const decoder = new TextDecoder('utf-8');
            return [
                decoder.decode(stdout),
                decoder.decode(stderr)
            ];
        } catch (error) {
            return ['', `Error executing command: ${error}`];
        }
    }

    public executeCommandAsync(command: string, args: string[] = []): Promise<[string, string]> {
        return new Promise((resolve, reject) => {
            try {
                const proc = Gio.Subprocess.new(
                    [command, ...args],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );

                proc.communicate_utf8_async(null, null, (source, result) => {
                    try {
                        if (source) {
                            const [, stdout, stderr] = source.communicate_utf8_finish(result);
                            resolve([stdout || '', stderr || '']);
                        } else {
                            reject(new Error('Subprocess is null'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    public formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    public debounce(func: Function, wait: number): Function {
        let timeout: number | null = null;
        return function(...args: any[]) {
            if (timeout !== null) {
                GLib.source_remove(timeout);
            }
            timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, wait, () => {
                func(...args);
                timeout = null;
                return GLib.SOURCE_REMOVE;
            });
        };
    }
}
