const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid'); // Импортируем функцию для генерации UUID

// Замените 'YOUR_TELEGRAM_BOT_TOKEN' на ваш токен
const token = '7446240384:AAGXLTi_v6Q3X26eSHcLPhNOTwUNVzBrvMo';

// Создаем экземпляр бота
const bot = new TelegramBot(token, { polling: true });

// Подключаем Firestore
const db = require('./firebase.config'); // Подключаем Firestore

// Создаем постоянную клавиатуру для управления ботом
const adminKeyboard = {
    reply_markup: {
        keyboard: [
            ["Добавить новый вопрос"],
            ["Отправить вопрос в канал"],
            ["Показать все вопросы"],
            ["Редактировать вопрос"],
            ["Удалить вопрос"]
        ],
        resize_keyboard: true, // Автоматически изменять размер клавиатуры
        one_time_keyboard: false // Клавиатура остается после использования
    }
};

// Функция для создания инлайн-клавиатуры
function createInlineKeyboard(options, questionId) {
    const keyboard = [];
    for (let i = 0; i < options.length; i++) {
        const callbackData = `answer_${questionId}_${i}`; // Формируем уникальный callback_data
        keyboard.push([{ text: options[i], callback_data: callbackData }]);
    }
    return { reply_markup: { inline_keyboard: keyboard } };
}

// Отправка вопроса в канал: сначала изображение, затем варианты ответов
async function sendMessageWithKeyboard(chatId, questionId) {
    try {
        const questionRef = db.collection('questions').doc(questionId); // Получаем ссылку на вопрос
        const questionDoc = await questionRef.get();
        if (!questionDoc.exists) {
            console.error("Вопрос не найден в базе данных.");
            return;
        }

        const question = questionDoc.data();
        // Отправляем изображение с текстом вопроса и инлайн-клавиатурой
        bot.sendPhoto(chatId, question.image, {
            caption: question.question,
            reply_markup: createInlineKeyboard(question.options, question.id).reply_markup // Добавляем клавиатуру
        })
        .then(() => {
            console.log("Фото и варианты ответов успешно отправлены.");
        })
        .catch((error) => {
            console.error("Ошибка при отправке фото или вариантов ответов:", error);
        });
    } catch (error) {
        console.error("Ошибка в sendMessageWithKeyboard:", error);
    }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId, "Привет! Я готов к работе. Выберите действие:", adminKeyboard);
    } catch (error) {
        console.error("Ошибка при отправке стартового сообщения:", error);
    }
});

// Обработка текстовых сообщений от администратора
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "Добавить новый вопрос") {
        addNewQuestion(chatId);
    } else if (text === "Отправить вопрос в канал") {
        sendQuestionToChannel(chatId);
    } else if (text === "Показать все вопросы") {
        showAllQuestions(chatId);
    } else if (text === "Редактировать вопрос") {
        editQuestion(chatId);
    } else if (text === "Удалить вопрос") {
        deleteQuestion(chatId);
    }
});

