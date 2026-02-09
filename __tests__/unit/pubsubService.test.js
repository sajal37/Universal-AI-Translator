let Redis;
let pubsubService;

describe('PubSubService', () => {
    beforeEach(() => {
        jest.resetModules();
        Redis = require('ioredis');
        pubsubService = require('../../services/pubsubService');
    });

    describe('publish', () => {
        it('should publish messages to Redis', async () => {
            const payload = { socketId: 'socket123', status: 'completed' };

            const result = await pubsubService.publish('translation:completed', payload);

            expect(result).toBe(1);
        });
    });

    describe('subscribe', () => {
        it('should subscribe to Redis channel and register handler', async () => {
            const handler = jest.fn();

            await expect(pubsubService.subscribe('translation:completed', handler))
                .resolves.not.toThrow();
        });
    });
});
