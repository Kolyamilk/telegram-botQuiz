require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const dbManager = require('./dbManager'); // Импортируем функции для работы с базой данных

// Замените 'YOUR_TELEGRAM_BOT_TOKEN' на ваш токен
const token = process.env.TELEGRAM_BOT_TOKEN || '7446240384:AAGXLTi_v6Q3X26eSHcLPhNOTwUNVzBrvMo';
// Создаем экземпляр бота
const bot = new TelegramBot(token, { polling: true });
const ADMIN_ID = 1902147359


//Авто реакция от Бота
// ID группы, куда пересылаются сообщения из канала
const GROUP_CHAT_ID = '-1002651603862'; // Замените на реальный ID вашей группы

// Обработчик новых сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;

    // Проверяем, что сообщение пришло из нужной группы
    if (chatId == GROUP_CHAT_ID) {
        try {
            // Ставим реакцию "👍" на новое сообщение
            await bot.setMessageReaction(chatId, messageId, {
                reaction: ['👍']
            });
            console.log(`Реакция "👍" успешно поставлена на сообщение ${messageId}`);
        } catch (error) {
            console.error("Ошибка при установке реакции:", error);
        }
    }
});


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
        one_time_keyboard: true // Клавиатура остается после использования
    }
};

// Функция для создания инлайн-клавиатуры
function createInlineKeyboard(options, questionId, correctAnswerIndex = null) {
    const keyboard = [];
    for (let i = 0; i < options.length; i++) {
        const callbackData = `answer_${questionId}_${i}`; // Формируем уникальный callback_data
        let buttonText = options[i];
        // Если это правильный ответ и он уже выбран, добавляем галочку
        if (correctAnswerIndex !== null && i === correctAnswerIndex) {
            buttonText += " ✅"; // Зелёная галочка
        }
        keyboard.push([{ text: buttonText, callback_data: callbackData }]);
    }
    return { reply_markup: { inline_keyboard: keyboard } };
}
// Обновление сообщения с вопросом после ответа
// async function updateQuestionMessage(chatId, messageId, questionId, correctAnswerIndex) {
//     try {
//         const questions = await dbManager.getAllQuestions();
//         const question = questions.find(q => q.id === questionId);
//         if (!question) {
//             console.error("Вопрос не найден в базе данных.");
//             return;
//         }
//         const totalAnswers = (question.correctAnswersCount || 0) + (question.wrongAnswersCount || 0);
//         const correctPercentage = totalAnswers > 0 ? Math.round((question.correctAnswersCount / totalAnswers) * 100) : 0;

