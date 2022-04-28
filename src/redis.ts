import {Events} from '@osmium/events';
import Instance, {RedisOptions, Redis as RedisInstace} from 'ioredis';
import {RedisCallback, RedisConfig} from './types';
import {isObject} from '@osmium/tools';

export class Redis {
	private readonly timeout: number = 10000;

	public readonly events: Events;
	protected readonly config: RedisOptions | string;

	public readonly publisher: RedisInstace;
	public readonly subscriber: RedisInstace;
	public readonly client: RedisInstace;
	public eventsList = {
		CONNECTED   : 'connected',
		DISCONNECTED: 'disconnected',
		ERROR       : 'error'
	};
	public errorSource = {
		CLIENT    : 'client',
		PUBLISHER : 'publisher',
		SUBSCRIBER: 'subscriber'
	};

	protected readonly subscribers: Map<string, RedisCallback[]> = new Map<string, RedisCallback[]>();

	constructor(redisConfig: RedisOptions | string, libraryConfig: RedisConfig | null = null) {
		this.config = redisConfig;

		this.events = new Events<string>();
		this.client = new Instance(this.config as RedisOptions);

		if (libraryConfig?.timeout) {
			this.timeout = libraryConfig.timeout;
		}

		this.client.on('connect', () => this.events.emit(this.eventsList.CONNECTED));
		this.client.on('disconnect', () => this.events.emit(this.eventsList.DISCONNECTED));

		this.publisher = this.client.duplicate();
		this.subscriber = this.client.duplicate();

		this.client.on('error', (e) => this.events.emit(this.eventsList.DISCONNECTED, this.errorSource.CLIENT, e));
		this.publisher.on('error', (e) => this.events.emit(this.eventsList.DISCONNECTED, this.errorSource.PUBLISHER, e));
		this.subscriber.on('error', (e) => this.events.emit(this.eventsList.DISCONNECTED, this.errorSource.SUBSCRIBER, e));

		this.handlesSubscriberEvents();
	}

	async awaitConnection(): Promise<void> {
		if (this.client.status === 'ready') return;

		const tId = setTimeout(() => {
			if (this.client.status === 'ready') return;

			const options = this.client.options;
			const connectionString = `${options.tls ? 'rediss' : 'redis'}://${options.host}:${options.port}/${options.db}`;

			throw new Error(`[Redis] Not connected to server - ${connectionString}`);
		}, this.timeout);

		await this.events.wait(this.eventsList.CONNECTED);
		clearTimeout(tId);
	}

	protected handlesSubscriberEvents(): void {
		this.subscriber.on('message', (channel, message: string): void => {
			const exists = this.subscribers.get(channel);
			exists && exists.forEach(cb => cb(this.parseMessage(message)));
		});
	}

	protected parseMessage(message: string): object | string {
		try {
			return JSON.parse(message);
		} catch (error) {
			return message;
		}
	}

	public async publish<MessageType = string | object>(channel: string, message: MessageType): Promise<number> {
		await this.awaitConnection();

		let stringMessage: string;
		if (isObject(message)) {
			stringMessage = JSON.stringify(message);
		} else {
			stringMessage = message as unknown as string;
		}

		return this.publisher.publish(channel, stringMessage);
	}

	public async listen<CallbackArgumentType>(channel: string, cb: RedisCallback<CallbackArgumentType>): Promise<number> {
		const exists = this.subscribers.get(channel);
		this.subscribers.set(channel, exists ? [...exists, cb] : [cb]);

		await this.awaitConnection();
		return await this.subscriber.subscribe(channel) as number;
	}

	async set(key: string, value: string, expire: string | number | null = null): Promise<void> {
		await this.awaitConnection();

		if (expire) {
			await this.client.setex(key, expire, value);
		} else {
			await this.client.set(key, value);
		}
	}

	async get(key: string): Promise<string | null> {
		await this.awaitConnection();

		return this.client.get(key);
	}

	async setObject<ValueType extends object = {}>(key: string, value: ValueType, assignToExists = false, expire: number | string | null = null): Promise<ValueType> {
		if (assignToExists) {
			const fetchedValue = await this.getObject<object>(key);

			let assignValue: object = {};
			if (fetchedValue) {
				assignValue = fetchedValue;
			}

			value = Object.assign(assignValue, value);
		}

		const encoded = JSON.stringify(value);
		await this.set(key, encoded, expire);

		return value;
	}

	async getObject<RetrunType extends object = {}>(key: string): Promise<RetrunType | null> {
		const ret = await this.get(key);
		if (!ret) return null;

		try {
			const fetchedData = JSON.parse(ret);

			return isObject(fetchedData) ? fetchedData : null;
		} catch (e) {
			return null;
		}
	}

	async del(...keyOrKeys: string[]): Promise<number> {
		await this.awaitConnection();

		return this.client.del(...keyOrKeys);
	}
}
