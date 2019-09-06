
module.exports = class PlayerApi {
  constructor (app, databaseFacade) {
    this.app = app
    this.databaseFacade = databaseFacade

    if (this.app) {
      this.setupRoutes()
    }
  }

  setupRoutes () {
    this.app.get('/api/players', async (req, res) => {
      let allPlayers = await this.getAllPlayers()
      res.json(allPlayers)
    })

    this.app.get('/api/player/:name', async (req, res) => {
      let playerStats = await this.getPlayerStats(req.params.name) 
      res.json(playerStats)
    })

    this.app.post('/api/player/:id', async (req, res) => {
      await this.renamePlayer(req.params.id, req.body.newPlayerName)
      res.json({success: true})
    })

    this.app.post('/api/players', async (req, res) => {
      await this.addPlayer(req.body.newPlayerName)
      res.json({success: true})
    })

    this.app.delete('/api/players/:name', async (req, res) => {
      await this.deletePlayer(req.params.name)
      res.json({success: true})
    })
  }

  async getAllPlayers () {
    let query = 'SELECT id, name, elo FROM player ORDER BY elo DESC'
    let allPlayers = await this.databaseFacade.execute(query)
    return allPlayers
  }

  async getPlayerStats (playerName) {
    let playerQuery = 'SELECT id, elo FROM player WHERE name = ?'
    let playerQueryParams = [playerName]

    let matchesQuery = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange, game.winnerelo AS winnerElo, game.loserelo AS loserElo FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser) WHERE (player.name = ? OR losingjoin.name = ?) ORDER BY timestamp DESC'
    let matchesQueryParams = [playerName, playerName]
    let [playerResult, matchesResult] = await Promise.all([
      this.databaseFacade.execute(playerQuery, playerQueryParams),
      this.databaseFacade.execute(matchesQuery, matchesQueryParams)
    ])

    if (playerResult.length === 0) {
      return {error: 'No player with name ' + playerName}
    }

    return {
      name: playerName,
      id: playerResult[0].id,
      elo: playerResult[0].elo,
      matches: matchesResult
    }
  }

  async renamePlayer (playerId, newPlayerName) {
    if (!this.isValidName(newPlayerName)) {
      return {error: 'Invalid player name'}
    }

    let query = 'UPDATE player SET name = ? WHERE id = ?'
    let queryParams = [newPlayerName, playerId]
    await this.databaseFacade.execute(query, queryParams)
  }

  async addPlayer (playerName) {
    if (!this.isValidName(playerName)) {
      return {error: 'Invalid player name'}
    }

    let query = 'INSERT INTO player (name) VALUES (?)'
    let queryParams = [playerName]

    await this.databaseFacade.execute(query, queryParams)

    return this.getPlayerStats(playerName)
  }

  async deletePlayer (playerName) {
    let query = 'DELETE FROM player WHERE name = ?'
    let queryParams = [playerName]
    await this.databaseFacade.execute(query, queryParams)
  }

  isValidName (name) {
    return name.length > 1 
      && name.length < 25
      && /^[\wÆØÅæøå\s]+$/i.test(name)
  }
}