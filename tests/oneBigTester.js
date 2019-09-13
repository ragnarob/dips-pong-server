// DISCLAIMER: This is testing not done properly =)
// In fact, one might say "what the fuck?"

module.exports = async function test () {
  const GameApi = require('../api/game-api.js')
  const PlayerApi = require('../api/player-api')
  const DatabaseFacade = require('../utils/databaseFacade')

  const databaseFacade = new DatabaseFacade()
  const playerApi = new PlayerApi(null, databaseFacade)
  const gameApi = new GameApi(null, databaseFacade)

  console.log('--------------------------------------\n\n')

  console.log('All players:')
  let allPlayers = await playerApi.getAllPlayers() 
  console.log(allPlayers)

  console.log('--------------------------------------\n\n')

  console.log('Creating player asd')
  await playerApi.addPlayer('asd')
  console.log(await playerApi.getPlayerStats('asd'))

  console.log('--------------------------------------\n\n')

  console.log('Player asd:')
  let playerStats = await playerApi.getPlayerStats('asd')
  console.log(playerStats)

  console.log('--------------------------------------\n\n')

  console.log('Updating player "asd" to "qwe"')
  await playerApi.renamePlayer('asd', 'qwe')
  console.log(await playerApi.getPlayerStats('qwe'))

  console.log('--------------------------------------\n\n')

  console.log('All games: ')
  let allGames = await gameApi.getAllGames()
  console.log(allGames)

  console.log('--------------------------------------\n\n')

  console.log('Creating player "noob", losing a game to "qwe"')
  let noobPlayerStats = await playerApi.addPlayer('noob')
  let gameResult = await gameApi.addGame(playerStats.id, noobPlayerStats.id)
  console.log(gameResult)

  console.log('--------------------------------------\n\n')

  console.log('Getting same game result manually:')
  let gameResult0 = await gameApi.getSingleGame(gameResult.gameId)
  console.log(gameResult0)

  console.log('--------------------------------------\n\n')

  console.log('Adding new game, then trying to delete the first')
  let gameResult2 = await gameApi.addGame(playerStats.id, noobPlayerStats.id)
  let response = await gameApi.deleteGame(gameResult.gameId)
  console.log(response)

  console.log('--------------------------------------\n\n')

  console.log('Deleting both games, showing empty first game:')
  await gameApi.deleteGame(gameResult2.gameId)
  await gameApi.deleteGame(gameResult.gameId)
  let firstGamResult = await gameApi.getSingleGame(gameResult.gameId)
  console.log(firstGamResult)

  console.log('--------------------------------------\n\n')

  console.log('Deleting player qwe')
  await playerApi.deletePlayer('qwe')
  console.log(await playerApi.getPlayerStats('qwe'))
  console.log(await playerApi.getPlayerStats('asd'))

  console.log('--------------------------------------\n\n')
}