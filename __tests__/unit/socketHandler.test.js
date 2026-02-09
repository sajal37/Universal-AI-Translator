// Mock dependencies
jest.mock('../../services/pubsubService');

const { initializeWebSocket } = require('../../websocket/socketHandler');

describe('SocketHandler', () => {
    let mockIo, mockSocket;

    beforeEach(() => {
        mockSocket = {
            id: 'socket123',
            on: jest.fn(),
            emit: jest.fn(),
            join: jest.fn(),
            leave: jest.fn()
        };

        mockIo = {
            on: jest.fn((event, handler) => {
                if (event === 'connection') {
                    handler(mockSocket);
                }
            }),
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };

        jest.clearAllMocks();
    });

    describe('initializeWebSocket', () => {
        it('should set up connection handler', () => {
            initializeWebSocket(mockIo);

            expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });

        it('should handle socket connection', () => {
            initializeWebSocket(mockIo);

            expect(mockSocket.on).toHaveBeenCalled();
        });

        it('should register disconnect handler', () => {
            initializeWebSocket(mockIo);

            const disconnectHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'disconnect'
            );

            expect(disconnectHandler).toBeDefined();
        });
    });

    describe('Socket Events', () => {
        it('should handle translate event', () => {
            initializeWebSocket(mockIo);

            const translateHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'translate'
            );

            expect(translateHandler).toBeDefined();
        });

        it('should handle authenticate event', () => {
            initializeWebSocket(mockIo);

            const authHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'authenticate'
            );

            expect(authHandler).toBeDefined();
        });
    });
});
