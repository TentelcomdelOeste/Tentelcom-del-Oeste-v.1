import { Network, ConnectionStatus } from '@capacitor/network';

export class NetworkProbe {
    private isOnlineStatus: boolean = navigator.onLine;
    private listeners: ((status: boolean) => void)[] = [];
    private timeoutId: NodeJS.Timeout | null = null;
    private readonly STABILITY_WINDOW_MS = 4000;

    constructor() {
        this.init();
    }

    private async init() {
        // Fallback or Initial setup
        this.isOnlineStatus = navigator.onLine;

        // Using capacitor network plugin
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
            try {
                const status = await Network.getStatus();
                this.updateStatus(status.connected);

                Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
                    this.updateStatus(status.connected);
                    console.log('Network status changed', status);
                });
            } catch (error) {
                console.warn('NetworkProbe: Failed to initialize Capacitor Network', error);
                this.setupWebFallback();
            }
        } else {
            // Web fallback
            this.setupWebFallback();
        }
    }

    private setupWebFallback() {
        window.addEventListener('online', () => this.updateStatus(true));
        window.addEventListener('offline', () => this.updateStatus(false));
    }

    private updateStatus(status: boolean) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (!status) {
            if (this.isOnlineStatus !== false) {
                this.isOnlineStatus = false;
                this.notifyListeners();
            }
        } else {
            this.timeoutId = setTimeout(() => {
                if (this.isOnlineStatus !== true) {
                    this.isOnlineStatus = true;
                    this.notifyListeners();
                }
            }, this.STABILITY_WINDOW_MS);
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.isOnlineStatus));
    }

    public isOnline() {
        return this.isOnlineStatus;
    }

    public subscribe(callback: (status: boolean) => void) {
        this.listeners.push(callback);
        // Fire immediately with current status
        callback(this.isOnlineStatus);
        
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }
}

export const networkProbe = new NetworkProbe();
