# Redis Wrapper


This is a node module for interacting with the redis.

Documentation for redis is available [here](https://redis.io).

---

### Installation

`npm install @shaitan-masters/redis`

`yarn add @shaitan-masters/redis`

---

### Usage

#### Base

```typescript
import { Redis, RedisOptions } from '@shaitan-masters/redis';


const options: RedisOptions = {
    host: 'localhost',
    port: 6379,
};

const redis = new Redis(options);

interface Message {
    readonly hello: string;
    readonly moto: number;
}

await redis.listen('channel', (message: Message): void => {
    console.log(message); // { hello: 'world', moto: 667 }
});

await redis.publish('channel', { hello: 'world', moto: 667 });
```
