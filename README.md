# Blizkie — Мессенджер

Telegram-подобный мессенджер с шифрованием сообщений, авторизацией по телефону/email и realtime чатами.

## Стек

| Слой | Технологии |
|---|---|
| Бэкенд | Node.js, Express, Socket.io, SQLite (better-sqlite3) |
| Шифрование | AES-256-GCM (встроенный `crypto` Node.js) |
| Авторизация | OTP-коды (email/SMS) + JWT |
| Мобильное приложение | React Native + Expo (iOS + Android) |
| Состояние | Zustand |
| HTTP-клиент | Axios |

## Быстрый старт

### 1. Запуск бэкенда

```bash
cd backend
npm install
# Скопируйте .env.example в .env и заполните переменные
cp .env.example .env
npm run dev
```

Бэкенд запустится на `http://localhost:3000`.

> **DEV_MODE=true** — коды верификации выводятся в консоль вместо отправки SMS/email. Это удобно для разработки.

### 2. Запуск мобильного приложения

```bash
cd mobile
npm install
```

Откройте `src/constants/config.ts` и укажите IP вашего компьютера:

```ts
export const API_BASE_URL = 'http://192.168.X.X:3000'; // ваш локальный IP
export const SOCKET_URL = 'http://192.168.X.X:3000';
```

> Используйте `ipconfig` (Windows) или `ifconfig` (Mac/Linux) чтобы узнать IP.

```bash
npx expo start
```

- Отсканируйте QR-код через **Expo Go** на iOS или Android
- Нажмите `i` для iOS симулятора или `a` для Android эмулятора

## Архитектура

```
Blizkie/
├── backend/
│   ├── src/
│   │   ├── index.js              # Точка входа, HTTP + Socket.io
│   │   ├── config/database.js    # SQLite подключение
│   │   ├── db/migrations.js      # Схема БД
│   │   ├── crypto/aes.js         # AES-256-GCM шифрование
│   │   ├── middleware/auth.js    # JWT проверка
│   │   ├── routes/               # REST API endpoints
│   │   ├── services/             # Бизнес-логика
│   │   └── socket/               # WebSocket обработчики
│   └── data/blizkie.db           # База данных (создаётся автоматически)
│
└── mobile/
    └── src/
        ├── navigation/           # React Navigation стеки
        ├── screens/              # Экраны приложения
        ├── components/           # Переиспользуемые компоненты
        ├── api/                  # HTTP-клиенты
        ├── socket/               # WebSocket клиент
        ├── store/                # Zustand состояние
        └── utils/                # Утилиты
```

## API Endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/auth/send-code` | Отправить OTP-код |
| POST | `/auth/verify` | Проверить код, получить JWT |
| GET | `/users/me` | Текущий пользователь |
| PATCH | `/users/me` | Обновить профиль |
| GET | `/users/search?q=` | Поиск пользователей |
| GET | `/chats` | Список чатов |
| POST | `/chats` | Создать / получить диалог |
| GET | `/chats/:id/messages` | Сообщения чата |
| POST | `/chats/:id/messages` | Отправить сообщение |

## Шифрование сообщений

Каждое сообщение шифруется перед записью в БД:

1. Генерируется случайный 12-байтный IV (nonce)
2. Текст шифруется **AES-256-GCM** с ключом из `MESSAGE_ENCRYPTION_KEY`
3. В БД хранятся: `ciphertext`, `iv`, `auth_tag` (в base64)
4. При чтении — расшифровка на лету перед отдачей клиенту

Скомпрометированная БД без ключа не даёт доступа к сообщениям.

## Генерация безопасных ключей

```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ключ шифрования сообщений (32 байта = 64 hex символа)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Socket.io события

| Событие | Направление | Описание |
|---|---|---|
| `join-chat` | client → server | Войти в комнату чата |
| `new-message` | server → client | Новое сообщение |
| `typing-start` | client → server | Пользователь печатает |
| `typing-stop` | client → server | Перестал печатать |
| `user-typing` | server → client | Кто-то печатает |
| `user-stopped-typing` | server → client | Перестал печатать |

## Сборка для iOS (Production)

```bash
cd mobile
npx expo install expo-build-properties
npx eas build --platform ios
```

Требуется Apple Developer Account и настроенный EAS CLI.

## Переменные окружения бэкенда

| Переменная | Описание |
|---|---|
| `PORT` | Порт сервера (по умолчанию 3000) |
| `JWT_SECRET` | Секрет для подписи JWT |
| `MESSAGE_ENCRYPTION_KEY` | 64-char hex ключ для AES-256-GCM |
| `SMTP_HOST` / `SMTP_PORT` | SMTP сервер для email |
| `SMTP_USER` / `SMTP_PASS` | Credentials SMTP |
| `DEV_MODE` | `true` = коды в консоль (без реальной отправки) |