//         const messageText = `${question.question}
// 📊 Статистика:
// Всего ответов: ${totalAnswers} 
// Правильно ответило: ${question.correctAnswersCount || 0} (${correctPercentage}%)`;
//         // Редактируем сообщение
//         await bot.editMessageCaption(messageText, {
//             chat_id: chatId,
//             message_id: messageId,
//             reply_markup: createInlineKeyboard(question.options, question.id, correctAnswerIndex).reply_markup
//         });
//     } catch (error) {
//         console.error("Ошибка при обновлении текста вопроса:", error);
//     }
// }
// Отправка вопроса в канал
async function sendMessageWithKeyboard(chatId, questionId) {
    try {
        const questions = await dbManager.getAllQuestions();
        const question = questions.find(q => q.id === questionId);
        if (!question) {
            console.error("Вопрос не найден в базе данных.");
            return;
        }
        const totalAnswers = (question.correctAnswersCount || 0) + (question.wrongAnswersCount || 0);
        const correctPercentage = totalAnswers > 0 ? Math.round((question.correctAnswersCount / totalAnswers) * 100) : 0;
        // Отправляем изображение с текстом вопроса и инлайн-клавиатурой
        const sentMessage = await bot.sendPhoto(chatId, question.image, {
            caption: question.question,
            reply_markup: createInlineKeyboard(question.options, question.id).reply_markup
        });
        console.log("Фото и варианты ответов успешно отправлены.");
    } catch (error) {
        console.error("Ошибка в sendMessageWithKeyboard:", error);
    }
}
// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (userId === ADMIN_ID) {
        try {
            await bot.sendMessage(chatId, "Привет! Я готов к работе. Выберите действие:", adminKeyboard);
        } catch (error) {
            console.error("Ошибка при отправке стартового сообщения:", error);
        }

    } else {
        await bot.sendMessage(chatId, "Этот бот работает только с администратором канала", adminKeyboard);
    }

});
// Обработка callback-запросов
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    if (data.startsWith('answer_')) {
        const [_, questionId, userAnswerIndex] = data.split('_');
        const userId = callbackQuery.from.id;
        try {
            const questions = await dbManager.getAllQuestions();
            const currentQuestion = questions.find(q => q.id === questionId);
            if (!currentQuestion) {
                console.error("Вопрос не найден в базе данных.");
                return;
            }
            // Проверяем, ответил ли пользователь ранее
            if (currentQuestion.answeredUsers.includes(userId)) {
                await bot.answerCallbackQuery({
                    callback_query_id: callbackQuery.id,
                    text: `Вы уже отвечали на этот вопрос. Ответ был: ✅${currentQuestion.correctAnswer}`,
                    show_alert: true
                });
                return;
            }
            const userAnswer = currentQuestion.options[parseInt(userAnswerIndex)];
            const isCorrect = userAnswer === currentQuestion.correctAnswer;
            // Добавляем пользователя в список ответивших
            if (isCorrect) {
                await dbManager.addUserToAnsweredUsers(questionId, userId);
                await dbManager.incrementAnswerCount(questionId, true); // Увеличиваем счетчик правильных ответов
                await bot.answerCallbackQuery({
                    callback_query_id: callbackQuery.id,
                    text: `✅ Правильно! ${currentQuestion.explanation}`,
                    show_alert: true
                });

            } else {
                await dbManager.incrementAnswerCount(questionId, false); // Увеличиваем счетчик неправильных ответов
                await bot.answerCallbackQuery({
                    callback_query_id: callbackQuery.id,
                    text: `❌ Неправильно. Попробуй ещё`,
                    show_alert: true
                });
            }


        } catch (error) {
            console.error("Ошибка при обработке callback query:", error);
        }
    } else {
        console.error("Неизвестные данные callback:", data);
    }
});
// Обработка текстовых сообщений от администратора
bot.on('message', async (msg) => {
    const userId = msg.from.id
    if (userId === ADMIN_ID) {
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
    } else {
        return
    }
});
// Добавление нового вопроса
async function addNewQuestion(chatId) {
    bot.sendMessage(chatId, "Введите новый вопрос:");
    bot.once('message', async (questionMsg) => {
        const question = questionMsg.text;
        bot.sendMessage(chatId, "Отправьте изображение для вопроса:");
        bot.once('photo', async (photoMsg) => {
            const photoFileId = photoMsg.photo[photoMsg.photo.length - 1].file_id; // Берем ID изображения
            bot.sendMessage(chatId, "Введите варианты ответов через запятую:");
            bot.once('message', async (optionsMsg) => {
                const options = optionsMsg.text.split(',').map(option => option.trim());
                bot.sendMessage(chatId, "Введите правильный ответ:");
                bot.once('message', async (correctAnswerMsg) => {
                    const correctAnswer = correctAnswerMsg.text.trim();
                    bot.sendMessage(chatId, "Введите объяснение правильного ответа:");
                    bot.once('message', async (explanationMsg) => {
                        const explanation = explanationMsg.text;
                        try {
                            const questionId = await dbManager.addNewQuestion({
                                question,
                                options,
                                correctAnswer,
                                explanation,
                                image: photoFileId,
                                chatId: chatId.toString()
                            });
                            bot.sendMessage(chatId, "Новый вопрос успешно добавлен!", adminKeyboard);
                        } catch (error) {
                            bot.sendMessage(chatId, "Произошла ошибка при добавлении вопроса.");
                        }
                    });
                });
            });
        });
    });
};
// Отправка вопроса в канал
async function sendQuestionToChannel(chatId) {
    try {
        const questions = await dbManager.getAllQuestions();
        if (questions.length === 0) {
            bot.sendMessage(chatId, "Нет доступных вопросов.", adminKeyboard);
            return;
        }
        let message = "Доступные вопросы:\n";
        questions.forEach((question, index) => {
            message += `${index + 1}. ${question.question}\n`;
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
// Показ всех вопросов
async function showAllQuestions(chatId) {
    try {
        const questions = await dbManager.getAllQuestions();
        if (questions.length === 0) {
            bot.sendMessage(chatId, "Нет доступных вопросов.", adminKeyboard);
            return;
        }
        let message = "Список вопросов:\n";
        questions.forEach((question, index) => {
            message += `${index + 1}. ${question.question}\n`;
        });
        bot.sendMessage(chatId, message, adminKeyboard);
    } catch (error) {
        console.error("Ошибка при получении вопросов из Firestore:", error);
        bot.sendMessage(chatId, "Произошла ошибка при загрузке вопросов.");
    }
}
// Редактирование вопроса
async function editQuestion(chatId) {
    try {
        const questions = await dbManager.getAllQuestions();
        if (questions.length === 0) {
            bot.sendMessage(chatId, "Нет доступных вопросов для редактирования.", adminKeyboard);
            return;
        }
        let message = "Доступные вопросы для редактирования:\n";
        questions.forEach((question, index) => {
            message += `${index + 1}. ${question.question}\n`;
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
                            await dbManager.updateQuestion(questionId, { question: newQuestionText });
                            bot.sendMessage(chatId, "Текст вопроса успешно обновлен!", adminKeyboard);
                        });
                    } else if (editAction === "Варианты ответов") {
                        bot.sendMessage(chatId, "Введите новые варианты ответов через запятую:");
                        bot.once('message', async (newOptionsMsg) => {
                            const newOptions = newOptionsMsg.text.split(',').map(option => option.trim());
                            await dbManager.updateQuestion(questionId, { options: newOptions });
                            bot.sendMessage(chatId, "Варианты ответов успешно обновлены!", adminKeyboard);
                        });
                    } else if (editAction === "Правильный ответ") {
                        bot.sendMessage(chatId, "Введите новый правильный ответ:");
                        bot.once('message', async (newCorrectAnswerMsg) => {
                            const newCorrectAnswer = newCorrectAnswerMsg.text.trim();
                            await dbManager.updateQuestion(questionId, { correctAnswer: newCorrectAnswer });
                            bot.sendMessage(chatId, "Правильный ответ успешно обновлен!", adminKeyboard);
                        });
                    } else if (editAction === "Объяснение") {
                        bot.sendMessage(chatId, "Введите новое объяснение:");
                        bot.once('message', async (newExplanationMsg) => {
                            const newExplanation = newExplanationMsg.text;
                            await dbManager.updateQuestion(questionId, { explanation: newExplanation });
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
// Удаление вопроса
async function deleteQuestion(chatId) {
    try {
        const questions = await dbManager.getAllQuestions();
        if (questions.length === 0) {
            bot.sendMessage(chatId, "Нет доступных вопросов для удаления.", adminKeyboard);
            return;
        }

        let message = "Доступные вопросы для удаления:\n";
        questions.forEach((question, index) => {
            message += `${index + 1}. ${question.question}\n`;
        });

        bot.sendMessage(chatId, message + "\nВыберите номер вопроса для удаления:", adminKeyboard);
        bot.once('message', async (indexMsg) => {
            const index = parseInt(indexMsg.text) - 1;
            if (index >= 0 && index < questions.length) {
                const selectedQuestion = questions[index];
                const questionId = selectedQuestion.id;
                await dbManager.deleteQuestion(questionId);
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