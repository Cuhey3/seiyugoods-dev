const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5000;
const app = express();

require('nunjucks').configure('views', {
  autoscape: true,
  express: app,
  watch: true
});

app
  .use(express.static(path.join(__dirname, 'public')))
  .use(require('body-parser').urlencoded({
    extended: true
  }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'html');

require('./controllers/MyController')(app);

app
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
