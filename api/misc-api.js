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

      let streaks = await this.getHotStreaks()
      res.json(streaks)
    })

    this.app.get('/api/ratingstats', async (req, res) => {
      let stats = await this.getRatingStats()
      res.json(stats)
    })
  }

  async getHotStreaks () {
    let allPlayers = await this.playerApi.getAllPlayers()
    let streakList = []

    for (const player of allPlayers) {
      let playerStats = await this.playerApi.getPlayerStats(player.name)

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

  async getRatingStats () {
    let allGames = await this.gameApi.getAllGames()
    let allPlayers = await this.playerApi.getAllPlayers()

    let ratingStatsData = []
    let nowTime = new Date().getTime()

    for (var player of allPlayers) {
      ratingStatsData.push({name: player.name, data: [[nowTime, player.elo]]})
    }
    for (var game of allGames) {
      var gameTime = new Date(game.timestamp).getTime()
      ratingStatsData.find(s => s.name === game.winningPlayer).data.push([gameTime, game.winnerElo])
      ratingStatsData.find(s => s.name === game.losingPlayer).data.push([gameTime, game.loserElo])
    }

    return ratingStatsData
  }
}