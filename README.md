# Telegram Quiz Bot

Telegram Quiz Bot — это уникальный бот, который я разработал специально для своего Telegram-канала: QuickQuizChannel . Идея заключалась в том, чтобы создавать интерактивные вопросы с вариантами ответов и иллюстрациями, а затем публиковать их на канале.

Бот не только помогает в создании контента, но и собирает статистику по ответам пользователей. Он отслеживает общее количество ответов, а также показывает процент правильных и неправильных ответов, что делает процесс еще более увлекательным.

В функционале бота есть доступ к каталогу всех созданных вопросов, где можно управлять контентом: редактировать вопросы, обновлять изображения или удалять их при необходимости. Это удобный инструмент для создания и поддержки интерактивного контента на канале

## Основные возможности
- **Отправка вопросов**: Вопросы отправляются с изображениями и вариантами ответов.
- **Обработка ответов**: Поддержка правильных и неправильных ответов с объяснением.
- **Обновление клавиатуры**: После выбора ответа клавиатура обновляется (для персональных сообщений).
- **Управление вопросами**:
  - Добавление новых вопросов.
  - Редактирование существующих вопросов.
  - Удаление вопросов.
- **Статистика ответов**: Счетчики правильных и неправильных ответов.
- **Хранение данных**: Все данные хранятся в базе данных Firebase.

---

## Технологии
Проект использует следующие технологии:
- **Node.js**: Для создания серверной части бота.
- **Telegram Bot API**: Для взаимодействия с Telegram.
- **UUID**: Для генерации уникальных ID вопросов.
- **Firebase Firestore**: В качестве базы данных для хранения вопросов и статистики.
- **Railway**: Облачный сервис, где работает бот.

---

## Установка и запуск

### Предварительные требования
1. Установите [Node.js](https://nodejs.org/) (версия 16 или выше).
2. Создайте бота в Telegram через [BotFather](https://core.telegram.org/bots#botfather) и получите токен.
3. Настройте базу данных Firebase:
   - Создайте проект в [Firebase Console](https://console.firebase.google.com/).
   - Получите конфигурацию для подключения к Firestore.
4. Зарегистрируйтесь на [Railway](https://railway.app/) (опционально, если хотите развернуть бота в облаке).

### Шаги для локальной настройки
1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/your-repo/telegram-quiz-bot.git
   cd telegram-quiz-bot
   npm i
   node index.js
2. создание файла .env (в которым все основные данные FIREBASE_SERVICE_ACCOUNT_KEY и токены бота)
   
