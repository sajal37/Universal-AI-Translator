const RedisMock = jest.fn(() => ({
    on: jest.fn(),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG')
}));

module.exports = RedisMock;