// Функция для добавления нового вопроса
async function addNewQuestion(chatId) {
    bot.sendMessage(chatId, "Введите новый вопрос:");
    bot.once('message', (questionMsg) => {
        const question = questionMsg.text + '\n\nСтавь реакцию\n👍 - хороший вопрос\n👎 - вопрос не понравился';
        bot.sendMessage(chatId, "Отправьте изображение для вопроса:");
        bot.once('photo', async (photoMsg) => {
            const photoFileId = photoMsg.photo[photoMsg.photo.length - 1].file_id; // Берем ID изображения
            bot.sendMessage(chatId, "Введите варианты ответов через запятую:");
            bot.once('message', (optionsMsg) => {
                const options = optionsMsg.text.split(',').map(option => option.trim());
                bot.sendMessage(chatId, "Введите правильный ответ:");
                bot.once('message', (correctAnswerMsg) => {
                    const correctAnswer = correctAnswerMsg.text.trim();
                    bot.sendMessage(chatId, "Введите объяснение правильного ответа:");
                    bot.once('message', async (explanationMsg) => {
                        const explanation = explanationMsg.text;
                        const uniqueId = uuidv4(); // Генерируем уникальный ID для вопроса

                        // Сохраняем вопрос в Firestore
                        const questionData = {
                            id: uniqueId,
                            question,
                            options,
                            correctAnswer,
                            explanation,
                            image: photoFileId,
                            chatId: chatId.toString() // Преобразуем ID чата в строку
                        };

                        try {
                            await db.collection('questions').doc(uniqueId).set(questionData);
                            bot.sendMessage(chatId, "Новый вопрос успешно добавлен!", adminKeyboard);
                        } catch (error) {
                            console.error("Ошибка при добавлении вопроса в Firestore:", error);
                            bot.sendMessage(chatId, "Произошла ошибка при добавлении вопроса.");
                        }
                    });
                });
            });
        });
    });
}
// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (data.startsWith('answer_')) {
        const [_, questionId, userAnswerIndex] = data.split('_'); // Разбираем callback_data
        try {
            const questionRef = db.collection('questions').doc(questionId); // Получаем ссылку на вопрос
            const questionDoc = await questionRef.get();
            if (!questionDoc.exists) {
                console.error("Вопрос не найден в базе данных.");
                return;
            }

            const currentQuestion = questionDoc.data();
            const userAnswer = currentQuestion.options[parseInt(userAnswerIndex)];

            if (userAnswer === currentQuestion.correctAnswer) {
                await bot.answerCallbackQuery({
                    callback_query_id: callbackQuery.id,
                    text: `✅ Правильно! ${currentQuestion.explanation}`,
                    show_alert: true
                });
                await bot.sendMessage(userId, `${currentQuestion.explanation}`);
            } else {
                await bot.answerCallbackQuery({
                    callback_query_id: callbackQuery.id,
                    text: `❌ Неправильно. Попробуй ещё`,
                    show_alert: true
                });
                await bot.sendMessage(userId, `Неверно. Правильный ответ: ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`);
            }
        } catch (error) {
            console.error("Ошибка при обработке callback query:", error);
        }
    } else {
        console.error("Неизвестные данные callback:", data);
    }
});
// Функция для отправки вопроса в канал
async function sendQuestionToChannel(chatId) {
    try {
        const questionsSnapshot = await db.collection('questions').get();
        if (questionsSnapshot.empty) {
            bot.sendMessage(chatId, "Нет доступных вопросов.", adminKeyboard);
            return;
        }

        let message = "Доступные вопросы:\n";
        const questions = [];
        questionsSnapshot.forEach(doc => {
            questions.push({ id: doc.id, ...doc.data() });
            message += `${questions.length}. ${doc.data().question}\n`;
        });

        bot.sendMessage(chatId, message + "\nВыберите номер вопроса для отправки:", adminKeyboard);
        bot.once('message', async (indexMsg) => {
            const index = parseInt(indexMsg.text) - 1;
            if (index >= 0 && index < questions.length) {
                const selectedQuestion = questions[index];
                const CHANNEL_ID = '-1002651603862'; // Замените на ID вашего канала
                await sendMessageWithKeyboard(CHANNEL_ID, selectedQuestion.id);
                bot.sendMessage(chatId, "Вопрос отправлен в канал.", adminKeyboard);
            } else {
                bot.sendMessage(chatId, "Неверный номер вопроса.", adminKeyboard);
            }
        });
    } catch (error) {
        console.error("Ошибка при получении вопросов из Firestore:", error);
        bot.sendMessage(chatId, "Произошла ошибка при загрузке вопросов.");
    }
}

// Функция для показа всех вопросов
async function showAllQuestions(chatId) {
    try {
        const questionsSnapshot = await db.collection('questions').get();
        if (questionsSnapshot.empty) {
            bot.sendMessage(chatId, "Нет доступных вопросов.", adminKeyboard);
            return;
        }

        let message = "Список вопросов:\n";
        questionsSnapshot.forEach((doc, index) => {
            const question = doc.data();
            message += `${index + 1}. ${question.question}\n`;
        });

        bot.sendMessage(chatId, message, adminKeyboard);
    } catch (error) {
        console.error("Ошибка при получении вопросов из Firestore:", error);
        bot.sendMessage(chatId, "Произошла ошибка при загрузке вопросов.");
    }
}

