export type RedisConnectionEvents = 'connect'
	| 'ready'
	| 'error'
	| 'close'
	| 'reconnecting'
	| 'end'
	| 'wait';

export type RedisCallback<T = string | {}> = (message: T) => void;

