import Instance, {RedisOptions} from 'ioredis';
import {RedisCallback} from './types';


export class Redis {

	protected readonly config: RedisOptions;

	public readonly publisher: Instance.Redis;
	public readonly subscriber: Instance.Redis;
	public readonly client: Instance.Redis;

	protected readonly subscribers: Map<string, RedisCallback[]> = new Map<string, RedisCallback[]>();

	constructor(config: RedisOptions) {
		this.config = config;
		this.client = new Instance(this.config);
		this.publisher = this.client.duplicate();
		this.subscriber = this.client.duplicate();

		this.handlesSubscriberEvents();
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

	public publish(channel: string, message: object): Promise<number>;
	public publish(channel: string, message: string): Promise<number>;

	public async publish(channel: string, message: string | object): Promise<number> {
		if (!['object', 'string'].includes(typeof message)) {
			throw new Error(`${message} is ${typeof message} wrong type`);
		}

		return this.publisher.publish(
			channel,
			typeof message === 'string' ? message : JSON.stringify(message)
		);
	}

	public async listen(channel: string, cb: RedisCallback): Promise<number> {
		const exists = this.subscribers.get(channel);
		exists ? this.subscribers.set(channel, [...exists, cb]) : this.subscribers.set(channel, [cb]);

		return this.subscriber.subscribe(channel);
	}
}
