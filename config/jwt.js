function getJwtSecret() {
    return process.env.JWT_SECRET;
}

function requireJwtSecret() {
    const secret = getJwtSecret();
    if (!secret) {
        const error = new Error('JWT_SECRET is not set');
        error.statusCode = 500;
        throw error;
    }
    return secret;
}

module.exports = {
    getJwtSecret,
    requireJwtSecret
};
