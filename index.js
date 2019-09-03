const DatabaseFacade = require('./utils/databaseFacade')
const GameApi = require('./api/game-api.js')
const PlayerApi = require('./api/player-api')

const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

const databaseFacade = new DatabaseFacade()

new GameApi(app, databaseFacade)
new PlayerApi(app, databaseFacade)

// import testIt from './tests/oneBigTester.js'
// testIt()

// app.get('*', (req, res) => res.sendFile('index.html', {root: '../dips-pong-client/public'}))

app.listen(8081)
console.log('magic happning ')