const GameApi = require('./api/game-api.js')
const PlayerApi = require('./api/player-api')
const MiscApi = require('./api/misc-api')

const settings = require('./config/settings.json')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

app = express()

const session = require('express-session')
const redis = require('redis')
const redisStore = require('connect-redis')(session)

const redisClient = redis.createClient()
app.use(session({
  secret: 'de78asdta8dyasdhi2jadajadazuckerbergzuperc00l',
  name: '_redisPractice',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: null },
  store: new redisStore({ host: 'localhost', port: 6379, client: redisClient, ttl: 86400 * 1000 * 1000 * 1000 * 60 }),
}));

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors())

require('./api/player-api').setupRoutes()
require('./api/office-api').setupRoutes()
require('./api/game-api').setupRoutes()
require('./api/auth-api').setupRoutes()
require('./api/misc-api').setupRoutes()

app.use(express.static('./public'))
app.get('*', (req, res) => res.sendFile('index.html', {root: './public'}))

app.listen(8081)
console.log('magic happning ')