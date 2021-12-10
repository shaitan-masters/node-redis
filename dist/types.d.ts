export { RedisOptions } from 'ioredis';
export declare type RedisConnectionEvents = 'connect' | 'ready' | 'error' | 'close' | 'reconnecting' | 'end' | 'wait';
export declare type RedisCallback<T = string | {}> = (message: T) => void;
