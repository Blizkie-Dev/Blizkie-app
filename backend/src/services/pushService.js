const { Expo } = require('expo-server-sdk');

const expo = new Expo();

async function sendMessagePush(pushToken, senderName, messageText) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

  const body =
    messageText.length > 100
      ? messageText.substring(0, 97) + '...'
      : messageText;

  try {
    const chunks = expo.chunkPushNotifications([
      {
        to: pushToken,
        sound: 'default',
        title: senderName || 'Новое сообщение',
        body,
        data: {},
      },
    ]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error('[Push] Failed to send:', err.message);
  }
}

module.exports = { sendMessagePush };
