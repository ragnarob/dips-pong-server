const databaseFacade = require('../utils/databaseFacade')
const authorize = require('../middleware/authorize')
const ratingCalculator = require('../utils/ratingCalculator')

module.exports = class GameApi {
  constructor (app) {
    this.app = app
    this.databaseFacade = databaseFacade

    if (this.app) {
      this.setupRoutes()
    }
  }

  setupRoutes () {
    this.app.get('/api/games', this.hasOfficeIdInQuery, async (req, res) => {
      let allGames = await this.getAllGames(req.query.officeId)
      res.json(allGames)
    })

    this.app.get('/api/games/:id', async (req, res) => {
      let game = await this.getSingleGame(req.params.id)
      res.json(game)
    })

    this.app.post('/api/games', authorize, this.hasOfficeIdInBody, async (req, res) => {
      await this.addGame(req.body.officeId, req.body.winnerId, req.body.loserId)
      res.json({success: true})
    })

    this.app.delete('/api/games/:id', authorize, async (req, res) => {
      let result = await this.deleteGame(req.params.id)
      res.json(result)
    })

    this.app.get('/api/testratingsystem/systems', async (req, res) => {
      let result = await this.getRatingSystems()
      res.json(result)
    })

    this.app.get('/api/testratingsystem/samples', async (req, res) => {
      let result = await this.getSampleOutcomes()
      res.json(result)
    })

    this.app.get('/api/testratingsystem/:ratingSystemName', this.hasOfficeIdInQuery, async (req, res) => {
      let result = await this.testRatingSystem(req.params.ratingSystemName, req.query.officeId)
      res.json(result)
    })
  }

  async getAllGames (officeId) {
    let query = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelo AS winnerElo, game.loserelo AS loserElo, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser) WHERE game.office = ? ORDER BY timestamp DESC'

    let games = await this.databaseFacade.execute(query, [officeId])
    return games
  }

  async getSingleGame (gameId) {
    let query = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange, game.office AS office FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser) WHERE game.id = ?'
    let queryParams = [gameId]

    let gameResult = await this.databaseFacade.execute(query, queryParams)
    if (gameResult.length === 0) {
      return {error: 'No game with id ' + gameId}
    }
    return gameResult[0]
  }

  async addGame (officeId, winnerId, loserId) {
    let eloQuery = 'SELECT elo FROM player WHERE id = ? AND office = ?'

    let winnerElo = await this.databaseFacade.execute(eloQuery, [winnerId, officeId])
    winnerElo = winnerElo[0].elo
    let loserElo = await this.databaseFacade.execute(eloQuery, [loserId, officeId])
    loserElo = loserElo[0].elo

    let newData = ratingCalculator['Upset elo'](winnerElo, loserElo)
    let newWinnerElo = newData.newWinnerElo
    let winnerEloChange = newData.winnerEloChange
    let newLoserElo = newData.newLoserElo
    let loserEloChange = newData.loserEloChange

    let addGameQuery = 'INSERT INTO game (winner, loser, winnerelo, loserelo, winnerelochange, loserelochange, office) VALUES (?, ?, ?, ?, ?, ?, ?)'
    let addGameQueryParams = [winnerId, loserId, winnerElo, loserElo, winnerEloChange, loserEloChange, officeId]

    let updatePlayerQuery = 'UPDATE player SET elo = ? WHERE id = ?'
    let updatePlayerQueryParamsWin = [newWinnerElo, winnerId]
    let updatePlayerQueryParamsLose = [newLoserElo, loserId]

    let [addGameResult, x, y]  = await Promise.all([
      this.databaseFacade.execute(addGameQuery, addGameQueryParams),
      this.databaseFacade.execute(updatePlayerQuery, updatePlayerQueryParamsWin),
      this.databaseFacade.execute(updatePlayerQuery, updatePlayerQueryParamsLose)
    ])

    return this.getSingleGame(addGameResult.insertId)
  }

  async deleteGame (gameId) {
    gameId = Number(gameId)
    let gameDetailsQuery = 'SELECT winner, loser, winnerelo, loserelo, timestamp FROM game WHERE id = ?'
    let gameDetailsQueryParams = [gameId]

    let gameDetails = await this.databaseFacade.execute(gameDetailsQuery, gameDetailsQueryParams)
    gameDetails = gameDetails[0]

    let playerHistoryQuery = 'SELECT id FROM game WHERE winner = ? OR loser = ? ORDER BY timestamp DESC LIMIT 1'
    let playerHistoryQueryParamsWin = [gameDetails.winner, gameDetails.winner]
    let playerHistoryQueryParamsLose = [gameDetails.loser, gameDetails.loser]

    let [winnerMostRecentGame, loserMostRecentGame] = await Promise.all([
      this.databaseFacade.execute(playerHistoryQuery, playerHistoryQueryParamsWin),
      this.databaseFacade.execute(playerHistoryQuery, playerHistoryQueryParamsLose),
    ])
    if (winnerMostRecentGame[0].id !== gameId || loserMostRecentGame[0].id !== gameId) {
      return {error: 'One of the players has played a game more recent than this. Game cannot be deleted.'}
    }
   
    let deleteGameQuery = 'DELETE FROM game WHERE id = ?'
    let deleteGameQueryParams = [gameId]
    let updatePlayerQuery = 'UPDATE player SET elo = ? WHERE id = ?'
    let updatePlayerQueryParamsWin = [gameDetails.winnerelo, gameDetails.winner]
    let updatePlayerQueryParamsLose = [gameDetails.loserelo, gameDetails.loser]

    await Promise.all([
      this.databaseFacade.execute(deleteGameQuery, deleteGameQueryParams),
      this.databaseFacade.execute(updatePlayerQuery, updatePlayerQueryParamsWin),
      this.databaseFacade.execute(updatePlayerQuery, updatePlayerQueryParamsLose)
    ])

    return {success: true}
  }

  async getRatingSystems () {
    let calculationFunctions = Object.keys(ratingCalculator)
    return calculationFunctions
  }

  async getSampleOutcomes () {
    let ratingsToTest = [
      [1200,1200],
      [1150,1250],
      [1100,1250],
      [1100,1300],
      [1050,1350],
      [1000,1400],
      [900,1500],
      [800,1600],
    ]
    let outcomes = {}
    for (let ratingFunction of Object.keys(ratingCalculator)) {
      outcomes[ratingFunction] = []
      for (let ratings of ratingsToTest) {
        let ratingTransferredExpected = ratingCalculator[ratingFunction](ratings[1], ratings[0])
        let ratingTransferredUpset = ratingCalculator[ratingFunction](ratings[0], ratings[1])
        
        outcomes[ratingFunction].push({expectedChange: ratingTransferredExpected, upsetChange: ratingTransferredUpset})
      }
    }

    return {
      ratings: ratingsToTest,
      changes: outcomes
    }
  }

  async testRatingSystem (ratingSystemName, officeId) {
    if (!(ratingSystemName in ratingCalculator)) {
      return {error: 'Invalid name'}
    }
    let calculate = ratingCalculator[ratingSystemName]

    let allGames = await this.getAllGames(officeId)
    let allRatings = {}
    
    // gameId, winningPlayer, losingPlayer, winnerElo, loserElo
    for (var game of allGames) {
      if (!(game.winningPlayer in allRatings)) {
        allRatings[game.winningPlayer] = {
          gamesCount: 0,
          elo: 1200
        }
      }
      if (!(game.losingPlayer in allRatings)) {
        allRatings[game.losingPlayer] = {
          gamesCount: 0,
          elo: 1200
        }
      }

      let ratingChange = calculate(game.winnerElo, game.loserElo)
      allRatings[game.winningPlayer].elo = allRatings[game.winningPlayer].elo + ratingChange
      allRatings[game.winningPlayer].gamesCount += 1
      allRatings[game.losingPlayer].elo = allRatings[game.losingPlayer].elo - ratingChange
      allRatings[game.losingPlayer].gamesCount += 1
    }
    
    let allRatingsList = Object.keys(allRatings).map(key => ({name: key, elo: allRatings[key].elo, gamesCount: allRatings[key].gamesCount}))
    allRatingsList.sort((x1, x2) => x1.elo > x2.elo ? -1 : 1)
    return allRatingsList
  }

  calculateEloChanges (winnerElo, loserElo) {
    const k = 32

    let P1 = (1.0 / (1.0 + 10**((winnerElo - loserElo) / 400)))
    let P2 = (1.0 / (1.0 + 10**((loserElo - winnerElo) / 400)))

    let ratingTransferred = k*(P1)

    let newWinnerElo = winnerElo + ratingTransferred
    let newLoserElo = loserElo - ratingTransferred

    return  {newWinnerElo: newWinnerElo, winnerEloChange: newWinnerElo-winnerElo,
             newLoserElo: newLoserElo, loserEloChange: newLoserElo-loserElo}
  }

  hasOfficeIdInQuery (req, res, next) {
    if (!req.query || !req.query.officeId) {
      res.json({error: 'Missing query parameter officeId'})
    }
    else {
      next()
    }
  }

  hasOfficeIdInBody (req, res, next) {
    if (!req.body || !req.body.officeId) {
      res.json({error: 'Missing officeId in request body'})
    }
    else {
      next()
    }
  }
}