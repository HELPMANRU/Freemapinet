const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Настройка CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com', 'https://www.yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:8080']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // 100 запросов с одного IP
});
app.use('/api/', limiter);

// Подключение к MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/map-points';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Схема для точек
const pointSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    userId: { type: String, default: 'anonymous' }
});

pointSchema.index({ lat: 1, lng: 1 });
const Point = mongoose.model('Point', pointSchema);

// Логирование запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Получение всех точек
app.get('/api/points', async (req, res) => {
    try {
        const points = await Point.find().sort({ createdAt: -1 }).limit(1000);
        res.json(points);
    } catch (error) {
        console.error('Error fetching points:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Добавление новой точки
app.post('/api/points', async (req, res) => {
    try {
        const { lat, lng, title, description } = req.body;
        if (!lat || !lng || !title) {
            return res.status(400).json({ error: 'lat, lng и title обязательны' });
        }
        if (title.length > 100) {
            return res.status(400).json({ error: 'Название не должно превышать 100 символов' });
        }
        if (description && description.length > 500) {
            return res.status(400).json({ error: 'Описание не должно превышать 500 символов' });
        }
        const point = new Point({ lat: parseFloat(lat), lng: parseFloat(lng), title, description: description || '' });
        const savedPoint = await point.save();
        console.log(`New point added: ${title}`);
        res.status(201).json(savedPoint);
    } catch (error) {
        console.error('Error saving point:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Статус сервера
app.get('/api/health', async (req, res) => {
    try {
        const count = await Point.countDocuments();
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            pointsCount: count
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 API endpoints:`);
    console.log(`   GET  /api/points - get all points`);
    console.log(`   POST /api/points - add new point`);
    console.log(`   GET  /api/health  - server status`);
});