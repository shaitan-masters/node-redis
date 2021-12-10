"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
class Redis {
    config;
    publisher;
    subscriber;
    client;
    subscribers = new Map();
    constructor(config) {
        this.config = config;
        this.client = new ioredis_1.default(this.config);
        this.publisher = this.client.duplicate();
        this.subscriber = this.client.duplicate();
        this.handlesSubscriberEvents();
    }
    handlesSubscriberEvents() {
        this.subscriber.on('message', (channel, message) => {
            const exists = this.subscribers.get(channel);
            exists && exists.forEach(cb => cb(this.parseMessage(message)));
        });
    }
    parseMessage(message) {
        try {
            return JSON.parse(message);
        }
        catch (error) {
            return message;
        }
    }
    async publish(channel, message) {
        if (!['object', 'string'].includes(typeof message)) {
            throw new Error(`${message} is ${typeof message} wrong type`);
        }
        return this.publisher.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
    }
    async listen(channel, cb) {
        const exists = this.subscribers.get(channel);
        exists ? this.subscribers.set(channel, [...exists, cb]) : this.subscribers.set(channel, [cb]);
        return this.subscriber.subscribe(channel);
    }
}
exports.Redis = Redis;
//# sourceMappingURL=redis.js.map