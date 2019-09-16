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
    let allGames = (await this.gameApi.getAllGames()).reverse()
    let allPlayers = await this.playerApi.getAllPlayers()

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
}