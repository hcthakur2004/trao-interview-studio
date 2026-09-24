import http from 'node:http';
const pages: Record<string, string> = {
  '/robots.txt': 'User-agent: *\nDisallow: /private\n',
  '/quiet/':
    '<title>Quiet Company</title><main>We build inventory software for independent retailers. Contact our support team for product questions.</main>',
  '/acme/':
    '<title>Acme developer tools</title><main>Acme builds collaborative developer tools. <a href="people/">Meet our team and explore careers</a></main>',
  '/acme/people/':
    '<title>Working at Acme</title><main>We value mentorship and clear communication. <a href="../../handbook/your-next-chapter">How we hire</a></main>',
  '/handbook/your-next-chapter':
    '<title>Acme hiring process</title><main>Our interview process consists of a small take-home task, a system design discussion, and a behavioural interview with the team.</main>',
};
http
  .createServer((req, res) => {
    const content = pages[req.url || '/'];
    res.statusCode = content ? 200 : 404;
    res.setHeader('Content-Type', req.url === '/robots.txt' ? 'text/plain' : 'text/html');
    res.end(content || 'Not found');
  })
  .listen(8099, '127.0.0.1', () =>
    console.log('Evaluation fixture site: http://localhost:8099/acme/'),
  );
