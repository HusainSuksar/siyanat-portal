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
      body: data.message,
      icon: '/icon-192x192.png', // Ensure you have this icon in your public folder
      badge: '/badge-72x72.png', // A small white-with-transparent-background icon
      vibrate: [200, 100, 200],
      data: {
        url: data.redirect_url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Error processing push event:', error);
  }
});

// Handle what happens when the user taps the notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Assuming your push payload includes { data: { ticket_id: "CMP-1234" } }
  const ticketId = event.notification.data?.ticket_id || '';
  
  // Construct the URL with a query parameter
  const urlToOpen = new URL(`/?action_ticket=${ticketId}`, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, focus it and navigate
      for (let client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      // If app is closed, open a new window with the URL
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});