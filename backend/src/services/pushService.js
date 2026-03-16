const { Expo } = require('expo-server-sdk');

const expo = new Expo();

async function sendMessagePush(pushToken, { title, body: rawBody, imageUrl }, data = {}) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

  const body =
    rawBody.length > 100
      ? rawBody.substring(0, 97) + '...'
      : rawBody;

  const message = {
    to: pushToken,
    sound: 'default',
    title: title || 'Новое сообщение',
    body,
    data,
  };

  if (imageUrl) {
    message.image = imageUrl;
  }

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error('[Push] Failed to send:', err.message);
  }
}

module.exports = { sendMessagePush };
