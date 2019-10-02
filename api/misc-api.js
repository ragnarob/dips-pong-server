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
    this.app.get('/api/otherStats', async (req, res) => {
      if (!req.query || !req.query.officeId) {
        res.json({error: 'Missing query parameter officeId'})
      }
      let otherStats = await this.getOtherStats(req.query.officeId)
      res.json(otherStats)
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

  async getOtherStats (officeId) {
    let allPlayers = await this.playerApi.getAllPlayers(officeId)
    let streakList = []
    let allRivalries = []

    for (const player of allPlayers) {
      let playerStats = await this.playerApi.getPlayerStats(officeId, player.name)
      let rivalries = {}
      let streakStop = false
      let streak = 0
      for (const game of playerStats.matches) {
        let isVictory = game.winningPlayer === player.name
        let opponent = isVictory ? game.losingPlayer : game.winningPlayer
        if (!(opponent in rivalries)) { rivalries[opponent] = {win: 0, lose: 0} }
        rivalries[opponent][isVictory ? 'win' : 'lose'] += 1

        if (!streakStop && game.winningPlayer === player.name) {
          streak++
        }
        else {
          streakStop = true
        }
      }

      let topRivalries = this.getTopRivalries(rivalries, player.name)
      if (topRivalries) {
        allRivalries.push(...topRivalries)
      }

      streakList.push({name: player.name, streak: streak})
    }

    let topThreeRivalries = this.findTopTotalRivalries(allRivalries)
    let topThreeStreaks = streakList.sort((p1, p2) => p1.streak>p2.streak ? -1 : 1)

    return {
      streaks: topThreeStreaks.slice(0, 3).filter(t => t.streak > 1),
      rivalries: topThreeRivalries
    }
  }

  getTopRivalries (opponentsMatchList, playerName) {
    let scores = []
    for (let player in opponentsMatchList) {
      let numbers = opponentsMatchList[player]
      if (numbers.win + numbers.lose > 5) {
        let score = this.calculateRivalryScore(numbers.win, numbers.lose)
        scores.push([player, score])
      }
    }
    if (scores.length === 0) {
      return
    }

    scores.sort((s1, s2) => s1[1] > s2[1] ? -1 : 1)
    let topScores = scores.splice(0,3)
    let topRivalries = topScores.map(
      topScore => ({
        player: playerName,
        score: topScore[1],
        opponent: topScore[0],
        results: opponentsMatchList[topScore[0]]
      })
    )
    return topRivalries
  }

  calculateRivalryScore (wins, losses) {
    let total = wins + losses
    let diff = Math.abs(wins - losses)
    return total - ((diff + 1) * total) / 5
  }

  findTopTotalRivalries (rivalryList) {
    let finalRivalries = []
    rivalryList.sort((r1, r2) => r1.score > r2.score ? -1 : 1)

    for (let i=0; i<rivalryList.length; i+=2) {
      let playerIsLeading = rivalryList[i].results.win >= rivalryList[i].results.lose
      finalRivalries.push({
        'p1': playerIsLeading ? rivalryList[i].player : rivalryList[i].opponent,
        'p2': playerIsLeading ? rivalryList[i].opponent : rivalryList[i].player,
        'games': [rivalryList[i].results.win, rivalryList[i].results.lose]
      })
    }

    return finalRivalries
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