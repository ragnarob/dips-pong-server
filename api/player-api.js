
module.exports = class PlayerApi {
  constructor (app, databaseFacade) {
    this.app = app
    this.databaseFacade = databaseFacade

    if (this.app) {
      this.setupRoutes()
    }
  }

  setupRoutes () {
    this.app.get('/api/players', this.hasOfficeIdInQuery, async (req, res) => {
      let allPlayers = await this.getAllPlayers(req.query.officeId)
      res.json(allPlayers)
    })

    this.app.get('/api/players/:name', this.hasOfficeIdInQuery, async (req, res) => {
      let playerStats = await this.getPlayerStats(req.query.officeId, req.params.name) 
      res.json(playerStats)
    })

    this.app.delete('/api/players/:id', async (req, res) => {
      await this.deletePlayer(req.params.id)
      res.json({success: true})
    })

    this.app.post('/api/players', this.hasOfficeIdInBody, async (req, res) => {
      await this.addPlayer(req.body.officeId, req.body.newPlayerName)
      res.json({success: true})
    })

    this.app.post('/api/players/:id', async (req, res) => {
      await this.renamePlayer(req.params.id, req.body.newPlayerName)
      res.json({success: true})
    })
  }

  async getAllPlayers (officeId) {
    let query = 'SELECT player.id AS id, player.name AS name, elo, office.id AS officeId, office.name AS officeName FROM player INNER JOIN office ON (player.office = office.id) WHERE office = ? ORDER BY elo DESC'
    let allPlayers = await this.databaseFacade.execute(query, [officeId])
    return allPlayers
  }

  async getPlayerStats (officeId, playerName) {
    let playerQuery = 'SELECT player.id AS id, elo, office.id AS officeId, office.name AS officeName FROM player INNER JOIN office ON (player.office = office.id) WHERE player.name = ? AND office = ?'
    let playerQueryParams = [playerName, officeId]

    let matchesQuery = 'SELECT game.id AS gameId, game.timestamp AS timestamp, player.name AS winningPlayer, losingjoin.name AS losingPlayer, game.winnerelochange AS winnerEloChange, game.loserelochange AS loserEloChange, game.winnerelo AS winnerElo, game.loserelo AS loserElo FROM game INNER JOIN player ON (player.id = winner) INNER JOIN player AS losingjoin ON (losingjoin.id = game.loser) WHERE (player.name = ? OR losingjoin.name = ?) AND game.office = ? ORDER BY timestamp DESC'
    let matchesQueryParams = [playerName, playerName, officeId]
    let [playerResult, matchesResult] = await Promise.all([
      this.databaseFacade.execute(playerQuery, playerQueryParams),
      this.databaseFacade.execute(matchesQuery, matchesQueryParams)
    ])

    if (playerResult.length === 0) {
      return {error: 'No player with name ' + playerName}
    }

    for (const match of matchesResult) {
      match.winningPlayer = match.winningPlayer.trim()
      match.losingPlayer = match.losingPlayer.trim()
    }

    return {
      name: playerName,
      id: playerResult[0].id,
      officeId: playerResult[0].officeId,
      officeName: playerResult[0].officeName,
      elo: playerResult[0].elo,
      matches: matchesResult
    }
  }

  async renamePlayer (playerId, newPlayerName) {
    newPlayerName = newPlayerName.trim()

    if (!this.isValidName(newPlayerName)) {
      return {error: 'Invalid player name'}
    }

    let query = 'UPDATE player SET name = ? WHERE id = ?'
    let queryParams = [newPlayerName, playerId]
    await this.databaseFacade.execute(query, queryParams)
  }

  async addPlayer (officeId, playerName) {
    playerName = playerName.trim()

    if (!this.isValidName(playerName)) {
      return {error: 'Invalid player name'}
    }

    let query = 'INSERT INTO player (name, office) VALUES (?, ?)'
    let queryParams = [playerName, officeId]

    await this.databaseFacade.execute(query, queryParams)

    return this.getPlayerStats(officeId, playerName)
  }

  async deletePlayer (id) {
    let query = 'DELETE FROM player WHERE id = ?'
    let queryParams = [Number(id)]
    await this.databaseFacade.execute(query, queryParams)
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

  isValidName (name) {
    return name.length > 1 
      && name.length < 25
      && /^[\wÆØÅæøå\s]+$/i.test(name)
  }
}
