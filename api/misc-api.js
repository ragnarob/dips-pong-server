module.exports = class MiscApi {
  constructor (app, databaseFacade, gameApi, playerApi) {
    this.app = app
    this.databaseFacade = databaseFacade
    this.gameApi = gameApi
    this.playerApi = playerApi

    if (this.app) {
      this.setupRoutes()
    }
  }

  setupRoutes () {
    this.app.get('/api/hotstreaks', async (req, res) => {
      if (!req.query || !req.query.officeId) {
        res.json({error: 'Missing query parameter officeId'})
      }
      let streaks = await this.getHotStreaks(req.query.officeId)
      res.json(streaks)
    })

    this.app.get('/api/ratingstats', async (req, res) => {
      if (!req.query || !req.query.officeId) {
        res.json({error: 'Missing query parameter officeId'})
      }
      let stats = await this.getRatingStats(req.query.officeId)
      res.json(stats)
    })

    this.app.get('/api/offices', async (req, res) => {
      let offices = await this.getOffices()
      res.json(offices)
    })

    this.app.post('/api/offices', async (req, res) => {
      let result = await this.addOffice(req.body.officeName, req.body.slackBotUrl)
      res.json(result)
    })

    this.app.post('/api/offices/:id', async (req, res) => {
      let result = await this.updateOffice(req.params.id, req.body.officeName, req.body.slackBotUrl)
      res.json(result)
    })
  }

  async getHotStreaks (officeId) {
    let allPlayers = await this.playerApi.getAllPlayers(officeId)
    let streakList = []

    for (const player of allPlayers) {
      let playerStats = await this.playerApi.getPlayerStats(officeId, player.name)

      let streak = 0
      for (const game of playerStats.matches) {
        if (game.winningPlayer === player.name) {
          streak++
        }
        else {
          break
        }
      }

      streakList.push({name: player.name, streak: streak})
    }

    let topThree = streakList.sort((p1, p2) => p1.streak>p2.streak ? -1 : 1)
    return topThree.slice(0, 3).filter(t => t.streak > 1)
  }

  async getRatingStats (officeId) {
    let allGames = (await this.gameApi.getAllGames(officeId)).reverse()
    let allPlayers = await this.playerApi.getAllPlayers(officeId)

    let ratingStatsData = []

    for (var player of allPlayers) {
      ratingStatsData.push({name: player.name, data: [[undefined, 1200]]})
    }

    for (var game of allGames) {
      let gameTime = new Date(game.timestamp).getTime()
      let winningPlayerStats = ratingStatsData.find(s => s.name === game.winningPlayer)
      let losingPlayerStats = ratingStatsData.find(s => s.name === game.losingPlayer)

      if (losingPlayerStats.data.length === 1) {
        losingPlayerStats.data[0][0] = gameTime - 3600000
      }
      if (winningPlayerStats.data.length === 1) {
        winningPlayerStats.data[0][0] = gameTime - 3600000
      }

      winningPlayerStats.data.push([gameTime, game.winnerElo + game.winnerEloChange])
      losingPlayerStats.data.push([gameTime, game.loserElo + game.loserEloChange])
    }

    let nowTime = new Date().getTime()
    let finalPlayerStats = []

    for (var player of allPlayers) {
      let playerStats = ratingStatsData.find(s => s.name === player.name)
      if (playerStats.data.length > 1) {
        playerStats.data.push([nowTime, player.elo])
        finalPlayerStats.push(playerStats)
      }
    }

    return finalPlayerStats
  }

  async getOffices () {
    let query = 'SELECT name, id FROM office'
    let offices = await this.databaseFacade.execute(query)
    return offices
  }

  async addOffice (officeName, slackBotUrl) {
    officeName = officeName.trim()
    let query = 'INSERT INTO office (name) VALUES (?)'
    await this.databaseFacade.execute(query, [officeName])
    return (await this.getOffices()).find(o => o.name === officeName)
  }

  async updateOffice (officeId, newOfficeName, newSlackBotUrl) {
    newOfficeName = newOfficeName.trim()

    let query = 'UPDATE office SET name = ? WHERE id = ?'
    let queryParams = [newOfficeName, Number(officeId)]
    await this.databaseFacade.execute(query, queryParams)
    return (await this.getOffices()).find(o => o.name === newOfficeName)
  }
}