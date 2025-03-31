const admin = require('firebase-admin');

// Импортируем файл с ключом сервисного аккаунта
const serviceAccount = require('./config/db-telegrambot-firebase-adminsdk-fbsvc-ba9c5ee21c.json');

// Инициализируем Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Экспортируем экземпляр Firestore
const db = admin.firestore();

module.exports = db;