import {Events} from '@osmium/events';
import Instance, {RedisOptions, Redis as RedisInstace} from 'ioredis';
import {RedisCallback, RedisConfig} from './types';
import {isObject} from '@osmium/tools';

export class Redis {
	private readonly timeout: number = 10000;

	public readonly events: Events;
	protected readonly config: RedisOptions | string;
	protected readonly connectionString: string;

	public readonly publisher: RedisInstace;
	public readonly subscriber: RedisInstace;
	public readonly client: RedisInstace;

	protected readonly subscribers: Map<string, RedisCallback[]> = new Map<string, RedisCallback[]>();

	static createInstance(connectionString: string, redisConfig: RedisOptions = {}, libraryConfig?: RedisConfig): Redis {
		return new Redis(connectionString, redisConfig, libraryConfig);
	}

	constructor(connectionString: string, redisConfig: RedisOptions = {}, libraryConfig?: RedisConfig) {
		this.connectionString = connectionString;
		this.config = Object.assign({
			enableReadyCheck: true
		}, redisConfig);

		this.events = new Events<string>();
		this.client = new Instance(connectionString, this.config);

		if (libraryConfig?.timeout) {
			this.timeout = libraryConfig.timeout;
		}

		this.client.on(Redis.redisEvent.CONNECT, () => this.events.emit(Redis.event.CONNECTED));
		this.client.on(Redis.redisEvent.READY, () => this.events.emit(Redis.event.READY));
		this.client.on(Redis.redisEvent.DISCONNECT, () => this.events.emit(Redis.event.DISCONNECTED));

		this.publisher = this.client.duplicate();
		this.subscriber = this.client.duplicate();

		this.client.on(Redis.redisEvent.ERROR, async (e) => {
			await this.events.emit(Redis.event.ERROR, Redis.errorSource.CLIENT, e);
			await this.events.emit(Redis.event.DISCONNECTED);

			this.client.disconnect(true);
		});

		this.publisher.on(Redis.redisEvent.ERROR, async (e) => {
			await this.events.emit(Redis.event.ERROR, Redis.errorSource.PUBLISHER, e);
			await this.events.emit(Redis.event.DISCONNECTED);

			this.client.disconnect(true);
		});

		this.subscriber.on(Redis.redisEvent.ERROR, async (e) => {
			await this.events.emit(Redis.event.ERROR, Redis.errorSource.SUBSCRIBER, e);
			await this.events.emit(Redis.event.DISCONNECTED);

			this.client.disconnect(true);
		});

		this.handlesSubscriberEvents();
	}

	onConnect(cb: (instance: Redis) => void | Promise<void>) {
		this.events.on(Redis.event.CONNECTED, () => {
			cb(this);
		});
	}

	onReady(cb: (instance: Redis) => void | Promise<void>) {
		this.events.on(Redis.event.READY, () => {
			cb(this);
		});
	}


	onDisconnect(cb: (instance: Redis) => void | Promise<void>) {
		this.events.on(Redis.event.DISCONNECTED, () => {
			cb(this);
		});
	}

	async awaitConnection(): Promise<void> {
		if (this.client.status === 'ready') return;

		const tId = setTimeout(() => {
			if (this.client.status === 'ready') return;

			throw new Error(`[Redis] Timeout - not connected to server - ${this.connectionString}`);
		}, this.timeout);

		await this.events.wait(Redis.event.READY);
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

export namespace Redis {
	export const enum redisEvent {
		CONNECT    = 'connect',
		READY      = 'ready',
		DISCONNECT = 'disconnect',
		ERROR      = 'error'
	}

	export const enum event {
		CONNECTED    = 'connected',
		READY        = 'ready',
		DISCONNECTED = 'disconnected',
		ERROR        = 'error'
	}

	export const enum errorSource {
		CLIENT     = 'client',
		PUBLISHER  = 'publisher',
		SUBSCRIBER = 'subscriber'
	}
}
