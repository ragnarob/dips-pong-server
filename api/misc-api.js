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
}