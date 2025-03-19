const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Импортируем функцию для генерации UUID

// Замените 'YOUR_TELEGRAM_BOT_TOKEN' на ваш токен
const token = '7446240384:AAGXLTi_v6Q3X26eSHcLPhNOTwUNVzBrvMo';
// Создаем экземпляр бота
const bot = new TelegramBot(token, { polling: true });

// Файл для хранения вопросов
const QUESTIONS_FILE = 'questions.json';

// Массив для хранения вопросов
let questions = [];

// Загрузка вопросов из файла
if (fs.existsSync(QUESTIONS_FILE)) {
    const data = fs.readFileSync(QUESTIONS_FILE, 'utf8');
    questions = JSON.parse(data);
}

// Сохранение вопросов в файл
function saveQuestions() {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf8');
}

// Функция для создания инлайн-клавиатуры
function createInlineKeyboard(options, questionId) {
    const keyboard = [];
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const callbackData = `answer_${questionId}_${i}`; // Добавляем ID вопроса в callback_data
        keyboard.push([{ text: option, callback_data: callbackData }]);
    }
    return { reply_markup: { inline_keyboard: keyboard } };
}

// Отправка вопроса в канал: сначала изображение, затем варианты ответов
function sendMessageWithKeyboard(chatId, questionIndex) {
    const question = questions[questionIndex];
    // Отправляем изображение с текстом вопроса
    bot.sendPhoto(chatId, question.image, {
        caption: question.question
    }).then(() => {
        // Отправляем варианты ответов отдельным сообщением с инлайн-клавиатурой
        bot.sendMessage(chatId, "Выберите вариант ответа:", createInlineKeyboard(question.options, question.id))
            .then(() => {
                console.log("Options sent successfully");
            })
            .catch((error) => {
                console.error("Error sending options:", error);
            });
    }).catch((error) => {
        console.error("Error sending photo:", error);
    });
}

// Создаем постоянную клавиатуру для управления ботом
const adminKeyboard = {
    reply_markup: {
        keyboard: [
            ["Добавить новый вопрос"],
            ["Отправить вопрос в канал"],
            ["Показать все вопросы"]
        ],
        resize_keyboard: true, // Автоматически изменять размер клавиатуры
        one_time_keyboard: false // Клавиатура остается после использования
    }
};

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId, "Привет! Я готов к работе. Выберите действие:", adminKeyboard);
    } catch (error) {
        console.error("Error sending start message:", error);
    }
});

// Команда /add_question для добавления нового вопроса
bot.onText(/\/add_question/, async (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "Введите новый вопрос:");
    bot.once('message', (questionMsg) => {
        const question = questionMsg.text;

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
                    bot.once('message', (explanationMsg) => {
                        const explanation = explanationMsg.text;

                        const uniqueId = uuidv4(); // Генерируем уникальный ID для вопроса

                        questions.push({
                            id: uniqueId, // Добавляем уникальный ID
                            question,
                            options,
                            correctAnswer,
                            explanation,
                            image: photoFileId, // Сохраняем ID изображения
                            chatId // Сохраняем ID чата
                        });
                        saveQuestions();
                        bot.sendMessage(chatId, "Новый вопрос успешно добавлен!", adminKeyboard);
                    });
                });
            });
        });
    });
});

// Обработка текстовых сообщений от администратора
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "Добавить новый вопрос") {
        bot.sendMessage(chatId, "Введите новый вопрос:");
        bot.once('message', (questionMsg) => {
            const question = questionMsg.text;

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
                        bot.once('message', (explanationMsg) => {
                            const explanation = explanationMsg.text;

                            const uniqueId = uuidv4(); // Генерируем уникальный ID для вопроса

                            questions.push({
                                id: uniqueId, // Добавляем уникальный ID
                                question,
                                options,
                                correctAnswer,
                                explanation,
                                image: photoFileId, // Сохраняем ID изображения
                                chatId // Сохраняем ID чата
                            });
                            saveQuestions();
                            bot.sendMessage(chatId, "Новый вопрос успешно добавлен!", adminKeyboard);
                        });
                    });
                });
            });
        });
    } else if (text === "Отправить вопрос в канал") {
        if (questions.length === 0) {
            bot.sendMessage(chatId, "Нет доступных вопросов.", adminKeyboard);
            return;
        }
        let message = "Доступные вопросы:\n";
        questions.forEach((q, index) => {
            message += `${index + 1}. ${q.question}\n`;
        });
        bot.sendMessage(chatId, message + "\nВыберите номер вопроса для отправки:", adminKeyboard);
        bot.once('message', (indexMsg) => {
            const index = parseInt(indexMsg.text) - 1;

            if (index >= 0 && index < questions.length) {
                const CHANNEL_ID = '-1002651603862'; // Замените на ID вашего канала
                sendMessageWithKeyboard(CHANNEL_ID, index);
                bot.sendMessage(chatId, "Вопрос отправлен в канал.", adminKeyboard);
            } else {
                bot.sendMessage(chatId, "Неверный номер вопроса.", adminKeyboard);
            }
        });
    } else if (text === "Показать все вопросы") {
        if (questions.length === 0) {
            bot.sendMessage(chatId, "Нет доступных вопросов.", adminKeyboard);
            return;
        }
        let message = "Список вопросов:\n";
        questions.forEach((q, index) => {
            message += `${index + 1}. ${q.question}\n`;
        });
        bot.sendMessage(chatId, message, adminKeyboard);
    }
});

// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (data.startsWith('answer_')) {
        const [_, questionId, userAnswerIndex] = data.split('_'); // Разбираем callback_data
        const currentQuestion = questions.find(q => q.id === questionId); // Находим вопрос по ID

        if (!currentQuestion) {
            console.error("No question found for ID:", questionId);
            return;
        }

        const userAnswer = currentQuestion.options[parseInt(userAnswerIndex)];
        try {
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
                    text: `❌ Неправильно. Правильный ответ: ${currentQuestion.correctAnswer}. ` + currentQuestion.explanation,
                    show_alert: true
                });
                await bot.sendMessage(userId, `Неверно. Правильный ответ: ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`);
            }
        } catch (error) {
            console.error("Error handling callback query:", error);
        }
    } else {
        console.error("Unknown callback data:", data);
    }
});