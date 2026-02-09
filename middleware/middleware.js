const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');
const { requireJwtSecret } = require('../config/jwt');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkSignUp(req, res, next) {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    if (!emailPattern.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }
    next();
}

function checkSignIn(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!emailPattern.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    next();
}

async function checkUser(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'You must be logged in to translate' });

    const token = authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ message: 'You must be logged in to translate' });

    try {
        const decoded = jwt.verify(token, requireJwtSecret());
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(401).json({ message: 'User not found' });

        req.currentUser = { id: user.id, name: user.name, email: user.email };
        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        const status = err.statusCode || 401;
        res.status(status).json({ message: status === 500 ? 'Server misconfigured' : 'Invalid or expired token' });
    }
}

module.exports = { checkSignUp, checkSignIn, checkUser };
