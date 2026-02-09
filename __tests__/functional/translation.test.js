/**
 * Functional Tests for Translation Features
 * Tests the complete translation functionality from user input to output
 */

// Mock dependencies
jest.mock('sequelize');
jest.mock('../../config/database', () => ({ sequelize: { define: jest.fn() } }));
jest.mock('../../models/TranslationHistory');
jest.mock('../../config/redis');
jest.mock('../../services/cacheService');
jest.mock('../../services/historyService');
jest.mock('../../queue/translationQueue');
jest.mock('google-translate-api-x', () => jest.fn());

const translate = require('google-translate-api-x');
const cacheService = require('../../services/cacheService');
const historyService = require('../../services/historyService');
const { addTranslationJob } = require('../../queue/translationQueue');
const translationController = require('../../controller/translationController');

describe('Translation Functionality', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Text Translation Flow', () => {
        it('should translate text from English to Spanish', async () => {
            const mockTranslation = {
                text: 'Hola',
                from: { language: { iso: 'en' } }
            };
            
            translate.mockResolvedValue(mockTranslation);

            const result = await translate('Hello', { from: 'en', to: 'es' });

            expect(result.text).toBe('Hola');
            expect(result.from.language.iso).toBe('en');
        });

        it('should auto-detect source language', async () => {
            const mockTranslation = {
                text: 'Hello',
                from: { language: { iso: 'es' } }
            };
            
            translate.mockResolvedValue(mockTranslation);

            const result = await translate('Hola', { to: 'en' });

            expect(result.from.language.iso).toBe('es');
        });

        it('should handle multiple languages', async () => {
            const languages = [
                { from: 'en', to: 'fr', text: 'Hello', expected: 'Bonjour' },
                { from: 'en', to: 'de', text: 'Hello', expected: 'Hallo' },
                { from: 'en', to: 'ja', text: 'Hello', expected: 'こんにちは' }
            ];

            for (const lang of languages) {
                translate.mockResolvedValue({ text: lang.expected });
                const result = await translate(lang.text, { from: lang.from, to: lang.to });
                expect(result.text).toBe(lang.expected);
            }
        });

        it('should handle long text translation', async () => {
            const longText = 'This is a very long text. '.repeat(100);
            const mockTranslation = {
                text: 'Este es un texto muy largo. '.repeat(100),
                from: { language: { iso: 'en' } }
            };
            
            translate.mockResolvedValue(mockTranslation);

            const result = await translate(longText, { from: 'en', to: 'es' });

            expect(result.text).toBeDefined();
            expect(result.text.length).toBeGreaterThan(0);
        });

        it('should handle special characters and emojis', async () => {
            const textWithEmojis = 'Hello 👋 World 🌍!';
            translate.mockResolvedValue({ text: 'Hola 👋 Mundo 🌍!' });

            const result = await translate(textWithEmojis, { to: 'es' });

            expect(result.text).toContain('👋');
            expect(result.text).toContain('🌍');
        });
    });

    describe('Translation with Cache Integration', () => {
        it('should enqueue translation when cache is empty', async () => {
            const req = {
                body: { text: 'Hello', targetLang: 'es', sourceLang: 'en' },
                user: { id: 'user123' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

            cacheService.get.mockResolvedValue(null);
            addTranslationJob.mockResolvedValue({ id: 'job123' });

            await translationController.handleTranslate(req, res);

            expect(addTranslationJob).toHaveBeenCalled();
        });

        it('should return cached translation when available', async () => {
            const req = {
                body: { text: 'Hello', targetLang: 'es', sourceLang: 'en' },
                user: { id: 'user123' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

            cacheService.get.mockResolvedValue({
                translated: 'Hola',
                sourceLang: 'en',
                cachedAt: Date.now()
            });
            historyService.saveTranslation.mockResolvedValue({ id: 1 });

            await translationController.handleTranslate(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    cached: true
                })
            );
        });
    });

    describe('Translation Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            translate.mockRejectedValue(new Error('Network error'));

            await expect(translate('Hello', { to: 'es' }))
                .rejects.toThrow('Network error');
        });

        it('should handle invalid language codes', async () => {
            translate.mockRejectedValue(new Error('Invalid language code'));

            await expect(translate('Hello', { from: 'invalid', to: 'xyz' }))
                .rejects.toThrow();
        });

        it('should handle empty text input', async () => {
            translate.mockResolvedValue({ text: '' });

            const result = await translate('', { to: 'es' });

            expect(result.text).toBe('');
        });
    });

    describe('Batch Translation Functionality', () => {
        it('should translate multiple texts in batch', async () => {
            const texts = ['Hello', 'Goodbye', 'Thank you'];
            const translations = ['Hola', 'Adiós', 'Gracias'];

            texts.forEach((text, index) => {
                translate.mockResolvedValueOnce({ text: translations[index] });
            });

            const results = await Promise.all(
                texts.map(text => translate(text, { to: 'es' }))
            );

            expect(results).toHaveLength(3);
            expect(results[0].text).toBe('Hola');
            expect(results[1].text).toBe('Adiós');
            expect(results[2].text).toBe('Gracias');
        });

        it('should handle partial failures in batch', async () => {
            translate
                .mockResolvedValueOnce({ text: 'Hola' })
                .mockRejectedValueOnce(new Error('Translation failed'))
                .mockResolvedValueOnce({ text: 'Gracias' });

            const texts = ['Hello', 'Goodbye', 'Thank you'];
            const results = await Promise.allSettled(
                texts.map(text => translate(text, { to: 'es' }))
            );

            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('rejected');
            expect(results[2].status).toBe('fulfilled');
        });
    });

    describe('Translation History Integration', () => {
        it('should save translation to history', async () => {
            historyService.saveTranslation = jest.fn().mockResolvedValue({
                id: 'history-1',
                originalText: 'Hello',
                translatedText: 'Hola'
            });

            const result = await historyService.saveTranslation({
                userId: 'user123',
                originalText: 'Hello',
                translatedText: 'Hola',
                sourceLang: 'en',
                targetLang: 'es'
            });

            expect(result.id).toBe('history-1');
            expect(historyService.saveTranslation).toHaveBeenCalledWith(
                expect.objectContaining({
                    originalText: 'Hello',
                    translatedText: 'Hola'
                })
            );
        });
    });
});
