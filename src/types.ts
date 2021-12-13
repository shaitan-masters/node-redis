export  {RedisOptions, Redis as RedisInstace} from 'ioredis';
export type RedisConnectionEvents = 'connect'
	| 'ready'
	| 'error'
	| 'close'
	| 'reconnecting'
	| 'end'
	| 'wait';

export type RedisCallback<T = string | {}> = (message: T) => void;
