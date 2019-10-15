const databaseFacade = require('../utils/databaseFacade')
const authApi = require('./auth-api')
const authorize = require('../middleware/authorize')

module.exports = {
  setupRoutes () {
    app.get('/api/offices', async (req, res) => {
      let offices = await this.getOffices()
      res.json(offices)
    })

    app.post('/api/offices', async (req, res) => {
      let result = await this.addOffice(req.body.officeName, req.body.officePassword, req.body.passwordHint, req.body.slackBotUrl)
      res.json(result)
    })

    app.post('/api/offices/:id', authorize, async (req, res) => {
      let result = await this.updateOffice(req.params.id, req.body.officeName, req.body.currentPassword, req.body.newPassword, req.body.passwordHint, req.body.slackBotUrl)
      res.json(result)
    })
  },

  async getOffices () {
    let query = 'SELECT name, id, passwordHint FROM office'
    let offices = await databaseFacade.execute(query)
    return offices
  },

  async addOffice (officeName, officePassword, passwordHint, slackBotUrl) {
    try {
      if (officePassword.length < 4) {
        return {error: 'Password must be at least 4 characters long'}
      }
      if (!officeName.length > 1) {
        return {error: 'League name must be at least 2 characters long'}
      }

      officeName = officeName.trim()
      await authApi.signup(officeName, officePassword, passwordHint)
      return (await this.getOffices()).find(o => o.name === officeName)
    }
    catch (err) {
      console.log(err)
      return {error: 'Server error'}
    }
  },

  async updateOffice (officeId, newOfficeName, password, newPassword, passwordHint, newSlackBotUrl) {
    try {
      newOfficeName = newOfficeName.trim()
      if (!newOfficeName.length > 1) {
        return {error: 'League name must be at least 2 characters long'}
      }
      let res = await authApi.updateOffice(officeId, newOfficeName, password, newPassword, passwordHint)
      if (res.error) { return res }

      return (await this.getOffices()).find(o => o.name === newOfficeName)
    }
    catch (err) {
      console.log(err)
      return {error: 'Server error'}
    }
  },

  async getOfficeStats (officeId) {
    officeId = Number(officeId)
    try {
      let crossLeagueQuery = 'SELECT winnerelochange, winneroffice, loseroffice FROM crossleaguegame WHERE winneroffice = ? OR loseroffice = ?'
      let crossLeagueGames = await databaseFacade.execute(crossLeagueQuery, [officeId, officeId])
      let crossLeagueScores = []
      if (crossLeagueGames.length > 0) {
        let offices = await this.getOffices()

        for (var game of crossLeagueGames) {
          let isWinner = game.winneroffice === officeId
          let opponentOffice = isWinner ? game.loseroffice : game.winneroffice
          let ratingChange = isWinner ? game.winnerelochange : -game.winnerelochange

          if (!crossLeagueScores.find(score => score.officeId === opponentOffice)) {
            let officeName = offices.find(o => o.id === opponentOffice).name
            crossLeagueScores.push({officeId: opponentOffice, officeName: officeName, ratingChange: 0, games: 0})
          }

          let scoreIndex = crossLeagueScores.findIndex(score => score.officeId === opponentOffice)
          crossLeagueScores[scoreIndex].games += 1
          crossLeagueScores[scoreIndex].ratingChange += ratingChange
        }

        crossLeagueScores.sort((c1, c2) => c1.games > c2.games ? -1 : 1)
      }

      return crossLeagueScores
    }
    catch (err) {
      console.log(err)
      return {error: 'Server error'}
    }
  },
}