// public/sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for incoming push messages
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.message || data.body || 'Please check the management system app of Al Jamea tus Saifiyah Sidhpur.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [200, 100, 200, 100, 200],
      sound: '/siyanat_alert.mp3', // Web Standards / Android Chrome custom ringtone
      data: {
        ticket_id: data.data?.ticket_id || data.ticket_id || '',
        url: data.redirect_url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Siyanat Ul Mumtalekaat', options)
    );
  } catch (error) {
    console.error('Error processing push event:', error);
  }
});

// Handle what happens when the user taps the notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const ticketId = event.notification.data?.ticket_id || '';
  
  // Construct the URL with query parameter for GlobalActionController
  const urlToOpen = new URL(`/?action_ticket=${ticketId}`, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});