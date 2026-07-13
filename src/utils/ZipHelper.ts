/**
 * fflate works on a flat `{ "path/file": Uint8Array }` map. The folder classes
 * here add prefix-scoping on top of that to support folder-based access patterns.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export class ZipFile {
	constructor(
		public readonly name: string,
		private readonly data: Uint8Array
	) {}

	async async(type: 'string'): Promise<string>;
	async async(type: 'uint8array'): Promise<Uint8Array>;
	async async(type: 'string' | 'uint8array'): Promise<string | Uint8Array> {
		return type === 'string' ? strFromU8(this.data) : this.data;
	}
}

export class ZipFolderReader {
	constructor(
		private readonly prefix: string, // always has trailing slash
		private readonly allFiles: Record<string, Uint8Array>
	) {}

	file(relativePath: string): ZipFile | null {
		const data = this.allFiles[this.prefix + relativePath];
		return data !== undefined
			? new ZipFile(this.prefix + relativePath, data)
			: null;
	}

	filter(predicate: (relativePath: string) => boolean): ZipFile[] {
		const results: ZipFile[] = [];
		for (const [path, data] of Object.entries(this.allFiles)) {
			if (!path.startsWith(this.prefix)) continue;
			const relative = path.slice(this.prefix.length);
			// skip the directory entry itself and any nested dir markers
			if (!relative || relative.endsWith('/')) continue;
			if (predicate(relative)) results.push(new ZipFile(path, data));
		}
		return results;
	}

	forEach(callback: (relativePath: string, file: ZipFile) => void): void {
		for (const [path, data] of Object.entries(this.allFiles)) {
			if (!path.startsWith(this.prefix)) continue;
			const relative = path.slice(this.prefix.length);
			if (!relative || relative.endsWith('/')) continue;
			callback(relative, new ZipFile(path, data));
		}
	}
}

export class ZipReader {
	private constructor(
		private readonly rawFiles: Record<string, Uint8Array>
	) {}

	static async loadAsync(data: ArrayBuffer | Uint8Array): Promise<ZipReader> {
		const bytes =
			data instanceof ArrayBuffer ? new Uint8Array(data) : data;
		return new ZipReader(unzipSync(bytes));
	}

	get files(): Record<string, ZipFile> {
		const out: Record<string, ZipFile> = {};
		for (const [path, data] of Object.entries(this.rawFiles)) {
			if (!path.endsWith('/')) out[path] = new ZipFile(path, data);
		}
		return out;
	}

	file(path: string): ZipFile | null;
	file(pattern: RegExp): ZipFile[];
	file(pathOrPattern: string | RegExp): ZipFile | null | ZipFile[] {
		if (typeof pathOrPattern === 'string') {
			const data = this.rawFiles[pathOrPattern];
			return data !== undefined
				? new ZipFile(pathOrPattern, data)
				: null;
		}
		return Object.entries(this.rawFiles)
			.filter(([path]) => !path.endsWith('/') && pathOrPattern.test(path))
			.map(([path, data]) => new ZipFile(path, data));
	}

	/** Returns null when the folder contains no file entries. */
	folder(name: string): ZipFolderReader | null {
		const prefix = name.endsWith('/') ? name : `${name}/`;
		const hasFiles = Object.keys(this.rawFiles).some(
			(p) => p.startsWith(prefix) && p !== prefix
		);
		return hasFiles ? new ZipFolderReader(prefix, this.rawFiles) : null;
	}
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export class ZipFolderWriter {
	constructor(
		private readonly prefix: string,
		private readonly accumulator: Record<string, Uint8Array>
	) {}

	file(relativePath: string, content: string | Uint8Array): void {
		this.accumulator[this.prefix + relativePath] =
			typeof content === 'string' ? strToU8(content) : content;
	}

	folder(name: string): ZipFolderWriter {
		return new ZipFolderWriter(
			`${this.prefix}${name}/`,
			this.accumulator
		);
	}
}

export class ZipWriter {
	private readonly accumulator: Record<string, Uint8Array> = {};

	file(path: string, content: string | Uint8Array): void {
		this.accumulator[path] =
			typeof content === 'string' ? strToU8(content) : content;
	}

	folder(name: string): ZipFolderWriter {
		return new ZipFolderWriter(`${name}/`, this.accumulator);
	}

	/** Only `compressionOptions.level` is forwarded; other shape fields are no-ops. */
	async generateAsync(_opts?: {
		type?: 'uint8array';
		compression?: string;
		compressionOptions?: { level?: number };
	}): Promise<Uint8Array> {
		const level = (_opts?.compressionOptions?.level ?? 6) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
		const entries: Record<string, [Uint8Array, { level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }]> = {};
		for (const [path, data] of Object.entries(this.accumulator)) {
			entries[path] = [data, { level }];
		}
		return zipSync(entries);
	}
}
