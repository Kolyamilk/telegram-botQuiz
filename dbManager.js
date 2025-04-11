const { v4: uuidv4 } = require('uuid'); // Импортируем функцию для генерации UUID
const { FieldValue } = require('firebase-admin/firestore'); // Импортируем FieldValue из Admin SDK
const db = require('./firebase.config'); // Подключаем Firestore


async function addUserToAnsweredUsers(questionId, userId) {
    const questionRef = db.collection('questions').doc(questionId);
    await questionRef.update({
        answeredUsers: FieldValue.arrayUnion(userId) // Используем FieldValue напрямую
    });
}
// Функция для добавления нового вопроса
async function addNewQuestion(questionData) {
    const uniqueId = uuidv4(); // Генерируем уникальный ID для вопроса
    try {
        await db.collection('questions').doc(uniqueId).set({
            id: uniqueId,
            ...questionData,
            correctAnswersCount: 0, // Начальное значение
            wrongAnswersCount: 0,   // Начальное значение
            answeredBy: []
        });
        return uniqueId; // Возвращаем ID созданного вопроса
    } catch (error) {
        console.error("Ошибка при добавлении вопроса в Firestore:", error);
        throw error;
    }
}
// Функция для получения всех вопросов
async function getAllQuestions() {
    try {
        const questionsSnapshot = await db.collection('questions').get();
        if (questionsSnapshot.empty) {
            return [];
        }
        const questions = [];
        questionsSnapshot.forEach(doc => {
            questions.push({ id: doc.id, ...doc.data() });
        });
        return questions;
    } catch (error) {
        console.error("Ошибка при получении вопросов из Firestore:", error);
        throw error;
    }
}
// Функция для обновления вопроса
async function updateQuestion(questionId, updates) {
    try {
        await db.collection('questions').doc(questionId).update(updates);
    } catch (error) {
        console.error("Ошибка при обновлении вопроса в Firestore:", error);
        throw error;
    }
}
// Функция для удаления вопроса
async function deleteQuestion(questionId) {
    try {
        await db.collection('questions').doc(questionId).delete();
    } catch (error) {
        console.error("Ошибка при удалении вопроса из Firestore:", error);
        throw error;
    }
}
// Функция для увеличения счетчиков ответов
async function incrementAnswerCount(questionId, isCorrect) {
    try {
        const fieldToUpdate = isCorrect ? 'correctAnswersCount' : 'wrongAnswersCount';
        await db.collection('questions').doc(questionId).update({
            [fieldToUpdate]: FieldValue.increment(1)
        });
    } catch (error) {
        console.error("Ошибка при обновлении счетчиков ответов:", error);
        throw error;
    }
}
// Экспортируем функции
module.exports = {
    addNewQuestion,
    getAllQuestions,
    updateQuestion,
    deleteQuestion,
    incrementAnswerCount,
    addUserToAnsweredUsers
};