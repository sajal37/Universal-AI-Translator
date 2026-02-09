class PrismaClient {
    constructor() {
        this.user = {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
    }
}

module.exports = {
    PrismaClient
};
