// Simple static file server for NotesAI
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;
    
    // Default to index.html for root path
    if (filePath === '/') {
      filePath = '/index.html';
    }
    
    // Remove leading slash and serve from current directory
    const file = Bun.file('.' + filePath);
    
    return new Response(file);
  },
  error() {
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log('Press Ctrl+C to stop');
