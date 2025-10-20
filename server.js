const express = require('express');
const fs = require('fs');
const app = express();
const port = 8000;

const logStream = fs.createWriteStream('server.log', { flags: 'a' });

app.use((req, res, next) => {
  logStream.write(`Request for: ${req.url}\n`);
  next();
});

app.use(express.static('.'));
app.use('/node_modules', express.static('node_modules'));

app.listen(port, () => {
  logStream.write(`Server listening at http://localhost:${port}\n`);
});
