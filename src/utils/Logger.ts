export class Logger {
	private static isEnabled: boolean = false;

	public static setEnabled(enabled: boolean): void {
		this.isEnabled = enabled;
	}

	public static log(...args: unknown[]): void {
		if (this.isEnabled) {
			console.log(...args);
		}
	}

	public static warn(...args: unknown[]): void {
		if (this.isEnabled) {
			console.warn(...args);
		}
	}

	public static info(...args: unknown[]): void {
		if (this.isEnabled) {
			console.info(...args);
		}
	}

	public static debug(...args: unknown[]): void {
		if (this.isEnabled) {
			console.debug(...args);
		}
	}

	public static time(label: string): void {
		if (this.isEnabled) {
			console.time(label);
		}
	}

	public static timeEnd(label: string): void {
		if (this.isEnabled) {
			console.timeEnd(label);
		}
	}

	public static error(...args: unknown[]): void {
		console.error(...args);
	}
}
