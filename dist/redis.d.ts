import { RedisOptions, Redis as RedisInstace } from 'ioredis';
import { RedisCallback } from './types';
export declare class Redis {
    protected readonly config: RedisOptions;
    readonly publisher: RedisInstace;
    readonly subscriber: RedisInstace;
    readonly client: RedisInstace;
    protected readonly subscribers: Map<string, RedisCallback<string | {}>[]>;
    constructor(config: RedisOptions);
    protected handlesSubscriberEvents(): void;
    protected parseMessage(message: string): object | string;
    publish(channel: string, message: object): Promise<number>;
    publish(channel: string, message: string): Promise<number>;
    listen<T>(channel: string, cb: RedisCallback<T>): Promise<number>;
}