// Функция для редактирования вопроса
async function editQuestion(chatId) {
    try {
        const questionsSnapshot = await db.collection('questions').get();
        if (questionsSnapshot.empty) {
            bot.sendMessage(chatId, "Нет доступных вопросов для редактирования.", adminKeyboard);
            return;
        }

        let message = "Доступные вопросы для редактирования:\n";
        const questions = [];
        questionsSnapshot.forEach(doc => {
            questions.push({ id: doc.id, ...doc.data() });
            message += `${questions.length}. ${doc.data().question}\n`;
        });

        bot.sendMessage(chatId, message + "\nВыберите номер вопроса для редактирования:", adminKeyboard);
        bot.once('message', async (indexMsg) => {
            const index = parseInt(indexMsg.text) - 1;
            if (index >= 0 && index < questions.length) {
                const selectedQuestion = questions[index];
                const questionId = selectedQuestion.id;

                bot.sendMessage(chatId, `Вы выбрали вопрос: "${selectedQuestion.question}". Что вы хотите изменить?`, {
                    reply_markup: {
                        keyboard: [
                            ["Текст вопроса"],
                            ["Варианты ответов"],
                            ["Правильный ответ"],
                            ["Объяснение"],
                            ["Отмена"]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });

                bot.once('message', async (editMsg) => {
                    const editAction = editMsg.text;

                    if (editAction === "Текст вопроса") {
                        bot.sendMessage(chatId, "Введите новый текст вопроса:");
                        bot.once('message', async (newQuestionMsg) => {
                            const newQuestionText = newQuestionMsg.text;
                            await db.collection('questions').doc(questionId).update({ question: newQuestionText });
                            bot.sendMessage(chatId, "Текст вопроса успешно обновлен!", adminKeyboard);
                        });
                    } else if (editAction === "Варианты ответов") {
                        bot.sendMessage(chatId, "Введите новые варианты ответов через запятую:");
                        bot.once('message', async (newOptionsMsg) => {
                            const newOptions = newOptionsMsg.text.split(',').map(option => option.trim());
                            await db.collection('questions').doc(questionId).update({ options: newOptions });
                            bot.sendMessage(chatId, "Варианты ответов успешно обновлены!", adminKeyboard);
                        });
                    } else if (editAction === "Правильный ответ") {
                        bot.sendMessage(chatId, "Введите новый правильный ответ:");
                        bot.once('message', async (newCorrectAnswerMsg) => {
                            const newCorrectAnswer = newCorrectAnswerMsg.text.trim();
                            await db.collection('questions').doc(questionId).update({ correctAnswer: newCorrectAnswer });
                            bot.sendMessage(chatId, "Правильный ответ успешно обновлен!", adminKeyboard);
                        });
                    } else if (editAction === "Объяснение") {
                        bot.sendMessage(chatId, "Введите новое объяснение:");
                        bot.once('message', async (newExplanationMsg) => {
                            const newExplanation = newExplanationMsg.text;
                            await db.collection('questions').doc(questionId).update({ explanation: newExplanation });
                            bot.sendMessage(chatId, "Объяснение успешно обновлено!", adminKeyboard);
                        });
                    } else if (editAction === "Отмена") {
                        bot.sendMessage(chatId, "Редактирование отменено.", adminKeyboard);
                    } else {
                        bot.sendMessage(chatId, "Неизвестное действие.", adminKeyboard);
                    }
                });
            } else {
                bot.sendMessage(chatId, "Неверный номер вопроса.", adminKeyboard);
            }
        });
    } catch (error) {
        console.error("Ошибка при редактировании вопроса:", error);
        bot.sendMessage(chatId, "Произошла ошибка при редактировании вопроса.");
    }
}

// Функция для удаления вопроса
async function deleteQuestion(chatId) {
    try {
        const questionsSnapshot = await db.collection('questions').get();
        if (questionsSnapshot.empty) {
            bot.sendMessage(chatId, "Нет доступных вопросов для удаления.", adminKeyboard);
            return;
        }

        let message = "Доступные вопросы для удаления:\n";
        const questions = [];
        questionsSnapshot.forEach(doc => {
            questions.push({ id: doc.id, ...doc.data() });
            message += `${questions.length}. ${doc.data().question}\n`;
        });

        bot.sendMessage(chatId, message + "\nВыберите номер вопроса для удаления:", adminKeyboard);
        bot.once('message', async (indexMsg) => {
            const index = parseInt(indexMsg.text) - 1;
            if (index >= 0 && index < questions.length) {
                const selectedQuestion = questions[index];
                const questionId = selectedQuestion.id;

                await db.collection('questions').doc(questionId).delete();
                bot.sendMessage(chatId, "Вопрос успешно удален!", adminKeyboard);
            } else {
                bot.sendMessage(chatId, "Неверный номер вопроса.", adminKeyboard);
            }
        });
    } catch (error) {
        console.error("Ошибка при удалении вопроса:", error);
        bot.sendMessage(chatId, "Произошла ошибка при удалении вопроса.");
    }
}