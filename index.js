const DatabaseFacade = require('./utils/databaseFacade')
const GameApi = require('./api/game-api.js')
const PlayerApi = require('./api/player-api')
const MiscApi = require('./api/misc-api')

const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

const databaseFacade = new DatabaseFacade()

const gameApi = new GameApi(app, databaseFacade)
const playerApi = new PlayerApi(app, databaseFacade)
new MiscApi(app, databaseFacade, gameApi, playerApi)

// import testIt from './tests/oneBigTester.js'
// testIt()
app.use(express.static('./public'))
app.get('*', (req, res) => res.sendFile('index.html', {root: './public'}))

app.listen(8081)
console.log('magic happning ')