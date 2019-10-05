const GameApi = require('./api/game-api.js')
const PlayerApi = require('./api/player-api')
const MiscApi = require('./api/misc-api')

const settings = require('./config/settings.json')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

app = express()

let session = require('express-session')
const redis = require('redis')
const redisStore = require('connect-redis')(session)

const redisClient = redis.createClient()
app.use(session({
  secret: 'de78asdta8dyasdhi2jadajadazuckerbergzuperc00l',
  name: '_redisPractice',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
  store: new redisStore({ host: 'localhost', port: 6379, client: redisClient, ttl: 86400 * 1000 * 60 }),
}));

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors())

const gameApi = new GameApi(app)
const playerApi = new PlayerApi(app)
require('./api/auth-api').setupRoutes()
new MiscApi(app, gameApi, playerApi)

app.use(express.static('./public'))
app.get('*', (req, res) => res.sendFile('index.html', {root: './public'}))

app.listen(8081)
console.log('magic happning ')