
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
      let result = await this.deleteGame(req.params.id)
      res.json(result)
    })
  }

  async getAllGames () {
    let query = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelo AS winnerElo, game.loserelo AS loserElo, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser) ORDER BY timestamp DESC'

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
}