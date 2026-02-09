const request = require('supertest');
const express = require('express');

// Mock setup
jest.mock('../../middleware/middleware', () => ({
    checkUser: (req, res, next) => next()
}));

jest.mock('../../services/cacheService', () => ({
    getStats: jest.fn().mockResolvedValue({ hits: 10, misses: 2 }),
    getPopular: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(3),
    preloadCommon: jest.fn().mockResolvedValue(2)
}));

const cacheRoutes = require('../../routes/cacheRoutes');

const app = express();
app.use(express.json());
app.use('/cache', cacheRoutes);

describe('Cache API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /cache/stats', () => {
        it('should return cache statistics', async () => {
            const response = await request(app).get('/cache/stats');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('stats');
        });
    });

    describe('GET /cache/popular', () => {
        it('should return popular translations', async () => {
            const response = await request(app).get('/cache/popular');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('popular');
        });
    });

    describe('DELETE /cache/clear', () => {
        it('should clear all cache', async () => {
            const response = await request(app).delete('/cache/clear');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('cleared');
        });
    });

    describe('POST /cache/preload', () => {
        it('should preload common phrases', async () => {
            const response = await request(app)
                .post('/cache/preload')
                .send({ phrases: [{ source: 'en', target: 'es', text: 'hello' }] });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('loaded');
        });
    });
});
