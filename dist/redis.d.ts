import Instance, { RedisOptions } from 'ioredis';
import { RedisCallback } from './types';
export declare class Redis {
    protected readonly config: RedisOptions;
    readonly publisher: Instance.Redis;
    readonly subscriber: Instance.Redis;
    readonly client: Instance.Redis;
    protected readonly subscribers: Map<string, RedisCallback[]>;
    constructor(config: RedisOptions);
    protected handlesSubscriberEvents(): void;
    protected parseMessage(message: string): object | string;
    publish(channel: string, message: object): Promise<number>;
    publish(channel: string, message: string): Promise<number>;
    listen(channel: string, cb: RedisCallback): Promise<number>;
}
