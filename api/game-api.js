
module.exports = class GameApi {
  constructor (app, databaseFacade) {
    this.app = app
    this.databaseFacade = databaseFacade

    if (this.app) {
      this.setupRoutes()
    }
  }

  setupRoutes () {
    this.app.get('/api/games', async (req, res) => {
      let allGames = await this.getAllGames()
      res.json(allGames)
    })

    this.app.get('/api/games/:id', async (req, res) => {
      let game = await this.getSingleGame(req.params.id)
      res.json(game)
    })

    this.app.post('/api/games', async (req, res) => {
      await this.addGame(req.body.winnerId, req.body.loserId)
      res.json({success: true})
    })

    this.app.delete('/api/games/:id', async (req, res) => {
      await this.deleteGame(req.params.id)
      res.json({success: true})
    })
  }

  async getAllGames () {
    let query = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser)'

    let games = await this.databaseFacade.execute(query)
    return games
  }

  async getSingleGame (gameId) {
    let query = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser) WHERE game.id = ?'
    let queryParams = [gameId]

    let gameResult = await this.databaseFacade.execute(query, queryParams)
    if (gameResult.length === 0) {
      return {error: 'No game with id ' + gameId}
    }
    return gameResult[0]
  }

  async addGame (winnerId, loserId) {
    let eloQuery = 'SELECT elo FROM player WHERE id = ?'

    let winnerElo = await this.databaseFacade.execute(eloQuery, [winnerId])
    winnerElo = winnerElo[0].elo
    let loserElo = await this.databaseFacade.execute(eloQuery, [loserId])
    loserElo = loserElo[0].elo

    let newData = this.calculateEloChanges(winnerElo, loserElo)
    let newWinnerElo = newData.newWinnerElo
    let winnerEloChange = newData.winnerEloChange
    let newLoserElo = newData.newLoserElo
    let loserEloChange = newData.loserEloChange

    let addGameQuery = 'INSERT INTO game (winner, loser, winnerelo, loserelo, winnerelochange, loserelochange) VALUES (?, ?, ?, ?, ?, ?)'
    let addGameQueryParams = [winnerId, loserId, winnerElo, loserElo, winnerEloChange, loserEloChange]

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
    let gameDetailsQuery = 'SELECT winner, loser, winnerelo, loserelo, timestamp FROM game WHERE id = ?'
    let gameDetailsQueryParams = [gameId]

    let gameDetails = await this.databaseFacade.execute(gameDetailsQuery, gameDetailsQueryParams)
    gameDetails = gameDetails[0]

    let playerHistoryQuery = 'SELECT id FROM game WHERE winner = ? OR loser = ? ORDER BY timestamp LIMIT 1'
    let playerHistoryQueryParamsWin = [gameDetails.winner, gameDetails.winner]
    let playerHistoryQueryParamsLose = [gameDetails.loser, gameDetails.loser]

    let [winnerMostRecentGame, loserMostRecentGame] = await Promise.all([
      this.databaseFacade.execute(playerHistoryQuery, playerHistoryQueryParamsWin),
      this.databaseFacade.execute(playerHistoryQuery, playerHistoryQueryParamsLose),
    ])

    if (winnerMostRecentGame[0].id !== gameDetails.winner || loserMostRecentGame[0].id !== gameDetails.loser) {
      return {error: 'One of the players has played a game more recent than this. Game cannot be deleted.'}
    }
   
    let deleteGameQuery = 'DELETE FROM game WHERE id = ?'
    let deleteGameQueryParams = [gameId]
    let updatePlayerQuery = 'UPDATE player SET elo = ? WHERE id = ?'
    let updatePlayerQueryParamsWin = [gameDetails.winnerElo, gameDetails.winner]
    let updatePlayerQueryParamsLose = [gameDetails.loserElo, gameDetails.loser]

    await Promise.all([
      this.databaseFacade.execute(deleteGameQuery, deleteGameQueryParams),
      this.databaseFacade.execute(updatePlayerQuery, updatePlayerQueryParamsWin),
      this.databaseFacade.execute(updatePlayerQuery, updatePlayerQueryParamsLose)
    ])

    return {success: true}
  }

  calculateEloChanges (winnerElo, loserElo) {
    // bla bla
    return  {newWinnerElo: 33, winnerEloChange: 3, newLoserElo: 44, loserEloChange: -33}
  }
}