class Logger {
    info(message: string): void {
    console.log(`[INFO] ${message}`);
    }

    agent(message: string): void {
        console.log(`[AGENT] ${message}`);
    }

    decision(message: string): void {
        console.log(`[DECISION] ${message}`);
    }

    safety(message: string): void {
        console.log(`[SAFETY] ${message}`);
    }

    traffic(message: string): void {
        console.log(`[TRAFFIC] ${message}`);
    }

    error(message: string, error?: any): void {
        console.error(`[ERROR] ${message}`, error || '');
    }
}

export const logger = new Logger();