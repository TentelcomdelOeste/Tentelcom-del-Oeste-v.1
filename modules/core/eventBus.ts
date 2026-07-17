
type Listener = (payload: any) => void;

class EventBus {
    private listeners: Map<string, Listener[]> = new Map();

    subscribe(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(listener);
        return () => this.unsubscribe(event, listener);
    }

    unsubscribe(event: string, listener: Listener) {
        const list = this.listeners.get(event);
        if (list) {
            this.listeners.set(event, list.filter(l => l !== listener));
        }
    }

    emit(event: string, payload: any) {
        this.listeners.get(event)?.forEach(listener => listener(payload));
    }
}

export const eventBus = new EventBus();
